import {evaluateTraining} from './compliance';
import {
  normalizeCatalog,
  normalizeCompletions,
  normalizeEmployees,
  normalizeTrainingSessions,
} from './normalize';
import {recommendAssignments} from './planning';
import type {
  CsvDocument,
  DataIssue,
  Employee,
  ISODate,
  RecommendationPlan,
  TrainingSession,
  TrainingDefinition,
  TrainingEvaluation,
  TrainingNeed,
} from './types';

export const EXPORT_DATE: ISODate = '2026-10-01';
export const DATA_FILES = {
  employees: 'zamestnanci.csv',
  catalog: 'katalog_skoleni.csv',
  completions: 'absolvovana_skoleni.csv',
  trainingSessions: 'terminy_skoleni.csv',
} as const;

export interface DashboardDocuments {
  employees: CsvDocument;
  catalog: CsvDocument;
  completions: CsvDocument;
  trainingSessions: CsvDocument;
}

export interface DashboardData {
  asOf: ISODate;
  employees: Employee[];
  trainings: TrainingDefinition[];
  evaluations: TrainingEvaluation[];
  trainingSessions: TrainingSession[];
  plan: RecommendationPlan;
  issues: Array<DataIssue & { source: string }>;
}

export function buildDashboard(documents: DashboardDocuments): DashboardData {
  const employees = normalizeEmployees(documents.employees);
  const catalog = normalizeCatalog(documents.catalog);
  const completions = normalizeCompletions(
    documents.completions,
    employees.items,
    catalog.items,
    EXPORT_DATE,
  );
  const trainingSessions = normalizeTrainingSessions(documents.trainingSessions, catalog.items);
  const imports = [
    {source: DATA_FILES.employees, issues: employees.issues},
    {source: DATA_FILES.catalog, issues: catalog.issues},
    {source: DATA_FILES.completions, issues: completions.issues},
    {source: DATA_FILES.trainingSessions, issues: trainingSessions.issues},
  ];
  const issues = imports.flatMap((result) =>
    result.issues.map((issue) => ({
      ...issue,
      source: result.source,
    })),
  );

  if (issues.some((issue) =>
    issue.code === 'MISSING_COLUMN' ||
    issue.code === 'DUPLICATE_HEADER' ||
    (issue.code === 'CSV_STRUCTURE' && issue.severity === 'error'),
  )) {
    throw new Error('The exports are missing required columns or contain invalid CSV structure or duplicate headers.');
  }

  // Include pairs without completion records so missing training is visible.
  const evaluations: TrainingEvaluation[] = [];
  const needs: TrainingNeed[] = [];

  for (const employee of employees.items) {
    for (const training of catalog.items) {
      const evaluation = evaluateTraining(
        employee,
        training,
        completions.items,
        {asOf: EXPORT_DATE, expiringWithinDays: 30},
      );
      evaluations.push(evaluation);

      if (
        evaluation.state === 'expired' ||
        evaluation.state === 'missing' ||
        evaluation.state === 'expiring'
      ) {
        needs.push({
          id: `${employee.id}:${training.code}`,
          employeeId: employee.id,
          trainingCode: training.code,
          state: evaluation.state,
          deadline: evaluation.validUntil,
          employmentEnd: employee.endDate,
        });
      }
    }
  }

  return {
    asOf: EXPORT_DATE,
    employees: employees.items,
    trainings: catalog.items,
    evaluations,
    trainingSessions: trainingSessions.items,
    plan: recommendAssignments(needs, trainingSessions.items, EXPORT_DATE),
    issues,
  };
}
