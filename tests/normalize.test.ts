import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  normalizeCatalog,
  normalizeCompletions,
  normalizeEmployees,
  normalizeTrainingSessions,
} from '../src/lib/training/normalize';
import {catalogRow, completionRow, csvDocument, employee, employeeRow, trainingSessionRow, training} from './helpers';

test('Normalizes employees and omits unused fields', () => {
  const result = normalizeEmployees(csvDocument([
    employeeRow({utvar: 'Laboratore', datum_nastupu: '1. 1. 2020'}),
    employeeRow({id_zamestnance: 'E002', utvar: 'SPRÁVA BUDOV'}),
    employeeRow({id_zamestnance: 'E003', utvar: 'Studijní'}),
    employeeRow({id_zamestnance: 'E004', utvar: ''}),
    employeeRow({id_zamestnance: 'E005', stav: 'ukončen', datum_ukonceni: '30. 9. 2026'}),
    employeeRow({id_zamestnance: 'E006', stav: 'rodičovská'}),
  ]));

  assert.deepEqual(result.items[0], employee());
  assert.deepEqual(result.items.slice(0, 4).map((item) => item.unit), ['Laboratoře', 'Správa budov', 'Studijní oddělení', null]);
  assert.deepEqual(result.items.map((item) => item.status), ['active', 'active', 'active', 'active', 'ended', 'parental-leave']);
  assert.equal(result.items[4]?.endDate, '2026-09-30');
  assert.ok(result.issues.some((issue) => issue.code === 'MISSING_UNIT'));
  const serialized = JSON.stringify(result);
  for (const value of ['email', 'rodne_cislo', 'poznamka', 'SOUKROMY-IDENTIFIKATOR', 'SOUKROMA-VOLNA-POZNAMKA']) {
    assert.equal(serialized.includes(value), false, value);
  }
});

test('Missing required columns stop table import', () => {
  const row = employeeRow();
  delete row.id_zamestnance;

  const result = normalizeEmployees(csvDocument([row]));

  assert.equal(result.items.length, 0);
  assert.ok(result.issues.some((issue) => issue.code === 'MISSING_COLUMN' && issue.field === 'id_zamestnance'));
});

test('Invalid employment dates require review', () => {
  const result = normalizeEmployees(csvDocument([
    employeeRow({datum_ukonceni: '31. 9. 2026'}),
    employeeRow({id_zamestnance: 'E002', datum_nastupu: 'not a date'}),
    employeeRow({id_zamestnance: 'E003', datum_ukonceni: '2019-12-31'}),
  ]));

  assert.ok(result.items.every((item) => item.status === 'unknown'));
  assert.equal(result.items[0]?.endDate, null);
  assert.equal(result.items[1]?.startDate, null);
  assert.equal(result.issues.filter((issue) => issue.code === 'INVALID_DATE').length, 3);
});

test('Catalog rules preserve unknown requirements and validity', () => {
  const result = normalizeCatalog(csvDocument([
    catalogRow(),
    catalogRow({kod: 'PRV-POM', povinne_pro: 'UTVAR:Laboratoře;Správa budov;Knihovna', platnost_mesicu: '36'}),
    catalogRow({kod: 'ZDVIH', povinne_pro: 'POZICE:Technik údržby', platnost_mesicu: '2 roky'}),
    catalogRow({kod: 'LEAD', povinne_pro: 'POZICE:Vedoucí', platnost_mesicu: '0'}),
    catalogRow({kod: 'ANGL', povinne_pro: 'NEPOVINNE', platnost_mesicu: ''}),
    catalogRow({kod: 'UNKNOWN', povinne_pro: 'JEN_NĚKDO', platnost_mesicu: ''}),
  ]));

  assert.deepEqual(result.items[0]?.requirement, {kind: 'all'});
  assert.deepEqual(result.items[0]?.validity, {kind: 'months', months: 12});
  assert.deepEqual(result.items[1]?.requirement, {kind: 'units', units: ['Laboratoře', 'Správa budov', 'Knihovna']});
  assert.deepEqual(result.items[2]?.requirement, {kind: 'positions', positions: ['Technik údržby']});
  assert.deepEqual(result.items[2]?.validity, {kind: 'months', months: 24});
  assert.deepEqual(result.items[3]?.validity, {kind: 'unlimited'});
  assert.deepEqual(result.items[4]?.requirement, {kind: 'optional'});
  assert.deepEqual(result.items[5]?.requirement, {kind: 'unknown'});
  assert.deepEqual(result.items[5]?.validity, {kind: 'unknown'});
  for (const code of ['ASSUMED_UNLIMITED_VALIDITY', 'UNKNOWN_REQUIREMENT', 'UNKNOWN_VALIDITY']) {
    assert.ok(result.issues.some((issue) => issue.code === code), code);
  }
});

