import assert from 'node:assert/strict';
import test from 'node:test';
import {addCalendarMonths, parseDate} from '../src/lib/training/dates';

test('Parses ISO dates', () => {
  for (const value of ['2026-10-01', '2024-02-29', '2000-02-29']) {
    assert.equal(parseDate(value), value);
  }
});

test('Parses Czech dates', () => {
  const examples = [
    ['3. 8. 2019', '2019-08-03'],
    ['3.8.2019', '2019-08-03'],
    ['01.10.2026', '2026-10-01'],
    ['29. 2. 2024', '2024-02-29'],
  ] as const;

  for (const [input, expected] of examples) {
    assert.equal(parseDate(input), expected, input);
  }
});

test('Converts Excel serial dates', () => {
  const examples = [
    ['1', '1900-01-01'],
    ['59', '1900-02-28'],
    ['61', '1900-03-01'],
    ['43552', '2019-03-28'],
  ] as const;

  for (const [input, expected] of examples) {
    assert.equal(parseDate(input), expected, input);
  }
});

test('Rejects invalid date formats and values', () => {
  const invalid = [
    '',
    '   ',
    '2026-02-29',
    '1900-02-29',
    '2026-04-31',
    '31. 2. 2026',
    '2026-13-01',
    '2026-00-01',
    '2026-10-00',
    '2026-1-01',
    '10/01/2026',
    '2026-10-01T00:00:00Z',
    '2026-10-01 extra',
    '60',
    '0',
    '-1',
    '43552.5',
    'not a date',
  ];

  for (const input of invalid) {
    assert.equal(parseDate(input), null, JSON.stringify(input));
  }
});

test('Clamps days to month end', () => {
  assert.equal(addCalendarMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addCalendarMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addCalendarMonths('2026-03-31', 1), '2026-04-30');
  assert.equal(addCalendarMonths('2026-01-31', 2), '2026-03-31');
});

test('Handles year boundaries and leap days', () => {
  assert.equal(addCalendarMonths('2026-12-15', 2), '2027-02-15');
  assert.equal(addCalendarMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(addCalendarMonths('2024-02-29', 48), '2028-02-29');
  assert.equal(addCalendarMonths('2026-10-01', 0), '2026-10-01');
});

test('Rejects invalid dates and month offsets', () => {
  for (const date of ['', '2026-02-30', '2026-13-01', '1. 10. 2026']) {
    assert.throws(() => addCalendarMonths(date, 1), RangeError, date);
  }
  for (const months of [0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => addCalendarMonths('2026-10-01', months), RangeError);
  }
});
