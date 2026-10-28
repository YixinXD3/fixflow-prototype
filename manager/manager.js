(function () {
  'use strict';
  const model = window.ManagerModel;
  const key = 'fixflow-manager-followup-v1';
  const $ = selector => document.querySelector(selector);
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let state = model.seed(); let selected = state.shortages[0].id; let filter = 'active'; let dirty = false;
  function warn(text) { $('#storage-warning').hidden = false; $('#storage-warning').textContent = text; }
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (model.isState(parsed)) state = parsed;
      else warn('Saved practice data could not be read. The fictional starting requests are shown. Reset practice data to replace the saved session.');
    }
  } catch (_) { warn('Session storage is unavailable or contains unreadable data. You can work in this page, but changes may not survive a reload.'); }
  function save() {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
      $('#storage-warning').hidden = true;
      $('#storage-warning').textContent = '';
      return true;
    }
    catch (_) { warn('Changes are available on this page only. Browser storage could not save them; keep this page open.'); return false; }
  }
  function badge(status) { return `<span class="badge ${status.toLowerCase().replaceAll(' ', '-')}">${esc(status)}</span>`; }
  function visible() { return state.shortages.filter(s => filter === 'all' || (filter === 'active' && s.status !== 'Received') || (filter === 'unassigned' && !s.owner && s.status !== 'Received') || (filter === 'received' && s.status === 'Received')); }
  function time(text) { if (!text) return 'Not updated yet'; const date = new Date(text); return isNaN(date) ? 'Unknown update time' : date.toLocaleString(); }
  function renderQueue() {
    const active = state.shortages.filter(s => s.status !== 'Received');
    $('#metrics').innerHTML = [['Needs follow-up', active.length], ['Unassigned', active.filter(s => !s.owner).length], ['Parts received', state.shortages.length - active.length]].map(([label, count]) => `<div class="metric"><span>${label}</span><strong>${count}</strong></div>`).join('');
    const list = visible();
    $('#queue-count').textContent = `${list.length} ${list.length === 1 ? 'request' : 'requests'}`;
    $('#queue-list').innerHTML = list.length ? list.map(s => {
      const j = state.jobs.find(item => item.id === s.jobId);
      return `<button class="request ${s.id === selected ? 'selected' : ''}" data-id="${esc(s.id)}" aria-pressed="${s.id === selected}"><span class="job">${esc(s.jobId)}</span><strong>${esc(s.part)}</strong><span class="device">${esc(j.device)}</span>${badge(s.status)}<span class="owner">Follow-up owner: ${esc(s.owner || 'Unassigned')}</span></button>`;
    }).join('') : '<p class="empty">No requests match this filter.</p>';
  }
  function renderDetail() {
    const s = state.shortages.find(item => item.id === selected);
    if (!s) { $('#detail').innerHTML = '<h2>Select a parts request</h2><p class="empty">Choose a different filter to find a request.</p>'; return; }
    const j = state.jobs.find(item => item.id === s.jobId);
    $('#detail').innerHTML = `<div class="detail-head"><div><p class="eyebrow">${esc(s.jobId)} · QTY ${s.quantity}</p><h2>${esc(s.part)}</h2><p class="device-name">${esc(j.device)}</p></div>${badge(s.status)}</div>
      <div class="repair-context"><p><strong>Repair status:</strong> <span id="repair-status">${esc(j.repairStatus)}</span></p>${j.otherBlocker ? `<p><strong>Other blocker:</strong> ${esc(j.otherBlocker)}</p>` : ''}<p>Receiving a part does not automatically resume or complete this repair.</p></div>
      <form id="followup-form" novalidate>
        <div class="field-grid"><label class="field"><span>Follow-up owner <span aria-hidden="true">*</span></span><select id="owner" name="owner" required aria-describedby="form-error"><option value="">Choose a staff member</option>${model.owners.map(v => `<option ${s.owner === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Follow-up status <span aria-hidden="true">*</span></span><select id="status" name="status" required aria-describedby="status-hint form-error">${model.statuses.map(v => `<option ${s.status === v ? 'selected' : ''}>${v}</option>`).join('')}</select><small id="status-hint">Reported → follow-up needed. Ordered → an order has been recorded. Received → receipt has been checked.</small></label></div>
        <label class="field full-field"><span>Next action <span aria-hidden="true">*</span></span><textarea id="nextAction" name="nextAction" required maxlength="240" rows="3" aria-describedby="action-hint form-error">${esc(s.nextAction)}</textarea><small id="action-hint">A short, specific instruction. Up to 240 characters.</small></label>
        <label class="field"><span>Expected arrival <small style="display:inline">optional</small></span><input type="date" id="expectedArrival" name="expectedArrival" value="${esc(s.expectedArrival)}" aria-describedby="arrival-hint form-error"><small id="arrival-hint">Leave blank if unknown. Current estimate: ${esc(s.expectedArrival || 'Not yet known')}.</small></label>
        <p id="form-error" class="error" role="alert"></p><div class="actions"><button class="primary" type="submit">Save follow-up</button><small>Last update: ${esc(time(s.updatedAt))}</small></div>
      </form><section class="history" aria-labelledby="history-title"><h3 id="history-title">Follow-up history</h3>${s.history.length ? `<ol>${s.history.map(h => `<li><strong>${esc(h.from)} → ${esc(h.to)}</strong> · ${esc(h.owner)}<br>${esc(h.nextAction)}<br>Expected arrival: ${esc(h.expectedArrival || 'Not yet known')}<time>${esc(time(h.time))}</time></li>`).join('')}</ol>` : '<p class="hint">No follow-up changes recorded in this practice session.</p>'}</section>`;
  }
  function render() { renderQueue(); renderDetail(); dirty = false; }
  function mayLeave() { return !dirty || window.confirm('Discard the unsaved changes to this parts request?'); }
  $('#queue-list').addEventListener('click', event => {
    const target = event.target.closest('[data-id]');
    if (!target || target.dataset.id === selected || !mayLeave()) return;
    selected = target.dataset.id; $('#feedback').textContent = ''; render();
    $('#detail h2').setAttribute('tabindex', '-1'); $('#detail h2').focus();
  });
  $('#filter').addEventListener('change', event => {
    if (!mayLeave()) { event.target.value = filter; return; }
    filter = event.target.value; selected = visible()[0]?.id || ''; $('#feedback').textContent = ''; render();
  });
  $('#detail').addEventListener('input', () => { dirty = true; $('#feedback').textContent = ''; });
  $('#detail').addEventListener('change', () => { dirty = true; $('#feedback').textContent = ''; });
  $('#detail').addEventListener('submit', event => {
    event.preventDefault();
    const fields = new FormData(event.target);
    const input = Object.fromEntries(fields);
    const result = model.update(state, selected, input, new Date().toISOString());
    if (result.error) {
      event.target.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
      $('#form-error').textContent = result.error.message;
      const field = result.error.field && document.getElementById(result.error.field);
      if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
      return;
    }
    state = result.state;
    const persisted = save();
    // Keep a newly received request selected until the user chooses another one.
    if (filter === 'active' && state.shortages.find(s => s.id === selected).status === 'Received') { filter = 'all'; $('#filter').value = 'all'; }
    if (filter === 'unassigned' && state.shortages.find(s => s.id === selected).owner) { filter = 'all'; $('#filter').value = 'all'; }
    render();
    $('#feedback').textContent = result.changed ? (persisted ? 'Follow-up saved for this browser tab. Repair status is unchanged.' : 'Follow-up updated on this page only. Repair status is unchanged.') : (persisted ? 'No changes to save.' : 'No changes to save; browser storage is unavailable.');
    $('#followup-form button[type=submit]').focus();
  });
  $('#reset').addEventListener('click', () => $('#reset-dialog').showModal());
  $('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
  $('#confirm-reset').addEventListener('click', () => {
    state = model.seed(); selected = state.shortages[0].id; filter = 'active'; $('#filter').value = filter;
    const persisted = save(); $('#reset-dialog').close(); render();
    $('#feedback').textContent = persisted ? 'Practice data reset. Technician data was not changed.' : 'Practice data reset on this page only. Technician data was not changed.';
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  render();
})();
