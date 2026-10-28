'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  applyResponse,
  confirmCompletion,
  isApprovableRequest,
  latestRequest,
  normaliseResponse
} = require('../customer-actions.js');

function approvalJob() {
  return {
    id: 'RS-TEST-1',
    status: 'In Progress',
    progress: 60,
    logs: [],
    approvalRequests: [{
      id: 'approval-1',
      createdAt: '2026-10-22T01:00:00.000Z',
      reason: 'Display module failed.',
      description: 'Replace the display.',
      additionalCost: 129,
      currency: 'AUD',
      status: 'pending',
      response: null
    }],
    currentApprovalRequestId: 'approval-1'
  };
}

test('only supported response values are accepted', () => {
  assert.equal(normaliseResponse('approved'), 'approved');
  assert.equal(normaliseResponse('declined'), 'declined');
  assert.equal(normaliseResponse('clarification'), 'clarification');
  assert.equal(normaliseResponse('completed'), null);
});

test('approval requires a reason, proposed work and additional cost', () => {
  const job = approvalJob();
  delete job.approvalRequests[0].reason;

  assert.equal(isApprovableRequest(job.approvalRequests[0]), false);
  assert.equal(
    applyResponse(job, {
      requestId: 'approval-1',
      kind: 'approved'
    }).ok,
    false
  );
  assert.equal(job.approvalRequests[0].response, null);
});

test('approval is saved without completing the repair', () => {
  const job = approvalJob();
  const result = applyResponse(job, {
    requestId: 'approval-1',
    kind: 'approved',
    at: '2026-10-22T02:00:00.000Z'
  });

  assert.equal(result.ok, true);
  assert.equal(job.approvalRequests[0].response.kind, 'approved');
  assert.equal(job.status, 'In Progress');
  assert.equal(job.logs.length, 1);
});

test('declining does not approve or complete the repair', () => {
  const job = approvalJob();
  const result = applyResponse(job, {
    requestId: 'approval-1',
    kind: 'declined'
  });

  assert.equal(result.ok, true);
  assert.equal(job.approvalRequests[0].status, 'declined');
  assert.equal(job.status, 'In Progress');
});

test('clarification requires a question', () => {
  const job = approvalJob();
  const result = applyResponse(job, {
    requestId: 'approval-1',
    kind: 'clarification',
    note: '   '
  });

  assert.equal(result.ok, false);
  assert.equal(job.approvalRequests[0].response, null);
});

test('clarification preserves the customer question', () => {
  const job = approvalJob();
  const result = applyResponse(job, {
    requestId: 'approval-1',
    kind: 'clarification',
    note: 'Does the quote include labour?'
  });

  assert.equal(result.ok, true);
  assert.equal(
    job.approvalRequests[0].response.note,
    'Does the quote include labour?'
  );
});

test('the same request cannot be answered twice', () => {
  const job = approvalJob();

  assert.equal(
    applyResponse(job, {
      requestId: 'approval-1',
      kind: 'approved'
    }).ok,
    true
  );

  assert.equal(
    applyResponse(job, {
      requestId: 'approval-1',
      kind: 'declined'
    }).ok,
    false
  );
});

test('a revised request can be answered without rewriting the old response', () => {
  const job = approvalJob();
  applyResponse(job, {
    requestId: 'approval-1',
    kind: 'declined'
  });

  job.approvalRequests.push({
    id: 'approval-2',
    createdAt: '2026-10-22T03:00:00.000Z',
    reason: 'A revised compatible part is available.',
    description: 'Install the compatible display and test it.',
    additionalCost: 99,
    response: null
  });
  job.currentApprovalRequestId = 'approval-2';

  const result = applyResponse(job, {
    requestId: 'approval-2',
    kind: 'approved'
  });

  assert.equal(result.ok, true);
  assert.equal(job.approvalRequests[0].response.kind, 'declined');
  assert.equal(job.approvalRequests[1].response.kind, 'approved');
});

test('latestRequest respects the explicitly current request', () => {
  const job = approvalJob();
  job.approvalRequests.push({
    id: 'approval-2',
    createdAt: '2026-10-22T03:00:00.000Z'
  });
  job.currentApprovalRequestId = 'approval-1';

  assert.equal(latestRequest(job).id, 'approval-1');
});

test('completion is rejected before the awaiting-confirmation state', () => {
  const job = approvalJob();
  const result = confirmCompletion(job);

  assert.equal(result.ok, false);
  assert.equal(job.status, 'In Progress');
});

test('valid customer confirmation completes the repair once', () => {
  const job = approvalJob();
  job.status = 'Awaiting Customer Confirmation';
  job.progress = 100;

  const first = confirmCompletion(job, {
    at: '2026-10-22T04:00:00.000Z'
  });
  const second = confirmCompletion(job, {
    at: '2026-10-22T05:00:00.000Z'
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(job.status, 'Completed');
  assert.equal(job.customerCompletion.confirmedAt, '2026-10-22T04:00:00.000Z');
});
