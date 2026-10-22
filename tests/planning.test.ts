import assert from 'node:assert/strict';
import test from 'node:test';
import {recommendAssignments} from '../src/lib/training/planning';
import {need, trainingSession} from './helpers';

const asOf = '2026-10-01';

test('Matches courses and capacity, reports unmet needs', () => {
  const needs = ['E003', 'E001', 'E002'].map((employeeId) =>
    need({id: `${employeeId}:KYBER`, employeeId}),
  );
  needs.push(need({id: 'E004:BOZP-Z', employeeId: 'E004', trainingCode: 'BOZP-Z'}));

  const plan = recommendAssignments(
    needs,
    [
      trainingSession({capacity: 5, occupied: 3}),
      trainingSession({id: 'other-course', trainingCode: 'GDPR'}),
    ],
    asOf,
  );

  assert.deepEqual(plan, {
    assignments: ['E001', 'E002'].map((employeeId) => ({
      requirementId: `${employeeId}:KYBER`,
      employeeId,
      trainingCode: 'KYBER',
      trainingSessionId: 'T001',
    })),
    unresolved: [
      {requirementId: 'E003:KYBER', reason: 'no-capacity'},
      {requirementId: 'E004:BOZP-Z', reason: 'no-session'},
    ],
  });
});

test('Skips past, cancelled and invalid sessions', () => {
  const excluded = [
    trainingSession({id: 'past', date: '2026-09-30'}),
    trainingSession({id: 'cancelled', date: '2026-10-02', status: 'cancelled'}),
    trainingSession({id: 'invalid', date: '2026-10-03', status: 'invalid'}),
    trainingSession({id: 'missing-date', date: null, status: 'invalid'}),
  ];

  const plan = recommendAssignments(
    [need()],
    [...excluded, trainingSession({id: 'usable'})],
    asOf,
  );

  assert.deepEqual(plan.assignments.map((item) => item.trainingSessionId), ['usable']);
  assert.deepEqual(plan.unresolved, []);
  assert.deepEqual(recommendAssignments([need()], excluded, asOf).unresolved, [
    {requirementId: 'E001:KYBER', reason: 'no-session'},
  ]);
});

test('Skips sessions without remaining capacity', () => {
  for (const values of [
    {capacity: 0, occupied: 0},
    {capacity: 3, occupied: 3},
    {capacity: 3, occupied: 4},
  ]) {
    const plan = recommendAssignments([need()], [trainingSession(values)], asOf);

    assert.deepEqual(plan.assignments, []);
    assert.deepEqual(plan.unresolved, [
      {requirementId: 'E001:KYBER', reason: 'no-capacity'},
    ]);
  }
});

test('Orders needs by urgency, deadline and ID', () => {
  const needs = [
    need({id: 'a-expiring-unknown', employeeId: 'E001', deadline: null}),
    need({id: 'b-expiring', employeeId: 'E002', deadline: '2026-10-02'}),
    need({id: 'a-expiring', employeeId: 'E003', deadline: '2026-10-02'}),
    need({id: 'missing', employeeId: 'E004', state: 'missing', deadline: null}),
    need({id: 'expired-later', employeeId: 'E005', state: 'expired', deadline: '2026-09-30'}),
    need({id: 'expired-earlier', employeeId: 'E006', state: 'expired', deadline: '2026-09-29'}),
  ];

  const plan = recommendAssignments(needs, [trainingSession({capacity: 5, occupied: 0})], asOf);

  assert.deepEqual(plan.assignments.map((item) => item.requirementId), [
    'expired-earlier',
    'expired-later',
    'missing',
    'a-expiring',
    'b-expiring',
  ]);
  assert.deepEqual(plan.unresolved, [
    {requirementId: 'a-expiring-unknown', reason: 'no-capacity'},
  ]);
});

test('Uses earliest sessions within inclusive employment dates', () => {
  const needs = ['E001', 'E002', 'E003'].map((employeeId) =>
    need({id: `${employeeId}:KYBER`, employeeId}),
  );
  const plan = recommendAssignments(
    needs,
    [
      trainingSession({id: 'b-next-day', date: '2026-10-02', capacity: 1, occupied: 0}),
      trainingSession({id: 'a-next-day', date: '2026-10-02', capacity: 1, occupied: 0}),
      trainingSession({id: 'today', date: asOf, capacity: 1, occupied: 0}),
    ],
    asOf,
  );

  assert.deepEqual(plan.assignments.map((item) => item.trainingSessionId), [
    'today', 'a-next-day', 'b-next-day',
  ]);

  const endingNeed = need({employmentEnd: asOf});
  assert.equal(
    recommendAssignments([endingNeed], [trainingSession({date: asOf})], asOf).assignments.length,
    1,
  );
  const afterEmployment = recommendAssignments(
    [endingNeed],
    [trainingSession({date: '2026-10-02'})],
    asOf,
  );
  assert.deepEqual(afterEmployment.assignments, []);
  assert.deepEqual(afterEmployment.unresolved, [
    {requirementId: endingNeed.id, reason: 'no-session'},
  ]);
});

test('Assigns each requirement only once', () => {
  const plan = recommendAssignments([need(), need()], [trainingSession()], asOf);

  assert.deepEqual(plan, {
    assignments: [{
      requirementId: 'E001:KYBER',
      employeeId: 'E001',
      trainingCode: 'KYBER',
      trainingSessionId: 'T001',
    }],
    unresolved: [],
  });
});

test('Reversing imported rows keeps the two places for expired and missing training', () => {
  const needs = [
    need({id: 'E003:KYBER', employeeId: 'E003'}),
    need({state: 'expired', deadline: '2026-09-30'}),
    need({id: 'E002:KYBER', employeeId: 'E002', state: 'missing', deadline: null}),
  ];
  const trainingSessions = [
    trainingSession({id: 'later', date: '2026-10-15', capacity: 1, occupied: 0}),
    trainingSession({id: 'earlier', date: '2026-10-14', capacity: 2, occupied: 1}),
  ];
  const expected = {
    assignments: [
      {requirementId: 'E001:KYBER', employeeId: 'E001', trainingCode: 'KYBER', trainingSessionId: 'earlier'},
      {requirementId: 'E002:KYBER', employeeId: 'E002', trainingCode: 'KYBER', trainingSessionId: 'later'},
    ],
    unresolved: [{requirementId: 'E003:KYBER', reason: 'no-capacity'}],
  };

  assert.deepEqual(recommendAssignments(needs, trainingSessions, asOf), expected);
  assert.deepEqual(recommendAssignments([...needs].reverse(), [...trainingSessions].reverse(), asOf), expected);
});

test('Recalculating a plan leaves imported rows and occupied places unchanged', () => {
  const needs = [need({id: 'E002:KYBER', employeeId: 'E002'}), need()];
  const trainingSessions = [
    trainingSession({id: 'later', date: '2026-10-15'}),
    trainingSession({id: 'earlier', capacity: 2, occupied: 1}),
  ];
  const needsBefore = structuredClone(needs);
  const trainingSessionsBefore = structuredClone(trainingSessions);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const plan = recommendAssignments(needs, trainingSessions, asOf);
    assert.deepEqual(plan.assignments.map((item) => [item.employeeId, item.trainingSessionId]), [
      ['E001', 'earlier'],
      ['E002', 'later'],
    ]);
    assert.deepEqual(plan.unresolved, []);
  }

  assert.deepEqual(needs, needsBefore);
  assert.deepEqual(trainingSessions, trainingSessionsBefore);
});
