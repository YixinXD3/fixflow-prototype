'use strict';

// Shumin Wang's Week 13 customer-response contribution.
// This file uses the optional FixFlowCustomerActions adapter already exposed by
// customer.js. It does not replace or edit another member's application code.
(function initialiseCustomerActions(root) {
  const ACTION_KEY = 'fixflow-customer-actions-v1';
  const CUSTOMER_ID = 'C001';
  const responseKinds = ['approved', 'declined', 'clarification'];

  const clone = value => JSON.parse(JSON.stringify(value));

  function getJobs() {
    if (typeof jobs !== 'undefined' && Array.isArray(jobs)) {
      return jobs;
    }

    return Array.isArray(root.jobs) ? root.jobs : [];
  }

  function findJob(jobId) {
    return getJobs().find(item => item && item.id === jobId) || null;
  }

  function latestRequest(job, publishedAt = null) {
    const requests = Array.isArray(job?.approvalRequests)
      ? job.approvalRequests.filter(Boolean)
      : [];

    if (job?.currentApprovalRequestId) {
      const selected = requests.find(
        item => item.id === job.currentApprovalRequestId
      );

      if (selected) {
        return selected;
      }
    }

    const publishedTime = Date.parse(publishedAt || '') || 0;

    return requests
      .filter(item => (Date.parse(item.createdAt || '') || 0) >= publishedTime)
      .sort(
        (left, right) =>
          (Date.parse(right.createdAt || '') || 0) -
          (Date.parse(left.createdAt || '') || 0)
      )[0] || null;
  }

  function normaliseResponse(kind) {
    return responseKinds.includes(kind) ? kind : null;
  }

  function responseLabel(kind) {
    return {
      approved: 'Customer approved the proposed work',
      declined: 'Customer declined the proposed work',
      clarification: 'Customer requested clarification'
    }[kind] || 'Customer response recorded';
  }

  function isApprovableRequest(request) {
    const cost = Number(request?.additionalCost);
    return Boolean(
      request &&
      String(request.reason || '').trim() &&
      String(request.description || '').trim() &&
      Number.isFinite(cost) &&
      cost >= 0
    );
  }

  function appendLog(job, title, note, at) {
    if (!Array.isArray(job.logs)) {
      job.logs = [];
    }

    job.logs.push({
      title,
      note,
      time: new Date(at).toLocaleString('en-AU', {
        timeZone: 'Australia/Brisbane',
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    });
  }

  function applyResponse(job, input) {
    if (!job || typeof job !== 'object') {
      return { ok: false, error: 'Repair not found.' };
    }

    const kind = normaliseResponse(input?.kind);

    if (!kind) {
      return { ok: false, error: 'Choose a valid response.' };
    }

    const request = Array.isArray(job.approvalRequests)
      ? job.approvalRequests.find(item => item?.id === input.requestId)
      : null;

    if (!request) {
      return { ok: false, error: 'Approval request not found.' };
    }

    if (['withdrawn','superseded'].includes(request.status) || (job.currentApprovalRequestId && job.currentApprovalRequestId !== request.id)) return {ok:false,error:'This proposal is no longer active. Open the latest repair update.'};

    if (request.response) {
      return { ok: false, error: 'This request has already been answered.' };
    }

    if (kind === 'approved' && !isApprovableRequest(request)) {
      return {
        ok: false,
        error: 'The shop must provide the reason, proposed work and additional cost before approval.'
      };
    }

    const note = String(input.note || '').trim();

    if (kind === 'clarification' && !note) {
      return { ok: false, error: 'Enter the clarification you need.' };
    }

    const at = input.at || new Date().toISOString();
    const response = {
      kind,
      at,
      customerId: input.customerId || CUSTOMER_ID,
      note: kind === 'clarification' ? note : ''
    };

    request.response = response;
    request.status = kind;
    request.respondedAt = at;

    appendLog(
      job,
      responseLabel(kind),
      kind === 'clarification'
        ? note
        : `Approval request ${request.id}.`,
      at
    );

    return { ok: true, response };
  }

  function confirmCompletion(job, input = {}) {
    if (!job || typeof job !== 'object') {
      return { ok: false, error: 'Repair not found.' };
    }

    if (job.status !== 'Awaiting Customer Confirmation') {
      return {
        ok: false,
        error: 'This repair is not ready for customer confirmation.'
      };
    }

    if (job.customerCompletion?.confirmedAt) {
      return { ok: false, error: 'Completion has already been confirmed.' };
    }

    const at = input.at || new Date().toISOString();

    job.customerCompletion = {
      confirmedAt: at,
      customerId: input.customerId || CUSTOMER_ID
    };
    job.status = 'Completed';
    job.progress = 100;

    appendLog(
      job,
      'Customer confirmed the repair result',
      'Prototype confirmation only; no payment was collected.',
      at
    );

    return { ok: true, at };
  }

  function storeAuditRecord(record) {
    const existing = JSON.parse(root.sessionStorage?.getItem(ACTION_KEY) || '[]');
    const records = Array.isArray(existing) ? existing : [];
    records.push(record);
    root.sessionStorage?.setItem(ACTION_KEY, JSON.stringify(records));
  }

  function persistJob(job, original, auditRecord) {
    try {
      if (typeof saveSession === 'function') {
        saveSession();
      } else {
        throw new Error('Shared save function is unavailable.');
      }

      const saved = JSON.parse(
        root.sessionStorage?.getItem('fixflow-prototype-v1') || 'null'
      );
      const savedJob = saved?.jobs?.find(item => item.id === job.id);

      if (!savedJob || JSON.stringify(savedJob) !== JSON.stringify(job)) {
        throw new Error('The shared repair record was not saved.');
      }

      try {
        storeAuditRecord(auditRecord);
      } catch (auditError) {
        console.warn('FixFlow customer action saved, but the local audit copy was unavailable.', auditError);
      }
      return true;
    } catch (error) {
      Object.keys(job).forEach(key => delete job[key]);
      Object.assign(job, original);
      showMessage(error.message || 'The response could not be saved.', true);
      return false;
    }
  }

  function showMessage(message, isError = false) {
    if (typeof toast === 'function') {
      toast(message);
      return;
    }

    if (root.document) {
      const region = root.document.querySelector('#toast');
      if (region) {
        region.textContent = message;
        region.dataset.error = String(isError);
      }
    }
  }

  function dispatchSaved(detail) {
    root.dispatchEvent?.(
      new CustomEvent('fixflow:customer-action-saved', { detail })
    );
  }

  function moneyValue(value, currency = 'AUD') {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
      return null;
    }

    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency
    }).format(amount);
  }

  function money(request) {
    return moneyValue(request?.additionalCost, request?.currency || 'AUD');
  }

  function element(tag, className = '', text = '') {
    const node = root.document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  function approvalCard(job, context) {
    const request = latestRequest(job, context.publishedAt);
    const card = element('div', 'shumin-action-card');
    const title = element('h2', '', 'Approve additional repair work');
    const intro = element(
      'p',
      'shumin-action-intro',
      'Review the reason, proposed work and additional cost before choosing.'
    );

    card.append(title, intro);

    if (!request) {
      const warning = element(
        'p',
        'shumin-action-warning',
        'The shop has requested a response but has not supplied a structured approval request. Use the repair conversation to ask for details.'
      );
      const openConversation = element('button', 'secondary', 'Open repair conversation');
      openConversation.type = 'button';
      openConversation.addEventListener('click', () => {
        root.location.hash = `#customer-messages/${encodeURIComponent(context.repairId || context.repair?.id || '')}`;
      });
      card.append(warning, openConversation);
      return card;
    }

    const details = element('dl', 'shumin-action-details');
    const rows = [
      ['Reason', request.reason || 'Not supplied'],
      ['Proposed work', request.description || 'Not supplied'],
      ['Additional cost', money(request) || 'Not supplied'],
      ...(moneyValue(request.revisedTotal, request.currency || 'AUD')
        ? [['Revised total', moneyValue(request.revisedTotal, request.currency || 'AUD')]]
        : []),
      ...(String(request.alternative || '').trim()
        ? [['Alternative', String(request.alternative).trim()]]
        : []),
      ...(String(request.requestedByRole || request.requestedByName || '').trim()
        ? [[
            'Requested by',
            [request.requestedByName, request.requestedByRole]
              .filter(value => String(value || '').trim())
              .join(' · ')
          ]]
        : []),
      ['Requested', new Date(request.createdAt).toLocaleString('en-AU')]
    ];

    for (const [label, value] of rows) {
      details.append(
        element('dt', '', label),
        element('dd', '', value)
      );
    }

    card.append(details);

    if (['withdrawn','superseded'].includes(request.status)) {card.append(element('p','shumin-action-result','This proposal is '+request.status+'. Check the latest shop update.'));return card;}

    if (request.response) {
      card.append(
        element(
          'p',
          'shumin-action-result',
          responseLabel(request.response.kind)
        )
      );
      return card;
    }

    const feedback = element('p', 'shumin-action-feedback');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    const clarification = root.document.createElement('textarea');
    clarification.className = 'shumin-clarification';
    clarification.maxLength = 500;
    clarification.placeholder = 'What would you like the repair team to explain?';
    clarification.setAttribute('aria-label', 'Clarification request');
    clarification.hidden = true;

    const buttons = element('div', 'shumin-action-buttons');
    const choices = [
      ['approved', 'Approve'],
      ['declined', 'Decline'],
      ['clarification', 'Need clarification']
    ];

    function submit(kind) {
      const original = clone(job);
      const result = applyResponse(job, {
        requestId: request.id,
        kind,
        note: clarification.value,
        customerId: CUSTOMER_ID
      });

      if (!result.ok) {
        feedback.textContent = result.error;
        return;
      }

      const saved = persistJob(job, original, {
        type: 'approval-response',
        jobId: job.id,
        requestId: request.id,
        response: result.response
      });

      if (saved) {
        dispatchSaved({ type: 'approval-response', jobId: job.id });
        showMessage(responseLabel(kind) + '.');
      }
    }

    for (const [kind, label] of choices) {
      const button = element(
        'button',
        kind === 'approved' ? 'primary' : 'secondary',
        label
      );
      button.type = 'button';

      if (kind === 'approved' && !isApprovableRequest(request)) {
        button.disabled = true;
        button.title = 'The shop must provide the reason, proposed work and additional cost first.';
      }

      button.addEventListener('click', () => {
        if (kind === 'clarification' && clarification.hidden) {
          clarification.hidden = false;
          clarification.focus();
          button.textContent = 'Send clarification request';
          return;
        }

        submit(kind);
      });

      buttons.append(button);
    }

    card.append(buttons, clarification, feedback);
    return card;
  }

  function completionCard(job) {
    const card = element('div', 'shumin-action-card');
    card.append(
      element('h2', '', 'Confirm the repair result'),
      element(
        'p',
        'shumin-action-intro',
        'The technician has marked the repair work complete. Confirming here closes the prototype repair record; it does not make or confirm a payment.'
      )
    );

    const feedback = element('p', 'shumin-action-feedback');
    feedback.setAttribute('role', 'status');

    const button = element('button', 'primary full', 'Confirm repair completion');
    button.type = 'button';
    button.addEventListener('click', () => {
      const original = clone(job);
      const result = confirmCompletion(job, { customerId: CUSTOMER_ID });

      if (!result.ok) {
        feedback.textContent = result.error;
        return;
      }

      const saved = persistJob(job, original, {
        type: 'completion-confirmation',
        jobId: job.id,
        customerId: CUSTOMER_ID,
        at: result.at
      });

      if (saved) {
        dispatchSaved({ type: 'completion-confirmation', jobId: job.id });
        showMessage('Repair completion confirmed.');
      }
    });

    card.append(button, feedback);
    return card;
  }

  function renderProgressActions(context) {
    const job = findJob(context?.jobId);

    if (!job || !root.document) {
      return null;
    }

    if (job.status === 'Awaiting Customer Confirmation') {
      return completionCard(job);
    }

    if (job.publicProgress?.actionRequired === true) {
      return approvalCard(job, context);
    }

    return null;
  }

  function getResponse(context) {
    const job = findJob(context?.jobId);
    const request = latestRequest(job, context?.publishedAt);
    return request?.response || null;
  }

  function seedStandaloneDemo() {
    if (!root.document || !/customer-approval-demo\.html$/i.test(root.location.pathname)) {
      return;
    }

    const job = findJob('RS-10482');

    if (!job || Array.isArray(job.approvalRequests)) {
      return;
    }

    const createdAt = new Date().toISOString();

    job.status = 'In Progress';
    job.progress = Math.max(Number(job.progress) || 0, 60);
    job.publicProgress = {
      reason: 'Testing found that the damaged display module must be replaced before the touch function can be restored.',
      nextAction: 'Review the quoted screen replacement and choose a response.',
      actionRequired: true,
      waitingFor: ['customer'],
      statusAtPublication: 'In Progress',
      publishedAt: createdAt
    };
    job.approvalRequests = [{
      id: 'approval-demo-rs-10482-v1',
      reason: 'The display module failed the touch test.',
      description: 'Replace the display assembly and complete a functional test.',
      additionalCost: 129,
      revisedTotal: 258,
      currency: 'AUD',
      alternative: 'Compatible display option: AUD 89 additional cost, subject to availability.',
      requestedByName: 'Jordan Smith',
      requestedByRole: 'Repair technician',
      createdAt,
      status: 'pending',
      response: null
    }];
    job.currentApprovalRequestId = 'approval-demo-rs-10482-v1';

    if (typeof saveSession === 'function') {
      saveSession();
    }
  }

  const api = {
    getResponse,
    renderProgressActions
  };

  root.FixFlowCustomerActions = api;
  seedStandaloneDemo();

  if (typeof module === 'object' && module.exports) {
    module.exports = {
      applyResponse,
      confirmCompletion,
      isApprovableRequest,
      latestRequest,
      normaliseResponse,
      responseLabel
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
