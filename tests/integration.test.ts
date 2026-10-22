import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {parseCsv} from '../src/lib/training/csv';
import {buildDashboard, DATA_FILES} from '../src/lib/training/dashboard';

function fixtureDocuments() {
  const readFixture = (name: string) => parseCsv(readFileSync(path.join(process.cwd(), 'tests', 'fixtures', name)));
  return {
    employees: readFixture(DATA_FILES.employees),
    catalog: readFixture(DATA_FILES.catalog),
    completions: readFixture(DATA_FILES.completions),
    trainingSessions: readFixture(DATA_FILES.trainingSessions),
  };
}

test('Evaluates training and plans without private fields', () => {
  const dashboard = buildDashboard(fixtureDocuments());
  const {evaluations, plan} = dashboard;
  assert.equal(dashboard.asOf, '2026-10-01');
  assert.deepEqual(evaluations.map((item) => [item.employeeId, item.state]), [
    ['E001', 'expiring'],
    ['E002', 'missing'],
  ]);

  assert.deepEqual(plan, {
    assignments: [{requirementId: 'E002:KYBER', employeeId: 'E002', trainingCode: 'KYBER', trainingSessionId: 'T001'}],
    unresolved: [{requirementId: 'E001:KYBER', reason: 'no-capacity'}],
  });
  assert.equal(evaluations[0].state, 'expiring', 'A proposed enrollment does not confirm completion.');
  const result = JSON.stringify(dashboard);
  assert.equal(result.includes('SOUKROMY-IDENTIFIKATOR'), false);
  assert.equal(result.includes('SOUKROMA-VOLNA-POZNAMKA'), false);
  assert.equal(result.includes('rodne_cislo'), false);
  assert.equal(result.includes('poznamka'), false);
  assert.equal(result.includes('email'), false);
});

test('Rejects exports with missing required columns', () => {
  const documents = fixtureDocuments();
  documents.employees.headers = documents.employees.headers.filter((name) => name !== 'id_zamestnance');

  assert.throws(() => buildDashboard(documents), /missing required columns/);
});

test('Rejects damaged completion exports', () => {
  const documents = fixtureDocuments();
  documents.completions = parseCsv(Buffer.from(
    'id_zaznamu,id_zamestnance,kod_skoleni,datum_absolvovani,platnost_do\n"unterminated',
  ));

  assert.throws(() => buildDashboard(documents), /invalid CSV structure/);
});
