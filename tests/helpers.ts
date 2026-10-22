import type {
  Completion,
  CsvDocument,
  CsvRow,
  Employee,
  TrainingSession,
  TrainingDefinition,
  TrainingNeed,
} from '../src/lib/training/types';

export function csvDocument(rows: CsvRow[], headers = Object.keys(rows[0] ?? {})): CsvDocument {
  return {encoding: 'utf-8', delimiter: ',', headers, rows, issues: []};
}

export function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'E001',
    givenName: 'Testovací',
    familyName: 'Osoba',
    unit: 'Laboratoře',
    position: 'Specialista',
    startDate: '2020-01-01',
    endDate: null,
    status: 'active',
    ...overrides,
  };
}

export function training(overrides: Partial<TrainingDefinition> = {}): TrainingDefinition {
  return {
    code: 'KYBER',
    name: 'Kybernetická bezpečnost',
    requirement: {kind: 'all'},
    validity: {kind: 'months', months: 12},
    ...overrides,
  };
}

export function completion(overrides: Partial<Completion> = {}): Completion {
  return {
    id: 'Z001',
    employeeId: 'E001',
    trainingCode: 'KYBER',
    completedOn: '2026-01-01',
    validUntil: '2027-01-01',
    quality: 'valid',
    ...overrides,
  };
}

export function trainingSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 'T001',
    trainingCode: 'KYBER',
    date: '2026-10-14',
    time: '09:00-12:00',
    location: 'Aula A',
    capacity: 25,
    occupied: 22,
    status: 'scheduled',
    ...overrides,
  };
}

export function need(overrides: Partial<TrainingNeed> = {}): TrainingNeed {
  return {
    id: 'E001:KYBER',
    employeeId: 'E001',
    trainingCode: 'KYBER',
    state: 'expiring',
    deadline: '2026-10-15',
    employmentEnd: null,
    ...overrides,
  };
}

export function employeeRow(overrides: CsvRow = {}): CsvRow {
  return {
    id_zamestnance: 'E001',
    jmeno: 'Testovací',
    prijmeni: 'Osoba',
    email: 'test@vzorova.example',
    utvar: 'Laboratoře',
    pozice: 'Specialista',
    vedouci_email: 'vedouci@vzorova.example',
    datum_nastupu: '2020-01-01',
    datum_ukonceni: '',
    stav: 'aktivní',
    rodne_cislo: 'SOUKROMY-IDENTIFIKATOR',
    poznamka: 'SOUKROMA-VOLNA-POZNAMKA',
    ...overrides,
  };
}

export function catalogRow(overrides: CsvRow = {}): CsvRow {
  return {
    kod: 'KYBER',
    nazev: 'Kybernetická bezpečnost',
    platnost_mesicu: '12',
    povinne_pro: 'VSICHNI',
    poznamka: '',
    ...overrides,
  };
}

export function completionRow(overrides: CsvRow = {}): CsvRow {
  return {
    id_zaznamu: 'Z001',
    id_zamestnance: 'E001',
    zamestnanec: 'Osoba Testovací',
    kod_skoleni: 'KYBER',
    datum_absolvovani: '2026-01-01',
    platnost_do: '2027-01-01',
    poskytovatel: 'Interní školitel',
    cena_kc: '0,00',
    poznamka: 'SOUKROMA-VOLNA-POZNAMKA',
    ...overrides,
  };
}

export function trainingSessionRow(overrides: CsvRow = {}): CsvRow {
  return {
    id_terminu: 'T001',
    kod_skoleni: 'KYBER',
    datum: '2026-10-14',
    cas: '09:00-12:00',
    misto: 'Aula A',
    kapacita: '25',
    obsazeno: '22',
    cena_na_osobu: '800',
    stav: 'plánováno',
    ...overrides,
  };
}
