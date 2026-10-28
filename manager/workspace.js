/* Manager UI over the same in-memory/session jobs used by customer.js and app.js. */
(function () {
  'use strict';
  const model = window.FixFlowManagerModel;
  let filter = 'active', selected = '', dirty = false, feedback = '';
  const time = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-AU') : 'Not recorded';
  const options = (items, value) => items.map(([id,label]) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const jobName = id => model.technician(id)?.name || 'Unassigned';
  function list() { return jobs.filter(j => filter === 'all' || (filter === 'active' && !model.final(j)) || (filter === 'unassigned' && !model.assignedId(j) && !model.final(j)) || (filter === 'waiting' && j.status === 'Waiting')); }

  function procurement(job, shortage) {
    const saved = shortage.procurement;
    const r = saved || {stockCheck:'unchecked',stockNote:'',partDescription:shortage.part || shortage.comment || shortage.type,quantity:1,supplierName:'',email:'',website:'',subject:'Parts enquiry — repair '+job.id,body:'Hello,\n\nPlease confirm availability, compatibility, price and delivery time for:\nPart: '+(shortage.part || shortage.comment || shortage.type)+'\nDevice: '+job.device+'\nQuantity: 1\nRepair reference: '+job.id+'\n\nPlease send a quote before any order is placed.\nThank you.',orderReference:''};
    const links = model.supplierLinks(saved);
    const field = (label,name,type='text',max=200) => `<label class="field">${label}<input name="${name}" type="${type}" maxlength="${max}" value="${esc(r[name] || '')}"></label>`;
    return `<details class="manager-procurement"><summary>Check stock and contact supplier</summary><p>Confirm the part is needed, then check stock. Contact a supplier if the part is unavailable.</p>
      <form data-manager-form="procurement" data-job-id="${esc(job.id)}" data-shortage-id="${esc(shortage.id)}"><fieldset ${model.final(job) ? 'disabled' : ''}>
      <label class="field">Stock check<select name="stockCheck" aria-label="Stock check">${options([['unchecked','Not checked yet'],['available','Available in shop'],['unavailable','Unavailable — contact supplier']],r.stockCheck)}</select></label>
      <label class="field">Requirement and stock check notes<textarea aria-label="Requirement and stock check notes" name="stockNote" rows="2" required maxlength="500">${esc(r.stockNote)}</textarea></label>
      <div class="manager-grid">${field('Required part','partDescription')}<label class="field">Quantity<input name="quantity" type="number" min="1" max="999" step="1" required value="${esc(r.quantity)}"></label></div>
      <p class="muted">If stock is available, arrange an internal handover and update the parts follow-up after it is received. This is a manual stock check.</p>
      ${field('Supplier name','supplierName','text',120)}${field('Supplier email (optional)','email','email',254)}${field('Supplier website (optional, HTTPS)','website','url',1000)}
      ${field('Email subject','subject')}<label class="field">Email message<textarea aria-label="Email message" name="body" rows="8" maxlength="2000">${esc(r.body)}</textarea></label>
      <p class="muted">Review the part and quantity in the message before opening your email app. Do not include customer personal details.</p>
      ${field('External order reference (optional)','orderReference','text',120)}<p class="manager-error" role="alert"></p><button class="primary" type="submit">Save stock and supplier details</button></fieldset></form>
      <div class="manager-supplier-links">${!model.final(job) && links.email ? `<a class="secondary" data-supplier-contact href="${esc(links.email)}">Open email draft</a>` : ''}${!model.final(job) && links.website ? `<a class="secondary" data-supplier-contact href="${esc(links.website)}" target="_blank" rel="noopener noreferrer">Open supplier website</a>` : ''}</div>
      <p class="muted">Save details to enable contact links when stock is unavailable. Email opens in your configured mail app for review and sending; website orders are placed externally. Opening a link does not mark an order as placed. Record Ordered and the reference only after you have placed the order.</p>
      <details><summary>Stock and supplier history (${shortage.procurementHistory?.length || 0})</summary><ol>${(shortage.procurementHistory || []).map(h=>`<li>${esc(time(h.updatedAt))} · ${esc(h.stockCheck)}<p>${esc(h.stockNote)}</p><p>${esc(h.supplierName)} · ${esc(h.partDescription)} × ${esc(h.quantity)} · Reference: ${esc(h.orderReference || 'Not recorded')}</p></li>`).join('')}</ol></details></details>`;
  }
  function shortages(job) {
    if (!job.shortages?.length) return '<p class="muted">No parts requests have been reported for this repair.</p>';
    return job.shortages.map(s => `<article class="manager-part"><h3>${esc(s.part || s.type)}</h3><p>${esc(s.comment)}</p><p class="muted">Reported: ${esc(time(s.createdAt || s.time))} · ${esc(s.reportedBy || 'Legacy technician report')} · ${s.blocking === false ? 'Does not block work' : 'Blocks work until received'}</p>
      <form data-manager-form="shortage" data-job-id="${esc(job.id)}" data-shortage-id="${esc(s.id)}"><fieldset ${model.final(job) ? 'disabled' : ''}><div class="manager-grid"><label class="field">Follow-up owner<select name="owner" required><option value="">Choose an owner</option>${options(['Demo manager',...model.technicians.map(t=>t.name)].map(n=>[n,n]),s.owner)}</select></label><label class="field">Parts status<select name="status">${options(model.statuses.map(v=>[v,v]),s.status || (s.fulfilled ? 'Received' : 'Reported'))}</select></label></div><label class="field">Next action<textarea name="nextAction" required maxlength="240" rows="2">${esc(s.nextAction || '')}</textarea></label><label class="field">Expected arrival (optional)<input name="expectedArrival" type="date" value="${esc(s.expectedArrival || '')}"></label><p class="muted">Leave the date blank if unknown. Ordered records a manual follow-up; it does not place an order.</p><p class="manager-error" role="alert"></p><button class="primary" type="submit">Save parts follow-up</button></fieldset></form>
      ${procurement(job,s)}<details><summary>Parts history (${s.history?.length || 0})</summary><ol>${(s.history || []).map(h=>`<li>${esc(h.from)} → ${esc(h.to)} · ${esc(h.owner)} · ${esc(time(h.at || h.time))}<p>${esc(h.nextAction)}</p></li>`).join('')}</ol></details></article>`).join('');
  }
  function proposals(job) {
    const p = model.proposal(job);
    const locked = model.final(job);
    return `<p class="muted">Explain only the proposed work and additional cost. No payment is collected.</p>
      ${p ? `<div class="manager-current"><strong>Current proposal: ${esc(p.status)}</strong><p>${esc(p.description)} · AUD ${esc(p.additionalCost)}</p>${p.response ? `<p>Customer response: <strong>${esc(p.response.kind)}</strong> ${esc(p.response.note)}</p>` : ''}${p.withdrawalReason ? `<p>Withdrawal: ${esc(p.withdrawalReason)}</p>` : ''}</div>` : '<p>No proposal has been published.</p>'}
      ${!locked ? `<form data-manager-form="propose" data-job-id="${esc(job.id)}"><label class="field">Reason for additional work<textarea name="reason" required maxlength="500" rows="2"></textarea></label><label class="field">Proposed repair work<textarea name="description" required maxlength="1000" rows="2"></textarea></label><label class="field">Additional cost (AUD)<input name="additionalCost" type="number" min="0" max="100000" step="0.01" required></label><p class="muted">Publishing a revision creates a new ID and preserves all earlier responses. An approved proposal must be explicitly withdrawn before replacement.</p><p class="manager-error" role="alert"></p><button class="primary" type="submit">${p && !['withdrawn','superseded'].includes(p.status) ? 'Publish revised proposal' : 'Publish proposal'}</button></form>
      ${p && !['withdrawn','superseded'].includes(p.status) ? `<form data-manager-form="withdraw" data-job-id="${esc(job.id)}"><label class="field">Reason for withdrawing extra work<textarea name="reason" required maxlength="500" rows="2"></textarea></label><p class="manager-error" role="alert"></p><button class="secondary" type="submit">Withdraw proposal</button></form>` : ''}` : ''}
      <details><summary>All proposal versions (${job.approvalRequests?.length || 0})</summary><ol>${(job.approvalRequests || []).map(x=>`<li><strong>${esc(x.description)}</strong><p>${esc(x.reason)} · AUD ${esc(x.additionalCost)} · ${esc(x.status)}</p><p>${esc(x.id)} · ${esc(time(x.createdAt))}</p>${x.response ? `<p>Response retained: ${esc(x.response.kind)} · ${esc(x.response.note)} · ${esc(time(x.response.at))}</p>` : ''}</li>`).join('')}</ol></details>`;
  }
  function detail(job) {
    if (!job) return '<section class="panel"><h2>No matching repairs</h2><p>Choose another filter or submit a repair as a customer.</p></section>';
    const blockers = model.blockers(job, requests);
    return `<section class="panel manager-detail"><p class="muted">${esc(job.id)}</p><h2>${esc(job.device)}</h2><p>${esc(job.customerDescription || job.issue)}</p><p>${badge(job.status)} · Customer: ${esc(job.customer)}</p>${model.final(job) ? '<p class="manager-current">This repair is read-only. Only the customer can confirm completion.</p>' : ''}
      <h3>Technician assignment</h3><p>Customer preference: <strong>${esc(model.technician(job.preferredTechnicianId)?.name || 'Shop to arrange')}</strong></p><p>Actual assignment: <strong>${esc(jobName(model.assignedId(job)))}</strong></p>
      <form data-manager-form="assign" data-job-id="${esc(job.id)}"><fieldset ${model.final(job) ? 'disabled' : ''}><label class="field">Assigned technician<select name="technicianId" required><option value="">Choose a technician</option>${options(model.technicians.map(t=>[t.id,t.name]),model.assignedId(job))}</select></label><p class="manager-error" role="alert"></p><button class="primary" type="submit">Save assignment</button></fieldset></form>
      <details><summary>Assignment history (${job.assignmentHistory?.length || 0})</summary><ol>${(job.assignmentHistory || []).map(h=>`<li>${esc(jobName(h.from))} → ${esc(jobName(h.to))} · ${esc(h.actor)} · ${esc(time(h.at))}</li>`).join('')}</ol></details>
      <section><h3>Outstanding actions</h3>${blockers.length ? `<ul>${blockers.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>` : '<p>No recorded blocking parts, help requests or customer decisions.</p>'}<p class="muted">Receiving parts or approving extra work does not automatically resume or complete the repair.</p></section>
      <section><h3>Parts follow-up</h3>${shortages(job)}</section><section><h3>Extra repair work</h3>${proposals(job)}</section>
      <details><summary>Repair history (${job.logs?.length || 0})</summary><ol>${(job.logs || []).map(l=>`<li><strong>${esc(l.title)}</strong><p>${esc(l.note)}</p><small>${esc(l.time)}</small></li>`).join('')}</ol></details></section>`;
  }
  function renderManager() {
    const visible = list();
    if (!visible.some(j=>j.id === selected)) selected = visible[0]?.id || '';
    document.title = 'FixFlow | Manager';
    $('#app').innerHTML = `<div class="shell manager-shell"><header class="header"><img class="logo" src="assets/favicon.svg" alt=""><div class="brand"><strong>FixFlow</strong><small>Manager workspace</small></div><button class="secondary" data-customer-action="logout">Switch Role</button></header><main class="main manager-main"><h1>Repair overview</h1><p class="muted">Review assignments, parts follow-up and customer decisions.</p><p class="prototype-note">Shared demonstration in this browser tab · No real orders, payments or account security</p><p class="manager-feedback" role="status">${esc(feedback)}</p><label class="field">Show repairs<select id="manager-filter">${options([['active','Active repairs'],['unassigned','Needs assignment'],['waiting','Waiting'],['all','All repairs']],filter)}</select></label><div class="manager-layout"><aside aria-label="Repair queue">${visible.map(j=>`<button class="manager-job ${selected === j.id ? 'selected' : ''}" data-manager-job="${esc(j.id)}" aria-pressed="${selected === j.id}"><strong>${esc(j.device)}</strong><small>${esc(j.id)}</small>${badge(j.status)}<span>${esc(jobName(model.assignedId(j)))}</span></button>`).join('') || '<p>No repairs match.</p>'}</aside>${detail(jobs.find(j=>j.id === selected))}</div></main></div>`;
    dirty = false;
  }
  function mayLeave() { return !dirty || confirm('Discard unsaved manager form changes?'); }
  document.addEventListener('click', event=>{
    const contact = event.target.closest('[data-supplier-contact]');
    if (contact && dirty) { event.preventDefault(); alert('Save your stock and supplier changes before opening the saved contact details.'); return; }
    const b = event.target.closest('[data-manager-job]');
    if (b && mayLeave()) { selected = b.dataset.managerJob; feedback = ''; renderManager(); }
    if (event.target.closest('.manager-shell [data-customer-action="logout"]') && !mayLeave()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('input', event=>{if (event.target.closest('[data-manager-form]')) dirty = true;});
  document.addEventListener('change', event=>{
    if (event.target.closest('[data-manager-form]')) dirty = true;
    if (event.target.id !== 'manager-filter') return;
    if (!mayLeave()) { event.target.value = filter; return; }
    filter = event.target.value; selected = ''; feedback = ''; renderManager();
  });
  document.addEventListener('submit', event=>{
    const form = event.target;
    if (!form.dataset.managerForm) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!form.reportValidity()) return;
    const input = Object.fromEntries(new FormData(form));
    input.shortageId = form.dataset.shortageId;
    const original = jobs.find(j=>j.id === form.dataset.jobId);
    const result = model.operate(original, form.dataset.managerForm, input, new Date().toISOString(), crypto.randomUUID());
    const error = form.querySelector('.manager-error');
    if (result.error) { error.textContent = result.error; return; }
    const next = jobs.map(j=>j.id === original.id ? result.job : j);
    try {
      // Persist first: a failed save leaves both the shared record and form input intact.
      sessionStorage.setItem('fixflow-prototype-v1', JSON.stringify({jobs:next,requests,labels,techs}));
    } catch (_) { error.textContent = 'Could not save. Your input is retained; free browser storage and retry.'; return; }
    jobs = next;
    feedback = result.changed ? 'Saved for this browser tab.' : 'No assignment change was needed.';
    if (!list().some(j=>j.id === original.id)) filter = 'all';
    selected = original.id;
    renderManager();
  },true);
  window.addEventListener('beforeunload',e=>{if(dirty && route().page === 'manager'){e.preventDefault();e.returnValue='';}});
  window.FixFlowManager = {render:renderManager};
  render();
})();
