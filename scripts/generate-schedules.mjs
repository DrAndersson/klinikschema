import fs from 'node:fs/promises';
import path from 'node:path';

import * as XLSX from 'xlsx';

import { SWEDISH_MONTHS, parseScheduleRows } from '../lib/schedule.js';

const sourceDirectory = process.argv[2];
const outputFile = process.argv[3] ?? 'data/bundled-schedules.json';

if (!sourceDirectory) {
  throw new Error(
    'Ange mappen med Excel-scheman, till exempel: pnpm generate:schedules -- "/sökväg/till/Scheman"',
  );
}

const directoryEntries = await fs.readdir(sourceDirectory, {
  withFileTypes: true,
});
const fileNames = directoryEntries
  .filter((entry) => entry.isFile() && /\.xlsx?$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, 'sv'));

if (!fileNames.length) {
  throw new Error('Mappen innehåller inga .xls- eller .xlsx-filer.');
}

const bundledSchedules = [];

for (const fileName of fileNames) {
  const workbook = XLSX.read(
    await fs.readFile(path.join(sourceDirectory, fileName)),
    {
      type: 'buffer',
    },
  );
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error(`${fileName} innehåller inget kalkylblad.`);

  const rows = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  const schedule = parseScheduleRows(rows, fileName);
  const id = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;
  const people = schedule.people
    .filter((person) => person.dutyCount > 0)
    .map(({ code, name, dutyCount }) => ({ code, name, dutyCount }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'sv') ||
        a.code.localeCompare(b.code, 'sv'),
    );

  bundledSchedules.push({
    id,
    label: `${SWEDISH_MONTHS[schedule.month][0].toLocaleUpperCase('sv-SE')}${SWEDISH_MONTHS[schedule.month].slice(1)} ${schedule.year}`,
    month: schedule.month,
    year: schedule.year,
    entries: schedule.entries.map(
      ({ day, date, department, primaryCode, backupCode }) => ({
        day,
        date,
        department,
        primaryCode,
        backupCode,
      }),
    ),
    people,
  });
}

bundledSchedules.sort((a, b) => a.id.localeCompare(b.id));

const duplicateIds = bundledSchedules
  .filter(
    (schedule, index) =>
      bundledSchedules.findIndex(({ id }) => id === schedule.id) !== index,
  )
  .map(({ id }) => id);

if (duplicateIds.length) {
  throw new Error(
    `Flera filer gäller samma månad: ${[...new Set(duplicateIds)].join(', ')}`,
  );
}

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(
  outputFile,
  `${JSON.stringify(bundledSchedules, null, 2)}\n`,
  'utf8',
);

console.log(
  `Skapade ${outputFile} med ${bundledSchedules.length} månadsscheman.`,
);
