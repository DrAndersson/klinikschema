import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as XLSX from 'xlsx';

import {
  calendarFileName,
  createIcs,
  getPersonDuties,
  parseScheduleRows,
} from '../lib/schedule.js';

const bundledSchedules = JSON.parse(
  fs.readFileSync(new URL('../data/bundled-schedules.json', import.meta.url), 'utf8'),
);

function fixtureRows() {
  return [
    [null, null, 'oktober', null, null, 2026],
    [],
    [null, null, 'Dagjour', null, 'Bakjour'],
    [null, 'Dag', 'Hkir', 'Pkir', 'Hkir', 'Pkir'],
    [null, 1, 'GA/PJ', null, 'GA/PJ', 'MA'],
    [null, 2, null, null, 'PJ/GA', null],
    [null, 3, null, null, 'GA', null],
    [null, null, null, null, null, null, null, 'GA', 'Gustav Andersson'],
    [null, null, null, null, null, null, null, 'PJ', 'Per Jenmalm'],
    [null, null, null, null, null, null, null, 'MA', 'Magnus Andersson'],
  ];
}

test('parses only evening and weekend duty columns E and F', () => {
  const schedule = parseScheduleRows(fixtureRows(), '10-okt 26.xls');
  assert.equal(schedule.month, 10);
  assert.equal(schedule.year, 2026);
  assert.equal(schedule.entries.length, 4);

  const duties = getPersonDuties(schedule, 'GA', 'all');
  assert.deepEqual(
    duties.map(({ date, role, counterpartName }) => ({ date, role, counterpartName })),
    [
      { date: '2026-10-01', role: 'primary', counterpartName: 'Per Jenmalm' },
      { date: '2026-10-02', role: 'backup', counterpartName: 'Per Jenmalm' },
      { date: '2026-10-03', role: 'primary', counterpartName: null },
    ],
  );
});

test('uses a two-digit year from the filename without mistaking a day number for a year', () => {
  const rows = fixtureRows();
  rows[0][5] = null;
  const schedule = parseScheduleRows(rows, '10-okt 26.xls');
  assert.equal(schedule.year, 2026);
});

test('creates all-day calendar events with role and counterpart', () => {
  const schedule = parseScheduleRows(fixtureRows(), '10-okt 26.xls');
  const duties = getPersonDuties(schedule, 'GA', 'all');
  const ics = createIcs(schedule, 'GA', duties, new Date('2026-09-02T10:00:00Z'));

  assert.match(ics, /SUMMARY:Primärjour/);
  assert.match(ics, /SUMMARY:Bakjour/);
  assert.match(ics, /DESCRIPTION:Bakjour: Per Jenmalm/);
  assert.match(ics, /DESCRIPTION:Primär: Per Jenmalm/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261001\r\nDTEND;VALUE=DATE:20261002/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 3);
  assert.equal(calendarFileName(schedule, 'GA'), 'jour-gustav-andersson-2026-10.ics');

  for (const line of ics.split('\r\n')) {
    assert.ok(new TextEncoder().encode(line).length <= 75, `ICS line exceeds 75 bytes: ${line}`);
  }
});

test('bundled month schedules contain only the public duty data needed by the app', () => {
  assert.deepEqual(bundledSchedules.map(({ id }) => id), ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(bundledSchedules.map(({ entries }) => entries.length), [60, 62, 60]);

  for (const bundled of bundledSchedules) {
    assert.deepEqual(
      Object.keys(bundled).sort(),
      ['entries', 'id', 'label', 'month', 'people', 'year'],
    );

    const schedule = {
      ...bundled,
      names: new Map(bundled.people.map(({ code, name }) => [code, name])),
    };

    for (const entry of bundled.entries) {
      assert.deepEqual(
        Object.keys(entry).sort(),
        ['backupCode', 'date', 'day', 'department', 'primaryCode'],
      );
      assert.ok(schedule.names.has(entry.primaryCode));
      if (entry.backupCode) assert.ok(schedule.names.has(entry.backupCode));
    }

    for (const person of bundled.people) {
      assert.equal(getPersonDuties(schedule, person.code, 'all').length, person.dutyCount);
    }
  }
});

test('parses the supplied October schedule and ignores its day-duty columns', { skip: !fs.existsSync('10-okt 26.xls') }, () => {
  const workbook = XLSX.read(fs.readFileSync('10-okt 26.xls'), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
    header: 1,
    defval: null,
    raw: true,
  });
  const schedule = parseScheduleRows(rows, '10-okt 26.xls');
  const gustav = getPersonDuties(schedule, 'GA', 'all');

  assert.equal(schedule.month, 10);
  assert.equal(schedule.year, 2026);
  assert.equal(schedule.names.get('GA'), 'Gustav Andersson');
  assert.equal(gustav.length, 8);
  assert.equal(gustav.filter((duty) => duty.role === 'primary').length, 2);
  assert.equal(gustav.filter((duty) => duty.role === 'backup').length, 6);
  assert.equal(gustav.some((duty) => duty.date === '2026-10-28'), false);
  const octoberSecond = gustav.find((duty) => duty.date === '2026-10-02');
  assert.equal(octoberSecond.role, 'backup');
  assert.equal(octoberSecond.counterpartName, 'Staffan Svenlin');
});