test('Completions normalize aliases and reject unknown references', () => {
  const header = Object.fromEntries(Object.keys(completionRow()).map((field) => [field, field]));
  const result = normalizeCompletions(csvDocument([
    completionRow({kod_skoleni: ' kyber ', zamestnanec: 'JINÉ JMÉNO'}),
    ...['BOZP_Z', 'BOZP Z', 'POZ_OCH', 'POZ OCH'].map((code, index) => completionRow({
      id_zaznamu: `Z${index + 2}`,
      kod_skoleni: code,
    })),
    completionRow({id_zaznamu: 'Z900', id_zamestnance: 'E9001'}),
    completionRow({id_zaznamu: 'Z901', kod_skoleni: 'KYB3R'}),
    header,
    completionRow({id_zaznamu: '# exportní informace'}),
    completionRow({id_zaznamu: 'Celkem'}),
  ]), [employee()], [training(), training({code: 'BOZP-Z'}), training({code: 'POZ-OCH'})], '2026-10-01');

  assert.deepEqual(result.items.map((item) => item.trainingCode), ['KYBER', 'BOZP-Z', 'BOZP-Z', 'POZ-OCH', 'POZ-OCH']);
  assert.ok(result.items.every((item) => item.employeeId === 'E001'));
  assert.ok(result.issues.some((issue) => issue.code === 'UNKNOWN_EMPLOYEE'));
  assert.ok(result.issues.some((issue) => issue.code === 'UNKNOWN_TRAINING'));
  assert.equal(result.issues.filter((issue) => issue.code === 'METADATA_ROW').length, 3);
});

test('Explicit expiry overrides inferred expiry', () => {
  const result = normalizeCompletions(csvDocument([
    completionRow({id_zaznamu: 'Z001', platnost_do: ''}),
    completionRow({id_zaznamu: 'Z002', platnost_do: '2029-01-01'}),
    completionRow({id_zaznamu: 'Z003', platnost_do: '31. 2. 2027'}),
  ]), [employee()], [training()], '2026-10-01');

  assert.equal(result.items[0]?.validUntil, '2027-01-01');
  assert.equal(result.items[1]?.validUntil, '2029-01-01');
  assert.equal(result.items[1]?.quality, 'valid');
  assert.equal(result.items[2]?.validUntil, null);
  assert.equal(result.items[2]?.quality, 'invalid');
  assert.equal(result.issues.filter((issue) => issue.code === 'INFERRED_EXPIRY').length, 1);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_DATE' && issue.field === 'platnost_do'));
});

test('Invalid completions remain flagged without notes', () => {
  const result = normalizeCompletions(csvDocument([
    completionRow({id_zaznamu: 'Z001', platnost_do: '2025-01-01'}),
    completionRow({id_zaznamu: 'Z002', datum_absolvovani: '27.10.2026', platnost_do: '27.10.2027'}),
    completionRow({id_zaznamu: 'Z003', datum_absolvovani: '31. 9. 2026'}),
    completionRow({id_zaznamu: 'Z004', datum_absolvovani: '1900-01-01', platnost_do: '1901-01-01'}),
  ]), [employee()], [training()], '2026-10-01');

  assert.equal(result.items.length, 4);
  assert.ok(result.items.every((item) => item.quality === 'invalid'));
  assert.equal(result.items[2]?.completedOn, null);
  assert.equal(result.items[3]?.completedOn, '1900-01-01');
  for (const code of ['INVALID_COMPLETION', 'FUTURE_COMPLETION', 'INVALID_DATE', 'SUSPICIOUS_DATE']) {
    assert.ok(result.issues.some((issue) => issue.code === code), code);
  }
  assert.equal(JSON.stringify(result).includes('SOUKROMA-VOLNA-POZNAMKA'), false);
  assert.equal(JSON.stringify(result).includes('poznamka'), false);
});

test('Duplicate completion IDs merge after date normalization', () => {
  const result = normalizeCompletions(csvDocument([
    completionRow(),
    completionRow({datum_absolvovani: '1. 1. 2026', platnost_do: '01.01.2027'}),
  ]), [employee()], [training()], '2026-10-01');

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.id, 'Z001');
  assert.ok(result.issues.some((issue) => issue.code === 'DUPLICATE_RECORD'));
});

test('Sessions validate dates, capacity and references', () => {
  const result = normalizeTrainingSessions(csvDocument([
    trainingSessionRow(),
    trainingSessionRow({id_terminu: 'T002', datum: '31. 9. 2026'}),
    trainingSessionRow({id_terminu: 'T003', kapacita: '30', obsazeno: '31'}),
    trainingSessionRow({id_terminu: 'T004', stav: 'zrušeno'}),
    trainingSessionRow({id_terminu: 'T005', kod_skoleni: 'KYB3R'}),
  ]), [training()]);

  assert.equal(result.items[0]?.date, '2026-10-14');
  assert.equal(result.items[0]?.time, '09:00-12:00');
  assert.equal(result.items.find((item) => item.id === 'T002')?.status, 'invalid');
  assert.equal(result.items.find((item) => item.id === 'T003')?.status, 'invalid');
  assert.equal(result.items.find((item) => item.id === 'T003')?.occupied, 31);
  assert.equal(result.items.find((item) => item.id === 'T004')?.status, 'cancelled');
  assert.equal(result.items.some((item) => item.id === 'T005'), false);
  for (const code of ['INVALID_DATE', 'INVALID_CAPACITY', 'UNKNOWN_TRAINING']) {
    assert.ok(result.issues.some((issue) => issue.code === code), code);
  }
});

test('Duplicate sessions contribute capacity only once', () => {
  const result = normalizeTrainingSessions(csvDocument([
    trainingSessionRow({id_terminu: 'T003'}),
    trainingSessionRow({id_terminu: 'T009'}),
  ]), [training()]);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.id, 'T003');
  assert.ok(result.issues.some((issue) => issue.code === 'DUPLICATE_RECORD'));
});
