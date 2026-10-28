/* Yixin: presentation-only handoffs. Business actions remain in their owners' modules. */
(() => {
  'use strict';
  const api = window.FixFlowJourney;
  if (!api) return;
  const panel = document.createElement('aside');
  panel.id = 'journey';
  panel.setAttribute('aria-label', 'Cross-role repair journey');
  document.body.append(panel);
  let selectedId = '', expanded = false;
  const names = {customer:'Customer',manager:'Manager',technician:'Technician'};
  function update() {
    const records = api.records();
    const current = route();
    const linked = records.find(r => current.page === 'customer-progress' ? r.id === current.id : r.jobId === current.id);
    if (linked) selectedId = linked.jobId;
    if (!records.some(r => r.jobId === selectedId)) selectedId = records[0]?.jobId || '';
    const job = jobs.find(j => j.id === selectedId);
    const assigned = job && managerRules.assignedId(job);
    const blocks = job ? managerRules.blockers(job, requests) : [];
    const proposal = job && managerRules.proposal(job);
    let owner = 'customer', next = 'Submit a repair request to start a shared journey.';
    if (job) {
      if (job.status === 'Completed') next = 'Repair confirmed. View the customer’s completed repair record.';
      else if (job.status === 'Awaiting Customer Confirmation') next = 'Review the completed repair and confirm as the customer.';
      else if (!assigned) { owner='manager'; next='Assign a technician to this request.'; }
      else if (proposal?.status === 'pending') next='Review the proposed work and additional cost, then respond.';
      else if (proposal && ['declined','clarification'].includes(proposal.status)) {owner='manager';next='Review the customer response; revise or withdraw the proposal.';}
      else if ((job.shortages || []).some(s=>s.blocking!==false && !s.fulfilled && s.status!=='Received')) {owner='manager';next='Follow up the missing parts. Record receipt when they arrive.';}
      else { owner='technician'; next=blocks.length ? 'Open the repair’s help conversation and resolve the remaining request.' : job.status==='To Do' ? 'Start the assigned repair and publish a customer progress update.' : job.status==='Waiting' ? 'All recorded blockers are clear. Explicitly continue the repair.' : 'Record progress, then mark the repair ready for customer confirmation.'; }
    }
    const step = !job ? -1 : job.status==='Completed' ? 5 : job.status==='Awaiting Customer Confirmation' ? 4 : ['In Progress','Waiting'].includes(job.status) ? 3 : assigned ? 2 : 1;
    const stages=['Request submitted','Manager assignment','Technician ready','Repair & collaboration','Customer confirmation','Completed'];
    panel.classList.toggle('expanded', expanded);
    panel.innerHTML = `<button class="journey-toggle" aria-expanded="${expanded}" aria-controls="journey-body"><span>↔ &nbsp; Repair journey</span><span>${expanded?'Close':'Open'}</span></button><div id="journey-body"><div class="journey-eyebrow">FIXFLOW / CLASSROOM DEMO</div><h1>One repair.<br>One connected team.</h1><p class="journey-intro">Follow the handoff from request to customer confirmation.</p><div class="journey-roles" aria-label="Demo workspaces">${Object.entries(names).map(([id,name])=>`<button data-journey-role="${id}" aria-pressed="${api.role()===id}" ${id==='technician'&&job&&!assigned?'disabled':''}>${name}</button>`).join('')}</div><label class="journey-label" for="journey-repair">Shared repair</label><select id="journey-repair">${records.length ? records.map(r=>`<option value="${esc(r.jobId)}" ${r.jobId===selectedId?'selected':''}>${esc(r.jobId)} · ${esc(r.device)}</option>`).join('') : '<option value="">No customer requests yet</option>'}</select>${job?`<p class="journey-status">${esc(job.status)} <span>· ${esc(job.id)}</span></p>`:''}<ol class="journey-steps">${stages.map((s,i)=>`<li class="${i<step?'done':i===step?'current':''}" ${i===step?'aria-current="step"':''}><span>${i<step?'✓':i+1}</span>${s}</li>`).join('')}</ol><section class="journey-next"><span>NEXT · ${names[owner].toUpperCase()}</span><p>${esc(next)}</p><button data-journey-role="${owner}">${job?'Open '+names[owner]+' workspace':'Start a repair'} →</button></section>${blocks.length?`<details class="journey-blockers"><summary>${blocks.length} outstanding blocker${blocks.length===1?'':'s'}</summary><p>Resolve each separately, then the assigned technician resumes.</p><ul>${api.role()==='customer' || !api.role() ? '<li>Shop follow-up is required. See customer progress for published details.</li>' : blocks.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}<button class="journey-new" data-journey-new>＋ New customer request</button><p class="journey-note">Demo role switching · same browser tab.<br>Refresh keeps this session. No backend, real messages or payments.</p></div>`;
  }
  panel.addEventListener('click', e => {
    if(e.target.closest('.journey-toggle')) { expanded=!expanded;update();return; }
    const button=e.target.closest('[data-journey-role], [data-journey-new]');
    if(!button)return;
    const fresh=button.hasAttribute('data-journey-new');
    if(api.open(fresh?'customer':button.dataset.journeyRole,fresh?'':selectedId,fresh || !selectedId)) { expanded=false;update(); }
  });
  panel.addEventListener('change',e=>{if(e.target.id==='journey-repair'){selectedId=e.target.value;
    // Selection alone must not leave an unsaved form or change any business record.
    const current=route();
    if(current.id) { if(!api.open(api.role() || 'customer',selectedId)) {update();return;} }
    update();
  }});
  new MutationObserver(update).observe(document.querySelector('#app'),{childList:true,subtree:true});
  update();
})();
