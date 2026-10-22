import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeCsv, parseCsv} from '../src/lib/training/csv';

test('Decodes Czech UTF-8 text', () => {
  const text = 'kod,nazev\nKYBER,Kybernetická bezpečnost\n';
  assert.deepEqual(decodeCsv(Buffer.from(text, 'utf8')), {
    text,
    encoding: 'utf-8',
    usedFallback: false,
  });
});

test('Removes the UTF-8 BOM', () => {
  const text = 'id_zamestnance,jmeno\nE001,Testovací\n';
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]);
  assert.equal(decodeCsv(bytes).text, text);
  assert.deepEqual(parseCsv(bytes).headers, ['id_zamestnance', 'jmeno']);
});

test('Decodes and flags Windows-1250', () => {
  const text = 'kod;nazev\nKYBER;Školení zaměstnanců: bezpečnost při práci.\n';
  // Enough Czech text to distinguish CP1250 from CP1252.
  const bytes = Buffer.from(
    '6b6f643b6e617a65760a4b594245523b8a6b6f6c656eed207a616dec73746e616e63' +
    'f93a2062657a7065e86e6f73742070f869207072e163692e0a',
    'hex',
  );

  assert.deepEqual(decodeCsv(bytes), {
    text,
    encoding: 'windows-1250',
    usedFallback: true,
  });
  const parsed = parseCsv(bytes);
  assert.equal(parsed.encoding, 'windows-1250');
  assert.ok(parsed.issues.some((issue) => issue.code === 'FALLBACK_ENCODING'));
});

test('Detects the CSV delimiter', () => {
  for (const delimiter of [',', ';', '\t', '|'] as const) {
    const parsed = parseCsv(Buffer.from(`id${delimiter}kod\r\n001${delimiter}KYBER\r\n\r\n`));
    assert.equal(parsed.delimiter, delimiter);
    assert.deepEqual(parsed.rows, [{id: '001', kod: 'KYBER'}]);
    assert.equal(parsed.issues.length, 0);
  }
});

test('Parses quoted and multiline cells', () => {
  const csv = 'id,nazev,poznamka\n001,"Kurz, základní","Řekl ""ano"";\na pokračoval"\n';
  const parsed = parseCsv(Buffer.from(csv));
  assert.equal(parsed.delimiter, ',');
  assert.deepEqual(parsed.rows, [{id: '001', nazev: 'Kurz, základní', poznamka: 'Řekl "ano";\na pokračoval'}]);
});

test('Keeps CSV values as text', () => {
  const parsed = parseCsv(Buffer.from('id;cena_kc\n001;0,00\n'));
  assert.deepEqual(parsed.rows, [{id: '001', cena_kc: '0,00'}]);
});

test('Rejects duplicate headers', () => {
  const parsed = parseCsv(Buffer.from('id,id\nE001,E002\n'));
  assert.equal(parsed.rows.length, 0);
  assert.ok(parsed.issues.some((issue) => issue.code === 'DUPLICATE_HEADER' && issue.severity === 'error'));
});

test('Reports mismatched field counts', () => {
  const parsed = parseCsv(Buffer.from('id,kod\nE001,KYBER,navic\n'));
  assert.ok(parsed.issues.some((issue) => issue.code === 'CSV_STRUCTURE' && issue.severity === 'error'));
});
