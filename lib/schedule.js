const MONTHS = new Map([
  ['JANUARI', 1], ['JAN', 1],
  ['FEBRUARI', 2], ['FEB', 2],
  ['MARS', 3], ['MAR', 3],
  ['APRIL', 4], ['APR', 4],
  ['MAJ', 5],
  ['JUNI', 6], ['JUN', 6],
  ['JULI', 7], ['JUL', 7],
  ['AUGUSTI', 8], ['AUG', 8],
  ['SEPTEMBER', 9], ['SEP', 9],
  ['OKTOBER', 10], ['OKT', 10],
  ['NOVEMBER', 11], ['NOV', 11],
  ['DECEMBER', 12], ['DEC', 12],
]);

export const SWEDISH_MONTHS = [
  '', 'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizedText(value) {
  return cleanText(value).toLocaleUpperCase('sv-SE');
}

function parseYear(value, allowShort = false) {
  const year = Number.parseInt(cleanText(value), 10);
  if (!Number.isFinite(year)) return null;
  if (year >= 2000 && year <= 2100) return year;
  if (allowShort && year >= 0 && year <= 99) return 2000 + year;
  return null;
}

function findMonthYear(rows, fileName) {
  let month = null;
  let year = null;

  for (const row of rows.slice(0, 12)) {
    for (const value of row) {
      const normalized = normalizedText(value);
      if (!month && MONTHS.has(normalized)) month = MONTHS.get(normalized);
      if (!year) year = parseYear(value);
    }
  }

  if (!month || !year) {
    const normalizedName = normalizedText(fileName).replace(/\.[A-Z0-9]+$/, '');
    const monthMatch = [...MONTHS.entries()].find(([name]) =>
      new RegExp(`(^|[^A-ZÅÄÖ])${name}([^A-ZÅÄÖ]|$)`).test(normalizedName),
    );
    if (!month && monthMatch) month = monthMatch[1];
    if (!year && monthMatch) {
      const fileYearMatch = normalizedName.match(
        new RegExp(`${monthMatch[0]}[^0-9]*(20\\d{2}|\\d{2})(?:[^0-9]|$)`),
      );
      year = fileYearMatch ? parseYear(fileYearMatch[1], true) : null;
    }
  }

  if (!month || !year) {
    throw new Error('Jag hittar inte månad och år i schemat. Kontrollera att filen följer den vanliga mallen.');
  }

  return { month, year };
}

function isLikelyFullName(value) {
  const text = cleanText(value);
  if (text.length < 5 || text.length > 70 || /\d/.test(text)) return false;
  const words = text.split(' ').filter(Boolean);
  return words.length >= 2 && words.every((word) => /[A-Za-zÅÄÖåäöÉé-]/.test(word));
}

function collectNameMap(rows) {
  const names = new Map();
  for (const row of rows) {
    for (let column = 0; column < row.length - 1; column += 1) {
      const code = normalizedText(row[column]);
      const name = cleanText(row[column + 1]);
      if (/^[A-ZÅÄÖ]{2,4}$/.test(code) && isLikelyFullName(name)) {
        names.set(code, name);
      }
    }
  }
  return names;
}

function parseDutyCell(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const codes = raw
    .split('/')
    .map((part) => normalizedText(part).replace(/[^A-ZÅÄÖ]/g, ''))
    .filter(Boolean);
  if (!codes.length || codes.some((code) => !/^[A-ZÅÄÖ]{2,4}$/.test(code))) return null;
  return {
    raw,
    primaryCode: codes[0],
    backupCode: codes[1] ?? null,
  };
}

function toIsoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseScheduleRows(rows, fileName = '') {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('Excel-filen verkar vara tom.');
  }

  const headerRowIndex = rows.findIndex((row) =>
    normalizedText(row?.[1]) === 'DAG'
      && normalizedText(row?.[4]) === 'HKIR'
      && normalizedText(row?.[5]) === 'PKIR',
  );

  if (headerRowIndex === -1) {
    throw new Error('Jag hittar inte jourkolumnerna E och F i den här filen. Kontrollera att det är klinikens vanliga schemamall.');
  }

  const { month, year } = findMonthYear(rows, fileName);
  const names = collectNameMap(rows);
  const entries = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const day = Number.parseInt(cleanText(rows[rowIndex]?.[1]), 10);
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;

    [
      { column: 4, department: 'Handkirurgi' },
      { column: 5, department: 'Plastikkirurgi' },
    ].forEach(({ column, department }) => {
      const duty = parseDutyCell(rows[rowIndex]?.[column]);
      if (!duty) return;
      entries.push({
        ...duty,
        day,
        date: toIsoDate(year, month, day),
        department,
        rowNumber: rowIndex + 1,
      });
    });
  }

  if (!entries.length) {
    throw new Error('Jag hittar inga kvälls- eller helgjourer i kolumn E eller F.');
  }

  const dutyCodes = new Set();
  for (const entry of entries) {
    dutyCodes.add(entry.primaryCode);
    if (entry.backupCode) dutyCodes.add(entry.backupCode);
  }
  for (const code of dutyCodes) {
    if (!names.has(code)) names.set(code, code);
  }

  const counts = new Map();
  for (const code of names.keys()) {
    counts.set(code, entries.reduce((total, entry) =>
      total + Number(entry.primaryCode === code || entry.backupCode === code), 0));
  }

  const people = [...names.entries()]
    .map(([code, name]) => ({ code, name, dutyCount: counts.get(code) ?? 0 }))
    .sort((a, b) => b.dutyCount - a.dutyCount || a.name.localeCompare(b.name, 'sv'));

  return { fileName, month, year, entries, people, names };
}

export function getPersonDuties(schedule, personCode, roleFilter = 'all') {
  return schedule.entries
    .flatMap((entry) => {
      if (entry.primaryCode === personCode && roleFilter !== 'backup') {
        return [{
          ...entry,
          role: 'primary',
          counterpartCode: entry.backupCode,
          counterpartName: entry.backupCode ? schedule.names.get(entry.backupCode) ?? entry.backupCode : null,
        }];
      }
      if (entry.backupCode === personCode && roleFilter !== 'primary') {
        return [{
          ...entry,
          role: 'backup',
          counterpartCode: entry.primaryCode,
          counterpartName: schedule.names.get(entry.primaryCode) ?? entry.primaryCode,
        }];
      }
      return [];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.department.localeCompare(b.department, 'sv'));
}

function escapeIcs(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcsLine(line) {
  const encoder = new TextEncoder();
  const parts = [];
  let current = '';
  for (const character of line) {
    const candidate = current + character;
    if (encoder.encode(candidate).length > 75) {
      parts.push(current);
      current = ` ${character}`;
    } else {
      current = candidate;
    }
  }
  parts.push(current);
  return parts.join('\r\n');
}

function nextDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function compactDate(dateString) {
  return dateString.replaceAll('-', '');
}

function utcTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function createIcs(schedule, personCode, duties, generatedAt = new Date()) {
  const personName = schedule.names.get(personCode) ?? personCode;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jourkalender//Excel till kalender//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(`Jour – ${personName}`)}`,
    'X-WR-TIMEZONE:Europe/Stockholm',
  ];

  for (const duty of duties) {
    const summary = duty.role === 'primary' ? 'Primärjour' : 'Bakjour';
    const description = duty.counterpartName
      ? `${duty.role === 'primary' ? 'Bakjour' : 'Primär'}: ${duty.counterpartName}`
      : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(`${duty.date}-${duty.department}-${personCode}-${duty.role}@jourkalender`)}`,
      `DTSTAMP:${utcTimestamp(generatedAt)}`,
      `DTSTART;VALUE=DATE:${compactDate(duty.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDate(duty.date))}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `CATEGORIES:${escapeIcs('Jour')},${escapeIcs(duty.department)}`,
      'TRANSP:OPAQUE',
      'STATUS:CONFIRMED',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

export function calendarFileName(schedule, personCode) {
  const personName = schedule.names.get(personCode) ?? personCode;
  const safeName = personName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sv-SE')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `jour-${safeName}-${schedule.year}-${String(schedule.month).padStart(2, '0')}.ics`;
}
