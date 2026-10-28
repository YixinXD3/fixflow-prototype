'use strict';

// Customer workflow. Existing technician and manager source files stay unchanged.
(() => {
  const JOB_KEY = 'fixflow-prototype-v1';
  const CUSTOMER_KEY = 'fixflow-customer-v1';
  const account = { id: 'C001', name: 'Alex Chen' };

  const technicians = [
    {
      id: 'jordan',
      name: 'Jordan Smith',
      specialty: 'Phone & Tablet Repair',
      manager: 'Sarah Lee'
    },
    {
      id: 'taylor',
      name: 'Taylor Kim',
      specialty: 'Phone & Display Repair',
      manager: 'Sarah Lee'
    },
    {
      id: 'marcus',
      name: 'Marcus Lee',
      specialty: 'Computers & Appliances',
      manager: 'David Wong'
    }
  ];

  const types = ['Phone', 'Tablet', 'PC', 'Appliance', 'Other'];

  const categories = [
    'Screen Repair',
    'Battery Issue',
    'Charging Issue',
    'Power Issue',
    'Water Damage',
    'Software Issue',
    'Other'
  ];

  const waits = {
    parts: 'Replacement part',
    technical: 'Technical support',
    customer: 'Customer response'
  };

  const blank = () => ({
    device: '',
    description: '',
    note: '',
    type: 'Phone',
    category: 'Screen Repair',
    techId: '',
    photos: []
  });

  let draft = blank();
  let role = null;
  let busy = false;
  let blocked = false;
  let pendingControl = null;

  const messageDrafts = {};

  let repairs = jobs.some(j => j.id === 'RS-10482')
    ? [{
        id: 'CR-1001',
        jobId: 'RS-10482',
        customerId: 'C001',
        device: 'iPhone 13',
        type: 'Phone',
        category: 'Screen Repair',
        description: 'Screen cracked and touch unresponsive.',
        techId: 'jordan',
        submitted: '2025-04-28T10:24:00',
        photos: [],
        messages: []
      }]
    : [];

  try {
    role = sessionStorage.getItem('fixflow-role');

    if (!['customer', 'technician', 'manager'].includes(role)) {
      role = null;
    }

    // Do not overwrite shared records that the application could not restore.
    const sharedRaw = sessionStorage.getItem(JOB_KEY);
    if (sharedRaw !== null) {
      const shared = JSON.parse(sharedRaw);
      if (!shared || !Array.isArray(shared.jobs) ||
          !Array.isArray(shared.requests) || !Array.isArray(shared.labels)) {
        throw Error('Invalid shared records');
      }
    }

    const raw = sessionStorage.getItem(CUSTOMER_KEY);

    if (raw !== null) {
      const saved = JSON.parse(raw);

      if (
        !Array.isArray(saved) ||
        saved.some(r =>
          !r ||
          typeof r.id !== 'string' ||
          typeof r.jobId !== 'string' ||
          !Array.isArray(r.messages)
        )
      ) {
        throw Error('Invalid records');
      }

      repairs = saved;
    }
  } catch {
    blocked = true;
  }

  const own = r =>
    r.customerId === account.id || !r.customerId;

  const mine = () =>
    repairs
      .filter(own)
      .sort((a, b) =>
        (Date.parse(b.submitted) || 0) -
        (Date.parse(a.submitted) || 0)
      );

  const selected = id =>
    repairs.find(r => r.id === id && own(r));

  const linked = r =>
    jobs.find(j => j.id === r.jobId);

  const validTime = value =>
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value));

  const time = value =>
    validTime(value)
      ? new Date(value).toLocaleString('en-AU', {
          timeZone: 'Australia/Brisbane',
          dateStyle: 'medium',
          timeStyle: 'short'
        }) + ' AEST'
      : 'Not published yet';

  const nav = (
    page,
    text,
    id = '',
    cls = 'secondary'
  ) => `
    <button
      class="${cls}"
      data-customer-action="nav"
      data-page="${page}"
      data-id="${esc(id)}"
    >${text}</button>
  `;

  const back = () =>
    nav(
      'customer-repairs',
      '← Back to My Repairs',
      '',
      'back'
    );

  const safePhoto = p =>
    p &&
    /^data:image\/(png|jpeg|webp);base64,/i.test(p.src || '');

  function technician(r) {
    const j = linked(r);

    if (
      j &&
      Object.hasOwn(j, 'assignedTechnicianId')
    ) {
      return (
        technicians.find(
          t => t.id === j.assignedTechnicianId
        )?.name ||
        j.assignedTechnician ||
        'Not assigned yet'
      );
    }

    return (
      technicians.find(t => t.id === r.techId)?.name ||
      'Not assigned yet'
    );
  }

  function publication(j) {
    const p = j?.publicProgress;

    return (
      p &&
      p.statusAtPublication === j.status &&
      validTime(p.publishedAt) &&
      typeof p.reason === 'string' &&
      p.reason.trim() &&
      typeof p.nextAction === 'string' &&
      p.nextAction.trim()
    )
      ? p
      : null;
  }

  function view(r) {
    const j = linked(r);
    const p = publication(j);

    if (!j) {
      return {
        status: 'Record unavailable', p: null,
        context: { repairId: r.id, jobId: r.jobId, requestId: null, publishedAt: null },
        receipt: null, final: false, waiting: [],
        reason: 'The linked repair record is unavailable.',
        next: 'Ask the team to restore the shared repair data. Do not submit a duplicate request.'
      };
    }

    let status = j.status;

    if (status === 'To Do') {
      const assigned =
        j.assignedTechnicianId ||
        (
          !Object.hasOwn(j, 'assignedTechnicianId') &&
          r.techId
        );

      status = assigned
        ? 'Accepted'
        : 'Request Submitted';
    }

    if (status === 'Awaiting Customer Confirmation') {
      status = 'Ready for Pickup';
    }

    if (status === 'Waiting') {
      status = j.shortages?.some(s => !s.fulfilled)
        ? 'Waiting for Part'
        : 'Waiting for Update';
    }

    const final = [
      'Ready for Pickup',
      'Completed'
    ].includes(status);

    const context = {
      repairId: r.id,
      jobId: r.jobId,
      requestId: p?.requestId || j.currentApprovalRequestId || null,
      publishedAt: p?.publishedAt || null
    };

    let receipt = null;

    if (!final && p?.actionRequired === true) {
      status = 'Awaiting Your Response';

      try {
        const response =
          window.FixFlowCustomerActions
            ?.getResponse?.(context);

        if (
          response &&
          ['approved', 'declined', 'clarification']
            .includes(response.kind) &&
          validTime(response.at) &&
          Date.parse(response.at) >=
            Date.parse(p.publishedAt) &&
          (!context.requestId || response.requestId === context.requestId ||
            // The integrated adapter returns the response on its original request.
            j.approvalRequests?.some(request =>
              request.id === context.requestId && request.response === response
            ))
        ) {
          receipt = response;
        }
      } catch {
        // The conversation remains available.
      }

      if (!receipt && !context.requestId) {
        const reply = r.messages
          .filter(m =>
            m.author === 'customer' &&
            typeof m.text === 'string' &&
            m.text.trim() &&
            validTime(m.time) &&
            Date.parse(m.time) >=
              Date.parse(p.publishedAt)
          )
          .sort((a, b) =>
            Date.parse(b.time) - Date.parse(a.time)
          )[0];

        if (reply) {
          receipt = {
            kind: 'message',
            at: reply.time
          };
        }
      }

      if (receipt) {
        status = 'Waiting for Shop Reply';
      }
    }

    const defaults = {
      'Request Submitted': [
        'Your request is recorded.',
        'The shop needs to review and assign this repair.'
      ],
      Accepted: [
        'A technician is assigned. Work has not started yet.',
        'The technician needs to start the repair.'
      ],
      'In Progress': [
        'Your technician is working on the device.',
        'The shop needs to publish the next confirmed update.'
      ],
      'Waiting for Part': [
        'A replacement part is required.',
        'The shop needs to follow up the part. Arrival time is not confirmed.'
      ],
      'Waiting for Update': [
        'Repair work is paused.',
        'The shop needs to publish the reason and next step.'
      ],
      'Ready for Pickup': [
        'The device is ready for collection.',
        'Contact the shop to arrange collection.'
      ],
      Completed: [
        'The repair is marked completed.',
        'No further action is shown.'
      ]
    };

    const fallback = defaults[status] || [
      'The shop has requested a response.',
      'Review the update and reply in the repair conversation.'
    ];

    return {
      status,
      p,
      context,
      receipt,
      final,
      reason: p?.reason || fallback[0],
      next: receipt
        ? 'The shop needs to review your response and publish the next update.'
        : p?.nextAction || fallback[1],
      waiting:
        !final && Array.isArray(p?.waitingFor)
          ? [
              ...new Set(
                p.waitingFor.filter(
                  k => Object.hasOwn(waits, k)
                )
              )
            ].map(k => waits[k])
          : []
    };
  }

  function layout(body, active = 'customer-home') {
    const items = [
      ['customer-home', 'home', 'Home'],
      ['customer-repairs', 'jobs', 'My Repairs'],
      ['customer-request', 'plus', 'Request'],
      ['customer-messages', 'chat', 'Messages'],
      ['customer-profile', 'user', 'Profile']
    ];

    return `
      <header class="header">
        <img class="logo" src="assets/favicon.svg" alt="">
        <div class="brand"><strong>FixFlow</strong></div>
        ${
          nav(
            'customer-profile',
            '<span class="avatar">AC</span>',
            '',
            'profile'
          )
        }
      </header>

      <main class="main customer-main">
        ${
          blocked
            ? `
              <p role="alert">
                Stored data could not be read safely.
                Saving is disabled.
                Ask the team to inspect this tab.
              </p>
            `
            : ''
        }
        ${body}
      </main>

      <nav
        class="bottom-nav customer-nav"
        aria-label="Customer navigation"
      >
        ${items.map(([page, i, label]) => `
          <button
            class="nav-item ${page === active ? 'active' : ''}"
            ${page === active ? 'aria-current="page"' : ''}
            data-customer-action="nav"
            data-page="${page}"
          >
            ${icon(i)}${label}
          </button>
        `).join('')}
      </nav>
    `;
  }

  function login() {
    const roles = [
      ['manager', 'jobs', 'Manager', 'Assign repairs and follow up on parts and decisions'],
      [
        'technician',
        'tool',
        'Repair Technician',
        'Manage jobs and support your team'
      ],
      [
        'customer',
        'user',
        'Customer',
        'Request a repair and follow its progress'
      ]
    ];

    return `
      <main class="main login-main">
        <div class="login-brand">
          <img class="logo" src="assets/favicon.svg" alt="">
          <strong>FixFlow</strong>
        </div>

        <div class="login-intro">
          <h1>Welcome to FixFlow</h1>
          <p>Choose your role to get started.</p>
        </div>

        <div class="role-options">
          ${roles.map(([id, i, title, text]) => `
            <button
              class="role-card"
              data-customer-action="login"
              data-role="${id}"
            >
              ${tile(i)}
              <span>
                <strong>${title}</strong>
                <small>${text}</small>
              </span>
              <span>›</span>
            </button>
          `).join('')}
        </div>

        <p class="prototype-note">
          Prototype login · No password required
        </p>

        <p class="prototype-note">All roles use the same demonstration records within this browser tab.</p>
      </main>
    `;
  }

  function card(r) {
    return `
      <button
        class="panel customer-repair-card"
        data-customer-action="nav"
        data-page="customer-progress"
        data-id="${esc(r.id)}"
      >
        <div class="customer-card-top">
          ${deviceIcon({ type: r.type })}
          <div class="grow">
            <h2>${esc(r.device)}</h2>
            <p>${esc(r.category)}</p>
          </div>
          <span>›</span>
        </div>

        ${badge(view(r).status)}

        <p>Technician: ${esc(technician(r))}</p>
        <small>Submitted ${esc(time(r.submitted))}</small>
        <span class="customer-link">View Progress →</span>
      </button>
    `;
  }

  function home() {
    const records = mine();

    const count = records.filter(
      r => view(r).status !== 'Completed'
    ).length;

    return layout(`
      ${pageHeading(
        'Hi, Alex',
        'Let’s get your devices working again.'
      )}

      <div class="customer-stat">
        ${tile('tool')}
        <div>
          <strong>${count}</strong>
          <span>Active repairs</span>
        </div>
      </div>

      ${nav(
        'customer-request',
        '+ Request Repair',
        '',
        'primary full'
      )}

      <div class="section-head">
        <h2>Latest repair</h2>
        ${nav(
          'customer-repairs',
          'View all',
          '',
          'text-button'
        )}
      </div>

      ${
        records.length
          ? card(records[0])
          : empty(
              'No repairs yet',
              'Request a repair to get started.'
            )
      }
    `);
  }

  function list() {
    return layout(
      `
        ${pageHeading(
          'My Repairs',
          'Your requests and their latest progress.'
        )}

        ${
          mine().map(card).join('') ||
          empty(
            'No repairs yet',
            'Request a repair to get started.'
          )
        }
      `,
      'customer-repairs'
    );
  }

  const options = (values, value) =>
    values.map(v => `
      <option value="${esc(v)}" ${v === value ? 'selected' : ''}>
        ${esc(v)}
      </option>
    `).join('');

  function photos() {
    return draft.photos.map((p, i) => `
      <div class="customer-photo">
        <img src="${esc(p.src)}" alt="${esc(p.name)}">
        <button
          type="button"
          data-customer-action="remove-photo"
          data-index="${i}"
          aria-label="Remove photo"
        >×</button>
      </div>
    `).join('');
  }

  function requestPage() {
    return layout(
      `
        ${pageHeading(
          'Request Repair',
          'Step 1 of 2 · Tell us about your device'
        )}

        <form
          id="customer-request-form"
          class="panel customer-form"
        >
          <label class="field">
            Device type
            <select name="type">
              ${options(types, draft.type)}
            </select>
          </label>

          <label class="field">
            Device model
            <input
              name="device"
              required
              maxlength="80"
              value="${esc(draft.device)}"
              placeholder="e.g. iPhone 15 Pro"
            >
          </label>

          <label class="field">
            Repair issue
            <select name="category">
              ${options(categories, draft.category)}
            </select>
          </label>

          <label class="field">
            Problem description
            <textarea
              name="description"
              required
              maxlength="500"
            >${esc(draft.description)}</textarea>
          </label>

          <label class="field">
            Note <small>Optional</small>
            <textarea
              name="note"
              maxlength="300"
            >${esc(draft.note)}</textarea>
          </label>

          <label class="field">
            Photos <small>Optional · This tab only</small>
            <input
              id="customer-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
            >
          </label>

          <div
            id="customer-photo-preview"
            class="customer-photos"
          >${photos()}</div>

          <button class="primary full">
            Select Technician →
          </button>
        </form>
      `,
      'customer-request'
    );
  }

  function chooseTechnician() {
    if (
      !draft.device.trim() ||
      !draft.description.trim()
    ) {
      return layout(
        `
          ${nav(
            'customer-request',
            '← Edit request',
            '',
            'back'
          )}
          ${empty(
            'Complete your request first',
            'Enter a device model and problem description.'
          )}
        `,
        'customer-request'
      );
    }

    const choices = [
      {
        id: '',
        name: 'Let the manager arrange',
        specialty: 'The shop will select a suitable technician.'
      },
      ...technicians
    ];

    return layout(
      `
        ${nav(
          'customer-request',
          '← Edit repair request',
          '',
          'back'
        )}

        ${pageHeading(
          'Select Technician',
          'Step 2 of 2 · Choose a preference'
        )}

        <section class="panel customer-review">
          <h2>${esc(draft.device)}</h2>
          <p>${esc(draft.category)}</p>
          <p>${esc(draft.description)}</p>

          ${
            draft.note
              ? `<p>Note: ${esc(draft.note)}</p>`
              : ''
          }

          <small>
            ${draft.photos.length} photo(s) ·
            Preference is subject to shop confirmation.
          </small>
        </section>

        ${choices.map(t => `
          <section
            class="panel customer-tech ${
              draft.techId === t.id ? 'selected' : ''
            }"
          >
            <h2>${esc(t.name)}</h2>
            <p>${esc(t.specialty)}</p>
            ${t.manager ? `<small>Manager: ${esc(t.manager)}</small>` : ''}

            <button
              class="${
                draft.techId === t.id
                  ? 'primary'
                  : 'secondary'
              } full"
              data-customer-action="select-tech"
              data-id="${t.id}"
              aria-pressed="${draft.techId === t.id}"
            >
              ${
                draft.techId === t.id
                  ? 'Selected'
                  : 'Select preference'
              }
            </button>
          </section>
        `).join('')}

        <button
          class="primary full"
          data-customer-action="submit-repair"
          ${busy || blocked ? 'disabled' : ''}
        >
          Submit Repair Request
        </button>

        <p class="prototype-note">
          Demo request · Saved in this browser tab
        </p>
      `,
      'customer-request'
    );
  }

  function persist(
    nextJobs = jobs,
    nextRepairs = repairs
  ) {
    if (blocked || window.FixFlowStore?.error) {
      toast('Saving is disabled until the stored data is checked.');
      return false;
    }

    const keys = [JOB_KEY, CUSTOMER_KEY];
    let before;

    try {
      before = keys.map(k =>
        sessionStorage.getItem(k)
      );

      if (window.FixFlowStore) window.FixFlowStore.normalize({jobs:nextJobs,requests,labels,techs});
      sessionStorage.setItem(
        JOB_KEY,
        JSON.stringify({
          schemaVersion: 1,
          jobs: nextJobs,
          requests,
          labels,
          techs
        })
      );

      sessionStorage.setItem(
        CUSTOMER_KEY,
        JSON.stringify(nextRepairs)
      );

      jobs = nextJobs;
      repairs = nextRepairs;

      return true;
    } catch {
      if (before) {
        keys.forEach((k, i) => {
          try {
            if (
              sessionStorage.getItem(k) !== before[i]
            ) {
              if (before[i] === null) {
                sessionStorage.removeItem(k);
              } else {
                sessionStorage.setItem(k, before[i]);
              }
            }
          } catch {
            blocked = true;
          }
        });
      }

      toast(
        blocked
          ? 'Storage recovery failed. Stop and ask the team to inspect this tab.'
          : 'Could not save. Your input is retained; free browser storage and retry.'
      );

      return false;
    }
  }

  function submitRepair() {
    if (
      busy ||
      blocked ||
      role !== 'customer' ||
      route().page !== 'customer-technicians'
    ) {
      return;
    }

    const device = draft.device.trim();
    const description = draft.description.trim();
    const note = draft.note.trim();

    if (
      !device ||
      !description ||
      device.length > 80 ||
      description.length > 500 ||
      note.length > 300 ||
      !types.includes(draft.type) ||
      !categories.includes(draft.category) ||
      (
        draft.techId &&
        !technicians.some(t => t.id === draft.techId)
      )
    ) {
      return toast(
        'Check the device, description and preference.'
      );
    }

    busy = true;

    const button = document.querySelector(
      '[data-customer-action="submit-repair"]'
    );

    if (button) {
      button.disabled = true;
    }

    const id = 'CR-' + crypto.randomUUID();
    const stamp = new Date().toISOString();

    const r = {
      ...draft,
      device,
      description,
      note,
      id,
      jobId: id,
      customerId: account.id,
      techId: '',
      preferredTechnicianId: draft.techId || null,
      submitted: stamp,
      photos: draft.photos.filter(safePhoto).slice(0, 3),
      messages: []
    };

    const j = {
      id,
      customerId: account.id,
      device,
      type: r.type === 'Tablet' ? 'Other' : r.type,
      issue: r.category,
      priority: 'Medium',
      status: 'To Do',
      progress: 0,
      label: '',
      customer: account.name,
      preferredTechnicianId: r.preferredTechnicianId,
      assignedTechnicianId: null,
      assignedTechnician: '',
      customerDescription:
        description + (note ? '\nNote: ' + note : ''),
      createdAt: stamp,
      receivedAt: stamp,
      updatedAt: stamp,
      updated: now(),
      notes: '',
      logs: [{
        title: 'Customer request submitted',
        time: now(),
        note: 'Awaiting shop assignment'
      }],
      attachments: r.photos,
      shortages: []
    };

    const saved = persist(
      [j, ...jobs],
      [r, ...repairs]
    );

    busy = false;

    if (!saved) {
      if (button) {
        button.disabled = blocked;
      }
      return;
    }

    draft = blank();
    go('customer-progress', id);

    toast(
      'Repair request saved. Assignment awaits shop confirmation.'
    );
  }

  function missing() {
    return layout(
      `
        ${back()}
        ${empty(
          'Repair not found',
          'Choose one of your repairs.'
        )}
      `,
      'customer-repairs'
    );
  }

  function progress() {
    const r = selected(route().id);

    if (!r) {
      return missing();
    }

    const v = view(r);
    const j = linked(r);
    const p = v.p;

    const stages = [
      'Request Submitted',
      'Accepted',
      'In Progress'
    ];

    if (
      [
        'Waiting for Part',
        'Waiting for Update',
        'Awaiting Your Response',
        'Waiting for Shop Reply'
      ].includes(v.status)
    ) {
      stages.push(v.status);
    }

    stages.push('Ready for Pickup', 'Completed');

    const current = stages.indexOf(v.status);

    const field = (label, value) => `
      <div>
        <dt>${esc(label)}</dt>
        <dd>${esc(value)}</dd>
      </div>
    `;

    let action = `
      <h2>${
        v.final
          ? 'Collection and completion'
          : 'Your action'
      }</h2>
      <p>${esc(v.next)}</p>
    `;

    if (v.receipt) {
      const titles = {
        message: 'Your reply has been sent',
        approved: 'Your approval has been recorded',
        declined: 'Your decision has been recorded',
        clarification: 'Your question has been recorded'
      };

      action = `
        <h2>${titles[v.receipt.kind]}</h2>
        <p>
          The shop needs to review your response.
          A message does not approve additional work.
        </p>
        <small>
          Recorded ${esc(time(v.receipt.at))}
        </small>
      `;
    } else if (v.status === 'Awaiting Your Response') {
      action = `
        <h2>Your response is needed</h2>
        <p>
          Review the explanation and ask about any proposed extra cost.
        </p>
        ${nav(
          'customer-messages',
          'Review and Reply',
          r.id,
          'primary full'
        )}
      `;
    }

    if (
      !v.receipt &&
      [
        'Awaiting Your Response',
        'Ready for Pickup'
      ].includes(v.status)
    ) {
      try {
        const node =
          window.FixFlowCustomerActions
            ?.renderProgressActions?.(v.context);

        if (node instanceof HTMLElement) {
          pendingControl = node;
        }
      } catch {
        // Retain fallback.
      }
    }

    const preferred = technicians.find(
      t =>
        t.id === (
          j?.preferredTechnicianId ||
          r.preferredTechnicianId
        )
    );

    return layout(
      `
        ${back()}
        ${pageHeading(
          'Repair Progress',
          '#' + esc(r.id)
        )}

        <section class="panel customer-review">
          <h2>${esc(r.device)}</h2>
          <p>${esc(r.category)}</p>
          ${badge(v.status)}
          <p>${esc(v.reason)}</p>
        </section>

        <section class="panel">
          <h2>Your repair request</h2>
          <dl class="customer-fields">
            ${field('Device', r.device)}
            ${field('Problem description', r.description || 'Not recorded')}
            ${r.note ? field('Your note', r.note) : ''}
          </dl>
          ${Array.isArray(r.photos) && r.photos.some(safePhoto) ? `
            <div class="customer-photos">${r.photos.filter(safePhoto).map(photo => `
              <div class="customer-photo">
                <img src="${esc(photo.src)}" alt="${esc(photo.name || 'Submitted device photo')}">
              </div>
            `).join('')}</div>
          ` : ''}
        </section>

        <section class="panel">
          <h2>What happens next</h2>

          <dl class="customer-fields">
            ${field('Next action', v.next)}
            ${field(
              'Last public update',
              time(p?.publishedAt)
            )}
            ${field(
              'Next update expected',
              p?.nextUpdate || 'Not confirmed yet'
            )}
            ${
              v.waiting.length
                ? field(
                    'Waiting on',
                    v.waiting.join(' · ')
                  )
                : ''
            }
          </dl>

          ${
            j?.publicProgress && !p && !v.final
              ? `
                <p class="prototype-note">
                  The repair stage changed.
                  A current public update is needed.
                </p>
              `
              : ''
          }
        </section>

        <section
          id="customer-response-slot"
          class="panel customer-review ${
            v.receipt ? 'customer-receipt' : ''
          }"
        >
          ${action}
        </section>

        <section class="panel">
          <h2>Repair timeline</h2>

          <ol class="customer-timeline">
            ${stages.map((s, i) => `
              <li
                class="${
                  i < current
                    ? 'done'
                    : i === current
                      ? 'current'
                      : 'pending'
                }"
                ${i === current ? 'aria-current="step"' : ''}
              >
                <span class="stage-dot">
                  ${i < current ? icon('check') : i + 1}
                </span>

                <div>
                  <strong>${s}</strong>
                  <small>${
                    i < current
                      ? 'Earlier stage'
                      : i === current
                        ? 'Current stage'
                        : 'Upcoming'
                  }</small>
                </div>
              </li>
            `).join('')}
          </ol>
        </section>

        <section class="panel customer-review">
          <h2>Your technician</h2>
          <strong>${esc(technician(r))}</strong>
          <p>
            Preference:
            ${esc(
              preferred?.name ||
              'Let the manager arrange'
            )}
          </p>
          <small>
            Preference is separate from confirmed assignment.
          </small>
        </section>

        ${nav(
          'customer-messages',
          'Message the Shop',
          r.id,
          'primary full'
        )}

        <p class="prototype-note">
          Submitted ${esc(time(r.submitted))} ·
          This browser tab only
        </p>
      `,
      'customer-repairs'
    );
  }

  function messages() {
    const id = route().id;
    const r = selected(id);

    if (id && !r) {
      return missing();
    }

    if (!r) {
      return layout(
        `
          ${pageHeading(
            'Messages',
            'Conversations about your repairs.'
          )}

          ${
            mine().map(x => `
              <button
                class="panel customer-message-row"
                data-customer-action="nav"
                data-page="customer-messages"
                data-id="${esc(x.id)}"
              >
                <span class="grow">
                  <strong>${esc(x.device)}</strong>
                  <small>${esc(technician(x))}</small>
                  <p>${
                    esc(
                      x.messages.at(-1)?.text ||
                      'Open repair conversation'
                    )
                  }</p>
                </span>
                <span>›</span>
              </button>
            `).join('') ||
            empty(
              'No conversations yet',
              'Submit a repair request first.'
            )
          }
        `,
        'customer-messages'
      );
    }

    return layout(
      `
        ${nav(
          'customer-progress',
          '← Back to Repair Progress',
          r.id,
          'back'
        )}

        ${pageHeading(
          'Repair Conversation',
          esc(r.device)
        )}

        <p class="customer-message-hint">
          Messages are stored in this tab.
          No external notification is sent.
        </p>

        <div class="customer-conversation">
          ${r.messages.map(m => `
            <article
              class="customer-message ${
                m.author === 'customer' ? 'sent' : ''
              }"
            >
              <strong>${
                m.author === 'customer' ? 'You' : 'Shop'
              }</strong>
              <p>${esc(m.text)}</p>
              <time>${esc(time(m.time))}</time>
            </article>
          `).join('')}
        </div>

        <form
          id="customer-message-form"
          data-id="${esc(r.id)}"
          class="customer-form"
        >
          <label class="field">
            Message
            <textarea
              name="message"
              required
              maxlength="1000"
            >${esc(messageDrafts[r.id] || '')}</textarea>
          </label>

          <button class="primary full">
            Send Message
          </button>
        </form>
      `,
      'customer-messages'
    );
  }

  function profile() {
    return layout(
      `
        ${pageHeading('Profile', 'Sample customer')}

        <section class="panel customer-review">
          <span class="avatar">AC</span>
          <h2>${account.name}</h2>
          <p>Demo customer C001</p>
        </section>

        <button
          class="secondary full"
          data-customer-action="logout"
        >
          Switch Role
        </button>

        <p class="prototype-note">
          No real authentication.
          Data stays in this tab.
        </p>
      `,
      'customer-profile'
    );
  }

  function publisher() {
    if (route().page !== 'job') {
      return;
    }

    const j = jobs.find(x => x.id === route().id);
    const main = document.querySelector('#app .main');

    if (!j || !main || (window.FixFlowManagerModel && FixFlowManagerModel.assignedId(j) !== activeTechnician)) {
      return;
    }

    const section = document.createElement('section');
    section.className = 'panel customer-publisher';

    section.innerHTML = `
      <h2>Customer progress update</h2>
      <p>Publish a confirmed explanation and next action.</p>

      <button
        class="secondary full"
        data-customer-action="publish"
        data-id="${esc(j.id)}"
      >
        Publish Customer Update
      </button>
    `;

    main.append(section);
  }

  function openPublisher(id) {
    const j = jobs.find(x => x.id === id);

    if (
      !j ||
      role !== 'technician' ||
      route().id !== id ||
      route().page !== 'job' ||
      (window.FixFlowManagerModel && FixFlowManagerModel.assignedId(j) !== activeTechnician)
    ) {
      return;
    }

    const p = publication(j);

    const final = [
      'Completed',
      'Awaiting Customer Confirmation'
    ].includes(j.status);

    openSheet(
      'Publish Customer Update',
      `
        <form
          id="customer-public-form"
          data-id="${esc(id)}"
          data-stage="${esc(j.status)}"
          class="customer-form"
        >
          <label class="field">
            Public explanation
            <textarea
              name="reason"
              required
              maxlength="300"
            >${esc(p?.reason || '')}</textarea>
          </label>

          <label class="field">
            Next action
            <textarea
              name="nextAction"
              required
              maxlength="250"
            >${esc(p?.nextAction || '')}</textarea>
          </label>

          <label class="field">
            Next update expected
            <small>Leave blank if unknown</small>
            <input
              name="nextUpdate"
              maxlength="100"
              value="${esc(p?.nextUpdate || '')}"
            >
          </label>

          <fieldset
            class="customer-waits"
            ${final ? 'disabled' : ''}
          >
            <legend>Published waiting reasons</legend>

            ${Object.entries(waits).map(([key, text]) => `
              <label>
                <input
                  type="checkbox"
                  name="waitingFor"
                  value="${key}"
                  ${
                    p?.waitingFor?.includes(key) && !final
                      ? 'checked'
                      : ''
                  }
                >
                ${text}
              </label>
            `).join('')}
          </fieldset>

          <label class="customer-check">
            <input
              type="checkbox"
              name="actionRequired"
              ${p?.actionRequired && !final ? 'checked' : ''}
              ${final ? 'disabled' : ''}
            >
            Customer response required
          </label>

          <small>
            Only this explanation is published.
            Requesting a reply does not approve additional work.
          </small>

          <button class="primary full">
            Publish Update
          </button>
        </form>
      `
    );
  }

  // Yixin: presentation navigation uses the existing role and customer record mapping.
  window.FixFlowJourney = {
    role: () => role,
    records: () => mine().map(r => ({id:r.id, jobId:r.jobId, device:r.device})),
    open(targetRole, jobId, newRequest = false) {
      if (!['customer','manager','technician'].includes(targetRole)) return false;
      if (role === 'manager' && window.FixFlowManager?.mayLeave && !window.FixFlowManager.mayLeave()) return false;
      if (document.querySelector('#modal-root .sheet')) {
        toast('Save or close the current dialog before switching workspace.'); return false;
      }
      if (document.querySelector('#app form') && role !== 'manager' && !confirm('Leave this page? Unsaved form edits may be lost.')) return false;
      const repair = mine().find(r => r.jobId === jobId);
      const job = jobs.find(j => j.id === jobId);
      if (jobId && !job) { toast('This repair is no longer available.'); return false; }
      if (targetRole === 'customer' && jobId && !repair) { toast('This repair is not linked to the demo customer.'); return false; }
      if (targetRole === 'technician' && jobId && !managerRules.assignedId(job)) { toast('Ask the manager to assign a technician first.'); return false; }
      if (targetRole === 'technician' && job) {
        activeTechnician = managerRules.assignedId(job);
        try { sessionStorage.setItem('fixflow-technician', activeTechnician); } catch {}
      }
      role = targetRole;
      try { sessionStorage.setItem('fixflow-role', role); } catch {}
      const page = role === 'customer' ? (newRequest ? 'customer-request' : repair ? 'customer-progress' : 'customer-home') : role === 'manager' ? 'manager' : job ? 'job' : 'dashboard';
      // Replace synchronously so all role modules render the same selected record.
      history.pushState(null, '', '#' + page + (jobId && !newRequest ? '/' + (role === 'customer' ? repair.id : jobId) : ''));
      render();
      document.querySelector('#app .main')?.scrollTo(0, 0);
      return true;
    }
  };

  const technicianRender = render;

  render = function () {
    pendingControl = null;
    const page = route().page;

    if (!role || page === 'login') {
      if (page !== 'login') {
        history.replaceState(null, '', '#login');
      }

      document.querySelector('#app').innerHTML =
        `<div class="shell">${login()}</div>`;

      document.title = 'FixFlow | Select Your Role';
      return;
    }

    if (role === 'manager') {
      if (page !== 'manager') history.replaceState(null, '', '#manager');
      if (window.FixFlowManager) window.FixFlowManager.render();
      return;
    }

    if (role === 'customer') {
      const pages = {
        'customer-home': home,
        'customer-repairs': list,
        'customer-request': requestPage,
        'customer-technicians': chooseTechnician,
        'customer-progress': progress,
        'customer-messages': messages,
        'customer-profile': profile
      };

      if (!pages[page]) {
        history.replaceState(null, '', '#customer-home');
      }

      document.querySelector('#app').innerHTML =
        `<div class="shell">${(pages[page] || home)()}</div>`;

      if (pendingControl) {
        document
          .querySelector('#customer-response-slot')
          ?.replaceChildren(pendingControl);
      }

      document.title = 'FixFlow | Customer';
      return;
    }

    if (page.startsWith('customer-')) {
      history.replaceState(null, '', '#dashboard');
    }

    technicianRender();
    publisher();

    const header = document.querySelector('#app .header');

    if (header) {
      const button = document.createElement('button');
      button.className = 'text-button';
      button.textContent = 'Switch Role';
      button.dataset.customerAction = 'logout';
      header.append(button);
    }
  };

  document.addEventListener('click', event => {
    const button = event.target.closest(
      '[data-customer-action]'
    );

    if (!button) {
      return;
    }

    const action = button.dataset.customerAction;

    if (
      action === 'login' &&
      ['customer', 'technician', 'manager'].includes(
        button.dataset.role
      )
    ) {
      role = button.dataset.role;

      try {
        sessionStorage.setItem('fixflow-role', role);
      } catch {}

      go(
        role === 'customer'
          ? 'customer-home'
          : role === 'manager' ? 'manager' : 'dashboard'
      );
    } else if (action === 'logout') {
      role = null;
      draft = blank();

      try {
        sessionStorage.removeItem('fixflow-role');
      } catch {}

      closeSheet();
      go('login');
    } else if (action === 'publish') {
      openPublisher(button.dataset.id);
    } else if (role === 'customer') {
      if (action === 'nav') {
        go(button.dataset.page, button.dataset.id);
      }

      if (action === 'select-tech') {
        draft.techId = button.dataset.id;
        render();
      }

      if (action === 'submit-repair') {
        submitRepair();
      }

      if (action === 'remove-photo') {
        draft.photos.splice(
          Number(button.dataset.index),
          1
        );

        document.querySelector(
          '#customer-photo-preview'
        ).innerHTML = photos();
      }
    }
  });

  document.addEventListener('input', event => {
    if (role !== 'customer') {
      return;
    }

    if (
      event.target.form?.id === 'customer-request-form' &&
      [
        'device',
        'description',
        'note',
        'type',
        'category'
      ].includes(event.target.name)
    ) {
      draft[event.target.name] = event.target.value;
    }

    if (
      event.target.form?.id === 'customer-message-form'
    ) {
      messageDrafts[event.target.form.dataset.id] =
        event.target.value;
    }
  });

  document.addEventListener('change', async event => {
    if (
      role !== 'customer' ||
      event.target.id !== 'customer-photo-input'
    ) {
      return;
    }

    const current = draft;

    for (const file of event.target.files) {
      if (current.photos.length >= 3) {
        toast('Add up to 3 photos.');
        break;
      }

      if (
        ![
          'image/jpeg',
          'image/png',
          'image/webp'
        ].includes(file.type) ||
        file.size > 2 * 1024 * 1024
      ) {
        toast('Choose JPG, PNG or WebP under 2 MB.');
        continue;
      }

      try {
        const src = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        if (
          draft !== current ||
          role !== 'customer'
        ) {
          return;
        }

        if (current.photos.length < 3) {
          current.photos.push({
            name: file.name,
            src
          });
        }
      } catch {
        toast('Could not read this photo.');
      }
    }

    const preview = document.querySelector(
      '#customer-photo-preview'
    );

    if (preview && draft === current) {
      preview.innerHTML = photos();
    }
  });

  document.addEventListener(
    'submit',
    event => {
      const form = event.target;

      if (
        ![
          'customer-request-form',
          'customer-message-form',
          'customer-public-form'
        ].includes(form.id)
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (!form.reportValidity()) {
        return;
      }

      const data = new FormData(form);

      if (form.id === 'customer-public-form') {
        const j = jobs.find(
          x => x.id === form.dataset.id
        );

        if (
          role !== 'technician' ||
          route().page !== 'job' ||
          route().id !== j?.id ||
          j.status !== form.dataset.stage
        ) {
          return toast(
            'Reopen this repair and its update form.'
          );
        }

        const reason = String(
          data.get('reason') || ''
        ).trim();

        const nextAction = String(
          data.get('nextAction') || ''
        ).trim();

        const nextUpdate = String(
          data.get('nextUpdate') || ''
        ).trim();

        if (
          !reason ||
          !nextAction ||
          reason.length > 300 ||
          nextAction.length > 250 ||
          nextUpdate.length > 100
        ) {
          return toast(
            'Enter a concise public explanation and next action.'
          );
        }

        const final = [
          'Completed',
          'Awaiting Customer Confirmation'
        ].includes(j.status);

        const publicProgress = {
          reason,
          nextAction,
          nextUpdate,
          actionRequired:
            !final && data.has('actionRequired'),
          waitingFor: final
            ? []
            : data.getAll('waitingFor').filter(
                k => Object.hasOwn(waits, k)
              ),
          statusAtPublication: j.status,
          publishedAt: new Date().toISOString()
        };

        const saved = persist(
          jobs.map(x =>
            x.id === j.id
              ? { ...x, publicProgress }
              : x
          )
        );

        if (saved) {
          closeSheet();
          render();
          toast('Customer update published.');
        }

        return;
      }

      if (role !== 'customer') {
        return;
      }

      if (form.id === 'customer-request-form') {
        for (
          const key of [
            'type',
            'device',
            'category',
            'description',
            'note'
          ]
        ) {
          draft[key] = String(
            data.get(key) || ''
          ).trim();
        }

        if (!draft.device || !draft.description) {
          return toast(
            'Enter a device model and problem description.'
          );
        }

        go('customer-technicians');
        return;
      }

      const r = selected(form.dataset.id);

      const text = String(
        data.get('message') || ''
      ).trim();

      if (
        !r ||
        r.id !== route().id ||
        !text ||
        text.length > 1000
      ) {
        return toast('Check the repair and message.');
      }

      const next = repairs.map(x =>
        x.id === r.id
          ? {
              ...x,
              messages: [
                ...x.messages,
                {
                  author: 'customer',
                  text,
                  time: new Date().toISOString()
                }
              ]
            }
          : x
      );

      if (persist(jobs, next)) {
        delete messageDrafts[r.id];
        render();
        toast('Message saved in this repair conversation.');
      }
    },
    true
  );

  window.addEventListener(
    'fixflow:customer-action-saved',
    () => {
      if (role === 'customer') {
        render();
      }
    }
  );

  render();
})();