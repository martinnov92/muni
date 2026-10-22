import {addCalendarMonths, parseDate} from './dates';
import type {
  Completion,
  CsvDocument,
  CsvRow,
  DataIssue,
  Employee,
  ImportResult,
  ISODate,
  RequirementRule,
  TrainingSession,
  TrainingDefinition,
  ValidityRule,
} from './types';

function text(row: CsvRow, field: string): string {
  return (row[field] ?? '').trim();
}

function comparisonKey(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizeUnit(value: string): string | null {
  const aliases: Record<string, string> = {
    'studijni': 'Studijní oddělení',
    'studijni oddeleni': 'Studijní oddělení',
    'ekonomicke oddeleni': 'Ekonomické oddělení',
    'it oddeleni': 'IT oddělení',
    'knihovna': 'Knihovna',
    'sprava budov': 'Správa budov',
    'laboratore': 'Laboratoře',
    'personalni oddeleni': 'Personální oddělení',
    'vedeni': 'Vedení',
    'marketing': 'Marketing',
  };
  return value ? aliases[comparisonKey(value)] ?? value : null;
}

function normalizeTrainingCode(value: string): string {
  const code = value.toUpperCase();
  const aliases: Record<string, string> = {
    'BOZP_Z': 'BOZP-Z',
    'BOZP Z': 'BOZP-Z',
    'POZ_OCH': 'POZ-OCH',
    'POZ OCH': 'POZ-OCH',
  };
  return aliases[code] ?? code;
}

function hasRequiredColumns(document: CsvDocument, fields: string[], issues: DataIssue[]): boolean {
  const missing = fields.filter((field) => !document.headers.includes(field));

  for (const field of missing) {
    issues.push({code: 'MISSING_COLUMN', severity: 'error', field});
  }

  return missing.length === 0 && !issues.some((issue) => issue.code === 'DUPLICATE_HEADER');
}

function isMetadata(row: CsvRow, idField: string): boolean {
  const id = text(row, idField);

  return id.startsWith('#') || comparisonKey(id) === 'celkem' || id === idField;
}

function readDate(row: CsvRow, field: string, rowNumber: number, issues: DataIssue[]): ISODate | null {
  const value = text(row, field);
  const date = parseDate(value);

  if (value && date === null) {
    issues.push({code: 'INVALID_DATE', severity: 'error', row: rowNumber, field});
  }

  return date;
}

export function normalizeEmployees(document: CsvDocument): ImportResult<Employee> {
  const issues = [...document.issues];
  const items: Employee[] = [];
  const fields = ['id_zamestnance', 'jmeno', 'prijmeni', 'utvar', 'pozice', 'datum_nastupu', 'datum_ukonceni', 'stav'];

  if (!hasRequiredColumns(document, fields, issues)) {
    return {items, issues};
  }

  const ids = new Set<string>();

  for (const [index, row] of document.rows.entries()) {
    const rowNumber = index + 2;

    if (isMetadata(row, 'id_zamestnance')) {
      issues.push({code: 'METADATA_ROW', severity: 'info', row: rowNumber});
      continue;
    }

    const id = text(row, 'id_zamestnance');

    if (!id) {
      issues.push({code: 'CSV_STRUCTURE', severity: 'error', row: rowNumber, field: 'id_zamestnance'});
      continue;
    }

    if (ids.has(id)) {
      issues.push({code: 'DUPLICATE_RECORD', severity: 'warning', row: rowNumber});
      continue;
    }

    ids.add(id);

    const unit = normalizeUnit(text(row, 'utvar'));

    if (!unit) {
      issues.push({code: 'MISSING_UNIT', severity: 'warning', row: rowNumber, field: 'utvar'});
    }

    const startDate = readDate(row, 'datum_nastupu', rowNumber, issues);
    const endDate = readDate(row, 'datum_ukonceni', rowNumber, issues);
    const statuses: Record<string, Employee['status']> = {
      'aktivni': 'active',
      'ukoncen': 'ended',
      'rodicovska': 'parental-leave',
    };
    let status = statuses[comparisonKey(text(row, 'stav'))] ?? 'unknown';

    if (status === 'unknown') {
      issues.push({code: 'CSV_STRUCTURE', severity: 'warning', row: rowNumber, field: 'stav'});
    }

    // Do not treat an unreadable employment boundary as an unlimited active contract.
    if ((text(row, 'datum_nastupu') && !startDate) || (text(row, 'datum_ukonceni') && !endDate)) {
      status = 'unknown';
    }

    if (startDate && endDate && endDate < startDate) {
      status = 'unknown';
      issues.push({code: 'INVALID_DATE', severity: 'error', row: rowNumber, field: 'datum_ukonceni'});
    }

    items.push({
      id,
      givenName: text(row, 'jmeno'),
      familyName: text(row, 'prijmeni'),
      unit,
      position: text(row, 'pozice') || null,
      startDate,
      endDate,
      status,
    });
  }

  return {items, issues};
}

function readRequirement(value: string): RequirementRule {
  const key = comparisonKey(value);

  if (key === 'vsichni') {
    return {kind: 'all'};
  }

  if (key === 'nepovinne') {
    return {kind: 'optional'};
  }

  const separator = value.indexOf(':');
  const prefix = comparisonKey(value.slice(0, separator));
  const values = value.slice(separator + 1).split(';').map((part) => part.trim()).filter(Boolean);

  if (separator !== -1 && values.length > 0) {
    if (prefix === 'utvar') {
      return {kind: 'units', units: values.map((unit) => normalizeUnit(unit) ?? unit)};
    }

    if (prefix === 'pozice') {
      return {kind: 'positions', positions: values};
    }
  }

  return {kind: 'unknown'};
}

function readValidity(value: string): ValidityRule {
  if (value === '0') {
    return {kind: 'unlimited'};
  }

  if (comparisonKey(value) === '2 roky') {
    return {kind: 'months', months: 24};
  }

  if (/^\d+$/.test(value)) {
    const months = Number(value);
    if (Number.isSafeInteger(months) && months > 0) {
      return {kind: 'months', months};
    }
  }

  return {kind: 'unknown'};
}

export function normalizeCatalog(document: CsvDocument): ImportResult<TrainingDefinition> {
  const issues = [...document.issues];
  const items: TrainingDefinition[] = [];

  if (!hasRequiredColumns(document, ['kod', 'nazev', 'platnost_mesicu', 'povinne_pro'], issues)) {
    return {items, issues};
  }

  const codes = new Set<string>();

  for (const [index, row] of document.rows.entries()) {
    const rowNumber = index + 2;

    if (isMetadata(row, 'kod')) {
      issues.push({code: 'METADATA_ROW', severity: 'info', row: rowNumber});

      continue;
    }

    const code = normalizeTrainingCode(text(row, 'kod'));

    if (!code) {
      issues.push({code: 'CSV_STRUCTURE', severity: 'error', row: rowNumber, field: 'kod'});

      continue;
    }

    if (codes.has(code)) {
      issues.push({code: 'DUPLICATE_RECORD', severity: 'warning', row: rowNumber});

      continue;
    }

    codes.add(code);

    const requirement = readRequirement(text(row, 'povinne_pro'));
    const validity = readValidity(text(row, 'platnost_mesicu'));

    if (requirement.kind === 'unknown') {
      issues.push({code: 'UNKNOWN_REQUIREMENT', severity: 'warning', row: rowNumber, field: 'povinne_pro'});
    }

    if (validity.kind === 'unknown') {
      issues.push({code: 'UNKNOWN_VALIDITY', severity: 'warning', row: rowNumber, field: 'platnost_mesicu'});
    }

    if (validity.kind === 'unlimited') {
      issues.push({code: 'ASSUMED_UNLIMITED_VALIDITY', severity: 'warning', row: rowNumber, field: 'platnost_mesicu'});
    }

    items.push({code, name: text(row, 'nazev') || code, requirement, validity});
  }

  return {items, issues};
}

export function normalizeCompletions(
  document: CsvDocument,
  employees: readonly Employee[],
  trainings: readonly TrainingDefinition[],
  asOf: ISODate,
): ImportResult<Completion> {
  const issues = [...document.issues];
  const items: Completion[] = [];
  const fields = ['id_zaznamu', 'id_zamestnance', 'kod_skoleni', 'datum_absolvovani', 'platnost_do'];

  if (!hasRequiredColumns(document, fields, issues)) {
    return {items, issues};
  }

  const employeeIds = new Set(employees.map((employee) => employee.id));
  const definitions = new Map(trainings.map((training) => [training.code, training]));
  const seen = new Map<string, Completion[]>();

  for (const [index, row] of document.rows.entries()) {
    const rowNumber = index + 2;

    if (isMetadata(row, 'id_zaznamu')) {
      issues.push({code: 'METADATA_ROW', severity: 'info', row: rowNumber});
      continue;
    }

    const id = text(row, 'id_zaznamu');

    if (!id) {
      issues.push({code: 'CSV_STRUCTURE', severity: 'error', row: rowNumber, field: 'id_zaznamu'});
      continue;
    }

    const employeeId = text(row, 'id_zamestnance');
    const trainingCode = normalizeTrainingCode(text(row, 'kod_skoleni'));
    const definition = definitions.get(trainingCode);

    if (!employeeIds.has(employeeId)) {
      issues.push({code: 'UNKNOWN_EMPLOYEE', severity: 'error', row: rowNumber, field: 'id_zamestnance'});

      continue;
    }

    if (!definition) {
      issues.push({code: 'UNKNOWN_TRAINING', severity: 'error', row: rowNumber, field: 'kod_skoleni'});

      continue;
    }

    const completedOnValue = text(row, 'datum_absolvovani');
    const validUntilValue = text(row, 'platnost_do');
    const completedOn = readDate(row, 'datum_absolvovani', rowNumber, issues);
    let validUntil = readDate(row, 'platnost_do', rowNumber, issues);
    let quality: Completion['quality'] = completedOn ? 'valid' : 'invalid';

    if (!completedOnValue) {
      issues.push({code: 'INVALID_DATE', severity: 'error', row: rowNumber, field: 'datum_absolvovani'});
    }

    if (validUntilValue && !validUntil) {
      quality = 'invalid';
    }

    if (!validUntilValue && completedOn && definition.validity.kind === 'months') {
      try {
        validUntil = addCalendarMonths(completedOn, definition.validity.months);
        issues.push({code: 'INFERRED_EXPIRY', severity: 'info', row: rowNumber, field: 'platnost_do'});
      } catch (error) {
        if (!(error instanceof RangeError)) {
          throw error;
        }

        quality = 'invalid';
        issues.push({code: 'INVALID_DATE', severity: 'error', row: rowNumber, field: 'platnost_do'});
      }
    }

    if (completedOn && completedOn > asOf) {
      quality = 'invalid';
      issues.push({code: 'FUTURE_COMPLETION', severity: 'error', row: rowNumber, field: 'datum_absolvovani'});
    }

    if (completedOn === '1900-01-01' || validUntil === '1900-01-01') {
      quality = 'invalid';
      issues.push({code: 'SUSPICIOUS_DATE', severity: 'error', row: rowNumber});
    }

    if (completedOn && validUntil && validUntil < completedOn) {
      quality = 'invalid';
    }

    if (quality === 'invalid') {
      issues.push({code: 'INVALID_COMPLETION', severity: 'error', row: rowNumber});
    }

    const item: Completion = {id, employeeId, trainingCode, completedOn, validUntil, quality};
    const previous = seen.get(id) ?? [];

    if (previous.some((completion) => JSON.stringify(completion) === JSON.stringify(item))) {
      issues.push({code: 'DUPLICATE_RECORD', severity: 'warning', row: rowNumber});
      continue;
    }

    // Conflicting records with one ID require review rather than an arbitrary winner.
    if (previous.length > 0) {
      for (const completion of previous) {
        completion.quality = 'invalid';
      }

      item.quality = 'invalid';
      issues.push({code: 'DUPLICATE_RECORD', severity: 'error', row: rowNumber});
    }

    seen.set(id, [...previous, item]);
    items.push(item);
  }

  return {items, issues};
}

function nonnegativeInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const number = Number(value);

  return Number.isSafeInteger(number) ? number : null;
}

