/** Validated YYYY-MM-DD date, without time. */
export type ISODate = string;

export type CsvEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1250';
export type CsvDelimiter = ',' | ';' | '\t' | '|';
export type CsvRow = Record<string, string>;

export type IssueCode =
  | 'FALLBACK_ENCODING'
  | 'CSV_STRUCTURE'
  | 'DUPLICATE_HEADER'
  | 'MISSING_COLUMN'
  | 'METADATA_ROW'
  | 'DUPLICATE_RECORD'
  | 'UNKNOWN_EMPLOYEE'
  | 'UNKNOWN_TRAINING'
  | 'INVALID_DATE'
  | 'SUSPICIOUS_DATE'
  | 'MISSING_UNIT'
  | 'UNKNOWN_REQUIREMENT'
  | 'UNKNOWN_VALIDITY'
  | 'ASSUMED_UNLIMITED_VALIDITY'
  | 'INVALID_COMPLETION'
  | 'FUTURE_COMPLETION'
  | 'INFERRED_EXPIRY'
  | 'INVALID_CAPACITY';

export interface DataIssue {
  code: IssueCode;
  severity: 'info' | 'warning' | 'error';
  row?: number;
  field?: string;
}

export interface DecodedCsv {
  text: string;
  encoding: CsvEncoding;
  /** Windows-1250 is an assumption, not a certainty. */
  usedFallback: boolean;
}

export interface CsvDocument {
  encoding: CsvEncoding;
  delimiter: CsvDelimiter;
  headers: string[];
  rows: CsvRow[];
  issues: DataIssue[];
}

export interface ImportResult<T> {
  items: T[];
  issues: DataIssue[];
}

export interface Employee {
  id: string;
  givenName: string;
  familyName: string;
  unit: string | null;
  position: string | null;
  startDate: ISODate | null;
  endDate: ISODate | null;
  status: 'active' | 'ended' | 'parental-leave' | 'unknown';
}

export type RequirementRule =
  | { kind: 'all' }
  | { kind: 'units'; units: string[] }
  | { kind: 'positions'; positions: string[] }
  | { kind: 'optional' }
  | { kind: 'unknown' };

export type ValidityRule =
  | { kind: 'months'; months: number }
  | { kind: 'unlimited' }
  | { kind: 'unknown' };

export interface TrainingDefinition {
  code: string;
  name: string;
  requirement: RequirementRule;
  validity: ValidityRule;
}

export interface Completion {
  id: string;
  employeeId: string;
  trainingCode: string;
  completedOn: ISODate | null;
  validUntil: ISODate | null;
  quality: 'valid' | 'invalid';
}

export interface TrainingSession {
  id: string;
  trainingCode: string;
  date: ISODate | null;
  /** Display only; availability is checked manually. */
  time: string;
  location: string;
  capacity: number | null;
  occupied: number | null;
  status: 'scheduled' | 'cancelled' | 'invalid';
}

export interface EvaluationOptions {
  asOf: ISODate;
  expiringWithinDays: number;
}

export type TrainingState =
  | 'valid'
  | 'expiring'
  | 'expired'
  | 'missing'
  | 'unknown'
  | 'not-required'
  | 'inactive';

export interface TrainingEvaluation {
  employeeId: string;
  trainingCode: string;
  state: TrainingState;
  validUntil: ISODate | null;
  completionId: string | null;
}

export interface TrainingNeed {
  id: string;
  employeeId: string;
  trainingCode: string;
  state: 'expired' | 'missing' | 'expiring';
  deadline: ISODate | null;
  employmentEnd: ISODate | null;
}

export interface Assignment {
  requirementId: string;
  employeeId: string;
  trainingCode: string;
  trainingSessionId: string;
}

export interface UnresolvedNeed {
  requirementId: string;
  reason: 'no-session' | 'no-capacity';
}

export interface RecommendationPlan {
  assignments: Assignment[];
  unresolved: UnresolvedNeed[];
}
