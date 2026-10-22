import 'server-only';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {parseCsv} from './csv';
import {buildDashboard, DATA_FILES} from './dashboard';
import type {DashboardData} from './dashboard';

export async function loadDashboard(): Promise<DashboardData> {
  const readDocument = async (filename: string) =>
    parseCsv(await readFile(path.join(process.cwd(), 'data', filename)));

  const [employees, catalog, completions, trainingSessions] = await Promise.all([
    readDocument(DATA_FILES.employees),
    readDocument(DATA_FILES.catalog),
    readDocument(DATA_FILES.completions),
    readDocument(DATA_FILES.trainingSessions),
  ]);

  return buildDashboard({employees, catalog, completions, trainingSessions});
}
