import assert from 'node:assert/strict';
import test from 'node:test';
import {
  employmentState,
  evaluateTraining,
  requirementFor,
} from '../src/lib/training/compliance';
import type {EvaluationOptions} from '../src/lib/training/types';
import {completion, employee, training} from './helpers';

const options: EvaluationOptions = {
  asOf: '2026-10-01',
  expiringWithinDays: 30,
};

test('Employment dates and status determine eligibility', () => {
  const person = employee({startDate: '2026-10-01', endDate: '2026-10-31'});

  assert.equal(employmentState(person, '2026-09-30'), 'inactive');
  assert.equal(employmentState(person, '2026-10-01'), 'active');
  assert.equal(employmentState(person, '2026-10-31'), 'active');
  assert.equal(employmentState(person, '2026-11-01'), 'inactive');
  assert.equal(employmentState(employee({endDate: null}), options.asOf), 'active');

  for (const status of ['ended', 'parental-leave'] as const) {
    assert.equal(employmentState(employee({status}), options.asOf), 'inactive');
  }
  assert.equal(employmentState(employee({startDate: null}), options.asOf), 'unknown');
  assert.equal(employmentState(employee({status: 'unknown'}), options.asOf), 'unknown');
});

test('Checks requirements and missing employee fields', () => {
  const person = employee({unit: null, position: null});

  assert.equal(requirementFor(person, training({requirement: {kind: 'all'}})), 'required');
  assert.equal(requirementFor(person, training({requirement: {kind: 'optional'}})), 'not-required');

  const unitRule = training({
    requirement: {kind: 'units', units: ['Laboratoře', 'Správa budov', 'Knihovna']},
  });
  for (const unit of ['Laboratoře', 'Správa budov', 'Knihovna']) {
    assert.equal(requirementFor(employee({unit, position: null}), unitRule), 'required', unit);
  }
  assert.equal(requirementFor(employee({unit: 'Marketing'}), unitRule), 'not-required');
  assert.equal(requirementFor(employee({unit: null}), unitRule), 'unknown');

  const positionRule = training({
    requirement: {kind: 'positions', positions: ['Řidič', 'Technik údržby']},
  });
  for (const position of ['Řidič', 'Technik údržby']) {
    assert.equal(requirementFor(employee({unit: null, position}), positionRule), 'required', position);
  }
  assert.equal(requirementFor(employee({position: 'Referent'}), positionRule), 'not-required');
  assert.equal(requirementFor(employee({position: null}), positionRule), 'unknown');
  assert.equal(requirementFor(person, training({requirement: {kind: 'unknown'}})), 'unknown');
});

test('Distinguishes missing, optional and inactive training', () => {
  assert.deepEqual(evaluateTraining(employee(), training(), [], options), {
    employeeId: 'E001',
    trainingCode: 'KYBER',
    state: 'missing',
    validUntil: null,
    completionId: null,
  });
  assert.equal(
    evaluateTraining(employee(), training({requirement: {kind: 'optional'}}), [], options).state,
    'not-required',
  );
  assert.equal(
    evaluateTraining(employee({startDate: '2026-10-15'}), training(), [], options).state,
    'inactive',
  );
});

test('Completions must match employee and training', () => {
  const unrelated = [
    completion({employeeId: 'E002', quality: 'invalid', completedOn: null}),
    completion({trainingCode: 'GDPR', quality: 'invalid', completedOn: null}),
  ];

  assert.equal(evaluateTraining(employee(), training(), unrelated, options).state, 'missing');
  assert.equal(
    evaluateTraining(employee(), training(), [...unrelated, completion()], options).state,
    'valid',
  );
});

test('Latest valid completion determines training status', () => {
  const records = [
    completion({id: 'Z001', completedOn: '2026-01-01', validUntil: '2027-01-01'}),
    completion({id: 'Z002', completedOn: '2026-09-01', validUntil: '2026-10-15'}),
  ];

  for (const order of [records, [...records].reverse()]) {
    assert.deepEqual(evaluateTraining(employee(), training(), order, options), {
      employeeId: 'E001',
      trainingCode: 'KYBER',
      state: 'expiring',
      validUntil: '2026-10-15',
      completionId: 'Z002',
    });
  }
});

test('Expiry and warning boundaries are inclusive', () => {
  const examples = [
    {validUntil: '2026-09-30', expected: 'expired'},
    {validUntil: '2026-10-01', expected: 'expiring'},
    {validUntil: '2026-10-31', expected: 'expiring'},
    {validUntil: '2026-11-01', expected: 'valid'},
  ] as const;

  for (const {validUntil, expected} of examples) {
    const result = evaluateTraining(employee(), training(), [completion({validUntil})], options);
    assert.equal(result.state, expected, validUntil);
    assert.equal(result.validUntil, validUntil);
  }
});

test('Invalid or future completions require review', () => {
  const badRecords = [
    completion({id: 'Z002', quality: 'invalid', completedOn: '2025-01-01', validUntil: null}),
    completion({id: 'Z002', quality: 'invalid', completedOn: null, validUntil: null}),
    completion({id: 'Z002', completedOn: '2026-10-15', validUntil: '2027-10-15'}),
  ];

  for (const bad of badRecords) {
    assert.equal(evaluateTraining(employee(), training(), [bad], options).state, 'unknown');
    assert.equal(evaluateTraining(employee(), training(), [completion(), bad], options).state, 'unknown');
  }
});

test('Unlimited validity requires a valid completion', () => {
  const definition = training({code: 'LEAD', validity: {kind: 'unlimited'}});
  const record = completion({trainingCode: 'LEAD', validUntil: null});

  assert.deepEqual(evaluateTraining(employee(), definition, [record], options), {
    employeeId: 'E001',
    trainingCode: 'LEAD',
    state: 'valid',
    validUntil: null,
    completionId: 'Z001',
  });
  assert.equal(evaluateTraining(employee(), definition, [], options).state, 'missing');
});

test('Explicit expiry overrides unlimited catalog validity', () => {
  const definition = training({validity: {kind: 'unlimited'}});
  assert.equal(
    evaluateTraining(employee(), definition, [completion({validUntil: '2026-09-30'})], options).state,
    'expired',
  );
  assert.equal(
    evaluateTraining(employee(), definition, [completion({validUntil: '2026-10-15'})], options).state,
    'expiring',
  );
});

test('Unknown employment, requirements or expiry require review', () => {
  assert.equal(
    evaluateTraining(employee({startDate: null}), training(), [completion()], options).state,
    'unknown',
  );
  assert.equal(
    evaluateTraining(employee(), training({requirement: {kind: 'unknown'}}), [completion()], options).state,
    'unknown',
  );
  assert.equal(
    evaluateTraining(employee(), training({validity: {kind: 'unknown'}}), [completion()], options).state,
    'unknown',
  );
  assert.equal(
    evaluateTraining(employee(), training(), [completion({validUntil: null})], options).state,
    'unknown',
  );
});