export function normalizeTrainingSessions(
  document: CsvDocument,
  trainings: readonly TrainingDefinition[],
): ImportResult<TrainingSession> {
  const issues = [...document.issues];
  const items: TrainingSession[] = [];
  const fields = ['id_terminu', 'kod_skoleni', 'datum', 'cas', 'misto', 'kapacita', 'obsazeno', 'stav'];

  if (!hasRequiredColumns(document, fields, issues)) {
    return {items, issues};
  }

  const trainingCodes = new Set(trainings.map((training) => training.code));
  const seen = new Set<string>();

  for (const [index, row] of document.rows.entries()) {
    const rowNumber = index + 2;

    if (isMetadata(row, 'id_terminu')) {
      issues.push({code: 'METADATA_ROW', severity: 'info', row: rowNumber});
      continue;
    }

    const id = text(row, 'id_terminu');

    if (!id) {
      issues.push({code: 'CSV_STRUCTURE', severity: 'error', row: rowNumber, field: 'id_terminu'});
      continue;
    }

    const trainingCode = normalizeTrainingCode(text(row, 'kod_skoleni'));

    if (!trainingCodes.has(trainingCode)) {
      issues.push({code: 'UNKNOWN_TRAINING', severity: 'error', row: rowNumber, field: 'kod_skoleni'});
      continue;
    }

    const date = readDate(row, 'datum', rowNumber, issues);
    const capacity = nonnegativeInteger(text(row, 'kapacita'));
    const occupied = nonnegativeInteger(text(row, 'obsazeno'));
    const state = comparisonKey(text(row, 'stav'));
    let status: TrainingSession['status'] = state === 'planovano' ? 'scheduled' : state === 'zruseno' ? 'cancelled' : 'invalid';

    if (!date) {
      status = 'invalid';

      if (!text(row, 'datum')) {
        issues.push({code: 'INVALID_DATE', severity: 'error', row: rowNumber, field: 'datum'});
      }
    }

    if (capacity === null || occupied === null || occupied > capacity) {
      status = 'invalid';
      issues.push({code: 'INVALID_CAPACITY', severity: 'error', row: rowNumber});
    }

    if (state !== 'planovano' && state !== 'zruseno') {
      issues.push({code: 'CSV_STRUCTURE', severity: 'warning', row: rowNumber, field: 'stav'});
    }

    const item: TrainingSession = {
      id,
      trainingCode,
      date,
      time: text(row, 'cas'),
      location: text(row, 'misto'),
      capacity,
      occupied,
      status
    };

    const trainingSessionKey = JSON.stringify([
      item.trainingCode,
      item.date,
      item.time,
      item.location,
      item.capacity,
      item.occupied,
      item.status,
    ]);

    if (seen.has(trainingSessionKey)) {
      issues.push({code: 'DUPLICATE_RECORD', severity: 'warning', row: rowNumber});
      continue;
    }

    seen.add(trainingSessionKey);
    items.push(item);
  }

  return {items, issues};
}
