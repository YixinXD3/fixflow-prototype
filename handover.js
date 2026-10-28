/* Yixin: append-only internal handover, independent of public customer updates. */
(function(root) {
  'use strict';
  function append(job, input, actor, at, id) {
    if (!job || !['To Do','In Progress','Waiting'].includes(job.status)) return {error:'This repair is read-only.'};
    if (!['jordan','taylor','marcus'].includes(actor) || (Object.hasOwn(job,'assignedTechnicianId') ? job.assignedTechnicianId : 'jordan') !== actor) return {error:'Only the assigned technician can save a handover.'};
    const fields={};
    for(const key of ['tests','finding','next']) { fields[key]=String(input[key]||'').trim();if(!fields[key] || fields[key].length>1000)return {error:'Complete tests, findings and next step (up to 1000 characters each).'}; }
    if (!id || !Number.isFinite(Date.parse(at)))return {error:'A valid record ID and timestamp are required.'};
    if ((job.handovers||[]).some(h=>h.id===id))return {error:'This handover has already been saved.'};
    const next=JSON.parse(JSON.stringify(job));
    next.handovers ||= [];
    next.handovers.push({id,jobId:job.id,authorId:actor,createdAt:at,...fields});
    next.logs ||= [];
    next.logs.push({title:'Internal handover saved',note:fields.next,actorId:actor,createdAt:at,time:at});
    next.updatedAt=at;next.updated=at;
    return {job:next};
  }
  if(typeof module==='object' && module.exports){module.exports={append};return;}
  root.FixFlowHandover={append};
  const original=detail;
  detail=function(){
    const html=original(),j=jobs.find(x=>x.id===route().id);
    if(!j || managerRules.assignedId(j)!==activeTechnician)return html;
    const history=(Array.isArray(j.handovers)?j.handovers:[]).slice().reverse();
    const panel=`<section class="panel handover-panel"><div class="panel-title">${tile('note')}<h2 class="grow">Technician handover</h2></div><p class="muted">Internal record · never shown in customer progress. Device and repair ID are linked automatically.</p>${history.map(h=>`<article class="handover-record"><small>${esc(managerRules.technician(h.authorId)?.name||h.authorId)} · ${esc(new Date(h.createdAt).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'}))}</small><dl><dt>Tests completed</dt><dd>${esc(h.tests)}</dd><dt>Current findings</dt><dd>${esc(h.finding)}</dd><dt>Next step</dt><dd>${esc(h.next)}</dd></dl></article>`).join('')||'<p>No handover yet. Record what you tested and what the next technician should do.</p>'}${!managerRules.final(j)?'<button class="secondary" data-handover-add>Add handover</button>':''}</section>`;
    return html.replace('<section class="panel"><div class="panel-title">'+tile('clock'),panel+'<section class="panel"><div class="panel-title">'+tile('clock'));
  };
  document.addEventListener('click',e=>{
    if(!e.target.closest('[data-handover-add]'))return;
    const j=jobs.find(x=>x.id===route().id);
    openSheet('Save internal handover',`<form id="handover-form" data-job-id="${esc(j.id)}"><p>Repair ${esc(j.id)} · ${esc(j.device)}</p>${[['tests','Tests completed','What checks or repairs have you already performed?'],['finding','Current findings','What did you find? What is still unresolved?'],['next','Next step','What should the next technician do?']].map(([key,label,placeholder])=>`<label class="field">${label}<textarea name="${key}" required maxlength="1000" placeholder="${placeholder}"></textarea></label>`).join('')}<p class="muted">Parts, help and approval blockers remain in their existing modules. This note does not change repair status.</p><p class="handover-error" role="alert"></p><button class="primary full">Save handover</button></form>`);
  });
  document.addEventListener('submit',e=>{
    if(e.target.id!=='handover-form')return;
    e.preventDefault();e.stopImmediatePropagation();const form=e.target;
    if(!form.reportValidity())return;
    const j=jobs.find(x=>x.id===form.dataset.jobId);
    const result=append(j,Object.fromEntries(new FormData(form)),activeTechnician,new Date().toISOString(),crypto.randomUUID());
    if(result.error){form.querySelector('.handover-error').textContent=result.error;return;}
    const next=jobs.map(x=>x.id===j.id?result.job:x);
    try{FixFlowStore.save({jobs:next,requests,labels,techs});}catch(_){form.querySelector('.handover-error').textContent='Could not save. Your input is retained. Free browser storage and retry.';return;}
    jobs=next;closeSheet();render();toast('Internal handover saved. Customer progress is unchanged.');
  },true);
})(typeof globalThis==='object'?globalThis:this);
