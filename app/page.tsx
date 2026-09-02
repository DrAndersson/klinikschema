'use client';

import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CalendarCheck,
  Check,
  Download,
  FileSpreadsheet,
  Info,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  SWEDISH_MONTHS,
  calendarFileName,
  createIcs,
  getPersonDuties,
  parseScheduleRows,
} from '@/lib/schedule';

const weekdays = ['SÖN', 'MÅN', 'TIS', 'ONS', 'TOR', 'FRE', 'LÖR'];

function eventPreview(duty: any, index: number) {
  const date = new Date(`${duty.date}T12:00:00`);
  const isPrimary = duty.role === 'primary';
  const counterpart = duty.counterpartName
    ? `${isPrimary ? 'Bakjour' : 'Primär'}: ${duty.counterpartName}`
    : 'Ingen motpart angiven i schemat';
  return (
    <article
      className={`event-card ${isPrimary ? 'primary-event' : 'backup-event'}`}
      key={`${duty.date}-${duty.department}-${index}`}
    >
      <div className="date-tile">
        <strong>{String(date.getDate()).padStart(2, '0')}</strong>
        <span>{weekdays[date.getDay()]}</span>
      </div>
      <div className="event-copy">
        <span className="role-pill">{isPrimary ? 'PRIMÄRJOUR' : 'BAKJOUR'}</span>
        <strong>{isPrimary ? 'Primärjour' : 'Bakjour'}</strong>
        <small>{counterpart}</small>
      </div>
      <span className="all-day">HELDAG</span>
    </article>
  );
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [selectedCode, setSelectedCode] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const duties = useMemo(
    () => schedule && selectedCode
      ? getPersonDuties(schedule, selectedCode, roleFilter)
      : [],
    [schedule, selectedCode, roleFilter],
  );

  const allDuties = useMemo(
    () => schedule && selectedCode
      ? getPersonDuties(schedule, selectedCode, 'all')
      : [],
    [schedule, selectedCode],
  );

  const primaryCount = duties.filter((duty: any) => duty.role === 'primary').length;
  const backupCount = duties.filter((duty: any) => duty.role === 'backup').length;
  const selectedPerson = schedule?.people.find((person: any) => person.code === selectedCode);

  const exampleDuties = [
    { date: '2026-10-02', department: 'Handkirurgi', role: 'primary', counterpartName: 'Gustav Andersson' },
    { date: '2026-10-13', department: 'Handkirurgi', role: 'backup', counterpartName: 'Joakim Lundberg' },
  ];
  const previewDuties = schedule ? duties.slice(0, 3) : exampleDuties;

  async function readFile(file?: File) {
    if (!file) return;
    setError('');
    setDownloaded(false);

    if (!/\.xlsx?$/i.test(file.name)) {
      setError('Välj en Excel-fil i formatet .xls eller .xlsx.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Filen är större än 12 MB. Kontrollera att du har valt själva månadsschemat.');
      return;
    }

    setIsParsing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error('Excel-filen innehåller inget kalkylblad.');
      const rows = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: null,
        raw: true,
      }) as unknown[][];
      const parsed = parseScheduleRows(rows, file.name);
      const firstWithDuty = parsed.people.find((person: any) => person.dutyCount > 0);
      setSchedule(parsed);
      setSelectedCode(firstWithDuty?.code ?? parsed.people[0]?.code ?? '');
      setRoleFilter('all');
      setFileName(file.name);
    } catch (fileError) {
      setSchedule(null);
      setSelectedCode('');
      setFileName('');
      setError(fileError instanceof Error ? fileError.message : 'Filen kunde inte läsas.');
    } finally {
      setIsParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeFile() {
    setSchedule(null);
    setSelectedCode('');
    setFileName('');
    setError('');
    setDownloaded(false);
  }

  function downloadCalendar() {
    if (!schedule || !selectedCode || !duties.length) return;
    const content = createIcs(schedule, selectedCode, duties);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = calendarFileName(schedule, selectedCode);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  const currentStep = schedule ? 3 : 1;
  const monthLabel = schedule
    ? `${SWEDISH_MONTHS[schedule.month].toLocaleUpperCase('sv-SE')} ${schedule.year}`
    : 'OKTOBER 2026';

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Jourkalender startsida">
          <span className="brand-mark" aria-hidden="true"><CalendarCheck /></span>
          <span>Jourkalender</span>
        </a>
        <div className="privacy-chip">
          <ShieldCheck aria-hidden="true" />
          Filen lämnar aldrig din enhet
        </div>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">Excel → kalender</p>
          <h1 id="page-title">Från jourschema till kalender på en minut.</h1>
          <p className="lead">
            Ladda upp månadsschemat, välj en person och hämta alla relevanta
            primär- och bakjourer som en färdig kalenderfil.
          </p>
        </section>

        <section className="workspace" aria-label="Skapa kalenderfil">
          <div className="maker-card">
            <ol className="steps" aria-label="Tre steg">
              {['Välj schema', 'Välj person', 'Hämta kalender'].map((label, index) => {
                const step = index + 1;
                const completed = schedule && step < currentStep;
                return (
                  <li className={step <= currentStep ? 'active' : ''} key={label}>
                    <span>{completed ? <Check aria-label="Klart" /> : step}</span>
                    <strong>{label}</strong>
                  </li>
                );
              })}
            </ol>

            <div className="form-section">
              <div className="section-heading">
                <div>
                  <p className="step-label">Steg 1</p>
                  <h2>Öppna Excel-schemat</h2>
                </div>
                <span className="file-types">.xls · .xlsx</span>
              </div>

              <label
                className={`dropzone ${isDragging ? 'dragging' : ''}`}
                htmlFor="schedule-file"
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  void readFile(event.dataTransfer.files[0]);
                }}
              >
                <input
                  id="schedule-file"
                  ref={inputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(event) => void readFile(event.target.files?.[0])}
                />
                <span className="upload-icon" aria-hidden="true">
                  {isParsing ? <span className="spinner" /> : <Upload />}
                </span>
                <span className="drop-copy">
                  <strong>{isParsing ? 'Läser schemat…' : schedule ? 'Öppna ett annat schema' : 'Släpp filen här'}</strong>
                  <small>{schedule ? 'eller behåll det inlästa schemat nedan' : 'eller klicka för att välja från datorn'}</small>
                </span>
                <span className="browse-button">Välj fil</span>
              </label>

              {schedule && (
                <div className="file-state success-state" aria-live="polite">
                  <FileSpreadsheet aria-hidden="true" />
                  <span>
                    <strong>{fileName}</strong>
                    <small>{SWEDISH_MONTHS[schedule.month]} {schedule.year} · {schedule.entries.length} jourrader hittades</small>
                  </span>
                  <button type="button" onClick={removeFile} aria-label="Ta bort vald fil"><X /></button>
                </div>
              )}
              {error && (
                <div className="file-state error-state" role="alert">
                  <AlertCircle aria-hidden="true" />
                  <span><strong>Filen kunde inte läsas</strong><small>{error}</small></span>
                </div>
              )}
            </div>

            <div className={`form-section muted-section ${schedule ? 'ready-section' : ''}`} id="person-section">
              <div className="section-heading">
                <div>
                  <p className="step-label">Steg 2</p>
                  <h2>Vem gäller kalendern?</h2>
                </div>
              </div>

              <div className="field-grid">
                <Field className="field">
                  <FieldLabel htmlFor="person-select">Person</FieldLabel>
                  <NativeSelect
                    id="person-select"
                    value={selectedCode}
                    disabled={!schedule}
                    onChange={(event) => { setSelectedCode(event.target.value); setDownloaded(false); }}
                  >
                    {!schedule && <NativeSelectOption value="">Ladda upp ett schema först</NativeSelectOption>}
                    {schedule?.people.map((person: any) => (
                      <NativeSelectOption key={person.code} value={person.code}>
                        {person.name} ({person.code}) · {person.dutyCount} jourer
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>

                <FieldSet className="field role-field" disabled={!schedule}>
                  <FieldLegend>Ta med</FieldLegend>
                  <div className="segmented-control" id="role-filter">
                    {[
                      ['all', 'Alla jourer'],
                      ['primary', 'Primär'],
                      ['backup', 'Bakjour'],
                    ].map(([value, label]) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="role"
                          value={value}
                          checked={roleFilter === value}
                          onChange={() => { setRoleFilter(value); setDownloaded(false); }}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </FieldSet>
              </div>
            </div>

            <div className={`result-section ${duties.length ? 'result-ready' : ''}`} id="result-section">
              <div className="result-summary" aria-live="polite">
                <span className="summary-icon" aria-hidden="true">
                  {downloaded ? <Check /> : <CalendarCheck />}
                </span>
                <span>
                  <strong>
                    {downloaded
                      ? 'Kalenderfilen är skapad'
                      : schedule
                        ? duties.length
                          ? `${selectedPerson?.name}: ${duties.length} ${duties.length === 1 ? 'jour' : 'jourer'}`
                          : `Inga ${roleFilter === 'all' ? 'jourer' : roleFilter === 'primary' ? 'primärjourer' : 'bakjourer'} hittades`
                        : 'Kalendern är snart klar'}
                  </strong>
                  <small>
                    {schedule
                      ? duties.length
                        ? `${primaryCount} primär · ${backupCount} bakjour · heldagsaktiviteter`
                        : `${allDuties.length} jourer totalt för vald person`
                      : 'Välj först en Excel-fil och en person.'}
                  </small>
                </span>
              </div>
              <Button
                className="download-button"
                disabled={!duties.length}
                onClick={downloadCalendar}
              >
                <Download aria-hidden="true" />
                Skapa kalenderfil
              </Button>
            </div>
          </div>

          <aside className="preview-card" aria-labelledby="preview-title">
            <div className="preview-heading">
              <div>
                <p className="step-label">Förhandsvisning</p>
                <h2 id="preview-title">Så blir kalendern</h2>
              </div>
              <span className="calendar-badge">.ics</span>
            </div>

            <div className="calendar-page">
              <div className="calendar-topline">
                <span>{monthLabel}</span>
                <span>{schedule ? `${duties.length} ${duties.length === 1 ? 'JOUR' : 'JOURER'}` : '2 JOURER'}</span>
              </div>
              {previewDuties.length ? previewDuties.map(eventPreview) : (
                <div className="empty-preview">
                  <CalendarCheck aria-hidden="true" />
                  <strong>Inga jourer i urvalet</strong>
                  <span>Prova att välja Alla jourer eller en annan person.</span>
                </div>
              )}
              {schedule && duties.length > 3 && (
                <div className="more-events">+ {duties.length - 3} jourer till i kalenderfilen</div>
              )}
            </div>

            <div className="preview-note">
              <Info aria-hidden="true" />
              <p>
                <strong>Färdig för din kalender</strong>
                <span>Filen kan importeras i Apple Kalender, Outlook och Google Kalender.</span>
              </p>
            </div>
          </aside>
        </section>

        <section className="rules-card" aria-labelledby="rules-title">
          <div className="rules-heading">
            <p className="eyebrow">Det här läser appen</p>
            <h2 id="rules-title">Bara jourkolumnerna – inget annat</h2>
          </div>
          <div className="rule-list">
            <div><span className="column-letter">E</span><p><strong>Handkirurgi</strong><small>Kvälls- och helgjour</small></p></div>
            <div><span className="column-letter">F</span><p><strong>Plastikkirurgi</strong><small>Kvälls- och helgjour</small></p></div>
            <div><span className="slash-example">GA/PJ</span><p><strong>Ordningen avgör rollen</strong><small>GA är primär · PJ är bakjour</small></p></div>
            <div><span className="skip-icon">×</span><p><strong>Dagjour hoppas över</strong><small>Kolumn C och D tas inte med</small></p></div>
          </div>
        </section>
      </main>

      <footer>
        <span>Jourkalender</span>
        <span>All bearbetning sker lokalt i webbläsaren.</span>
      </footer>
    </div>
  );
}
