const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = require('../manager/model.js');
const valid = { owner: 'Staff C', status: 'Ordered', nextAction: 'Confirm the delivery date.', expectedArrival: '' };

test('manager assigns a request without changing other repairs or requests', () => {
  const original = model.seed();
  const result = model.update(original, 'part-201', valid, '2026-10-19T01:00:00Z');
  assert.equal(result.state.shortages[0].owner, 'Staff C');
  assert.equal(result.state.shortages[0].status, 'Ordered');
  assert.deepEqual(result.state.jobs, original.jobs);
  assert.deepEqual(result.state.shortages.slice(1), original.shortages.slice(1));
  assert.equal(original.shortages[0].owner, '');
});
test('receipt does not resume a repair that still needs technical help', () => {
  const original = model.seed();
  const result = model.update(original, 'part-202', { ...valid, status: 'Received' }, '2026-10-19T01:01:00Z');
  assert.equal(result.state.shortages[1].status, 'Received');
  assert.equal(result.state.jobs[1].repairStatus, 'Waiting');
  assert.equal(result.state.jobs[1].otherBlocker, 'Technical help still open');
});
test('unassigned, empty and overlong updates cannot be saved', () => {
  for (const input of [{ ...valid, owner: '' }, { ...valid, nextAction: '  ' }, { ...valid, nextAction: 'x'.repeat(241) }]) {
    assert.ok(model.update(model.seed(), 'part-201', input, '2026-10-19T01:00:00Z').error);
  }
});
test('unknown arrival is allowed; invalid dates and status values are rejected', () => {
  assert.equal(model.validate(valid), null);
  assert.equal(model.validate({ ...valid, expectedArrival: '2026-02-30' }).field, 'expectedArrival');
  assert.equal(model.validate({ ...valid, expectedArrival: '2026-02-28' }), null);
  assert.equal(model.validate({ ...valid, status: 'Completed' }).field, 'status');
});
test('repeated identical save creates no duplicate history', () => {
  const first = model.update(model.seed(), 'part-201', valid, '2026-10-19T01:00:00Z');
  const second = model.update(first.state, 'part-201', valid, '2026-10-19T01:02:00Z');
  assert.equal(second.changed, false);
  assert.equal(second.state.shortages[0].history.length, 1);
});
test('persisted records preserve their repair association and reject corrupted references', () => {
  const validState = JSON.parse(JSON.stringify(model.seed()));
  assert.equal(model.isState(validState), true);
  validState.shortages[0].jobId = 'unknown';
  assert.equal(model.isState(validState), false);
  assert.equal(model.isState({ version: 1, jobs: [], shortages: [null] }), false);
});
test('missing request is reported instead of changing another record', () => {
  assert.ok(model.update(model.seed(), 'missing', valid, '2026-10-19T01:00:00Z').error);
});
