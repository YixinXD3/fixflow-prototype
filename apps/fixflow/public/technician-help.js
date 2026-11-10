/* Tianshu: UI adapter; existing customer and manager pages retain their renderers. */
(function(){
  'use strict';
  const flow=window.FixFlowHelpWorkflow;
  const displayTime=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'medium',timeStyle:'short'}):'Time not recorded';
  const snapshot=()=>({jobs,requests,labels,techs});
  const visible=h=>[h.requesterId,h.helperId].includes(activeTechnician);
  function commit(result){
    if(result.error){toast(result.error);return false;}
    try{const saved=FixFlowStore.save(result.data);jobs=saved.jobs;requests=saved.requests;labels=saved.labels;return true;}
    catch(e){toast('Could not save. Your input is retained. '+e.message);return false;}
  }
  function perform(action,input){return commit(flow.operate(snapshot(),action,input,activeTechnician,new Date().toISOString(),crypto.randomUUID()));}
  helpForJob=function(){
    const j=job();
    if(!j || j.id!==route().id || managerRules.assignedId(j)!==activeTechnician || managerRules.final(j))return `<main class="main tianshu-help">${empty('Repair unavailable','Choose an active repair assigned to you.')}</main>`;
    return `${header()}<main class="main tianshu-help"><button class="back" data-action="back-job">← Back to Job</button>${pageHeading('Help for Job #'+esc(j.id),'Ask a colleague without changing repair ownership.')}<section class="panel"><h2>${esc(j.device)}</h2><p>${esc(j.issue)}</p></section><form id="tianshu-help-form" class="panel"><label class="field">Help recipient<select name="helperId" required>${flow.technicians.filter(t=>t.id!==activeTechnician).map(t=>{const count=requests.map(flow.normalize).filter(h=>h.helperId===t.id&&!flow.closed(h)).length;return `<option value="${t.id}" ${count>=4?'disabled':''}>${esc(t.name)} (${count}/4 active)</option>`;}).join('')}</select></label><label class="field" for="problem">Explain the Problem</label><textarea id="problem" name="problem" required maxlength="500">${esc(helpDraft)}</textarea><label style="display:flex;gap:9px;align-items:center;margin:16px 0"><span><input style="width:17px;min-height:17px;accent-color:#167aff" type="checkbox" name="blocking" checked> This issue prevents the repair from continuing</span></label><p class="muted">Uncheck for advice that does not block work. Resolving help never completes or automatically resumes a repair.</p><h3>Photos (optional)</h3><div class="attachments" id="help-photos">${imagesHTML(helpPhotos,'help',true)}${uploadControl('help','Add more')}</div><p class="muted">Up to 10 JPG, PNG or WebP images, 10 MB each; browser storage may be smaller.</p><button class="primary full" type="submit">Send Help Request</button></form></main>`;
  };
  requestList=function(){
    return requests.map(flow.normalize).filter(h=>h[state.helpMode==='received'?'helperId':'requesterId']===activeTechnician && (state.helpStatus==='All'||h.status===state.helpStatus) && [h.jobId,h.problem,flow.name(h.helperId),flow.name(h.requesterId)].join(' ').toLowerCase().includes(state.search.toLowerCase())).sort((a,b)=>String(b.created).localeCompare(String(a.created))).map(h=>{
      const j=jobs.find(j=>j.id===h.jobId);return `<article class="request"><button class="request-header" data-action="open-help" data-id="${esc(h.id)}">${j?deviceIcon(j):tile('help')}<span class="identity"><strong class="job-id">#${esc(h.jobId)}</strong><span class="job-device">${esc(j?.device||'Unavailable repair')}</span></span><span class="issue">${esc(h.problem||h.comments[0]?.text||j?.issue||'')}<br><small>${esc(flow.name(h.requesterId))} → ${esc(flow.name(h.helperId))}</small></span><span class="request-status">${badge(h.status)}<small style="display:block;margin-top:5px">${h.blocking?'Blocking':'Advice only'}</small></span><span class="chevron">›</span></button></article>`;
    }).join('')||empty('No matching help requests');
  };
  myHelp=function(){return `${header()}<main class="main tianshu-help">${pageHeading('My Help','Requests linked to the selected demo technician.')}<div class="segmented"><button data-action="help-mode" data-value="sent" class="${state.helpMode==='sent'?'active':''}">I Asked for Help</button><button data-action="help-mode" data-value="received" class="${state.helpMode==='received'?'active':''}">Others Asked Me</button></div><div class="pills help-tabs">${['All','Open','Accepted','Resolved'].map(s=>`<button class="pill ${state.helpStatus===s?'active':''}" data-action="help-status" data-value="${s}">${s}</button>`).join('')}</div><label class="field">Search help<input id="help-search" type="search" value="${esc(state.search)}" placeholder="Repair, person or problem"></label><div id="request-list">${requestList()}</div></main>${nav('more')}`;};
  helpDetail=function(){
    const raw=requests.find(h=>h.id===route().id),h=raw&&flow.normalize(raw);
    const back='<button class="back" data-action="nav" data-page="help">← Back to My Help</button>';
    if(!h || !visible(h))return `${header()}<main class="main tianshu-help">${back}${empty('Help request unavailable','Choose a request sent to or from the selected technician.')}</main>${nav('more')}`;
    const b=flow.blockers(jobs.find(j=>j.id===h.jobId),requests);
    return `${header()}<main class="main tianshu-help">${back}${pageHeading('Help Detail','#'+esc(h.jobId))}<section class="panel tianshu-conversation"><div class="tianshu-help-meta">${badge(h.status)}<p>${esc(flow.name(h.requesterId))} → ${esc(flow.name(h.helperId))}</p><p>${h.blocking?'Blocking request':'Advice only; this request does not block repair'}</p></div>${h.legacyIdentity?'<p class="prototype-note">Legacy identity inferred from the old single-user demo. Confirm it with the team before backend migration.</p>':''}<h2>Conversation</h2><div class="conversation">${h.comments.map(c=>`<div class="message ${c.authorId&&c.authorId!==activeTechnician?'other':''}"><span class="avatar">${esc(initials(c.authorId?flow.name(c.authorId):String(c.author||'?')))}</span><div class="grow"><strong>${esc(c.authorId?flow.name(c.authorId):c.author)}</strong><p class="bubble">${esc(c.text)}</p><time>${esc(c.createdAt?displayTime(c.createdAt):c.time)}</time></div></div>`).join('')}</div>${h.photos.length?`<div class="attachments">${imagesHTML(h.photos,'request-'+h.id)}</div>`:''}${!flow.closed(h)?`${h.helperId===activeTechnician&&h.status==='Open'?`<button class="primary" data-action="accept-help" data-id="${esc(h.id)}">Accept request</button>`:''}${h.requesterId===activeTechnician||h.status==='Accepted'?`<form data-tianshu-reply="${esc(h.id)}"><label class="field">Reply<textarea name="comment" required maxlength="1000"></textarea></label><button class="primary" type="submit">Send reply</button></form>`:'<p>Accept this request before replying.</p>'}${h.requesterId===activeTechnician?`<button class="secondary full" data-action="resolve-help" data-id="${esc(h.id)}">Mark as Resolved</button>`:''}`:`<p>Resolved by ${esc(flow.name(h.resolvedById))} · ${esc(displayTime(h.resolvedAt))}</p>`}${h.requesterId===activeTechnician?`<div class="appreciation"><button data-action="appreciation" data-id="${esc(h.id)}" ${h.appreciated?'disabled':''}>${icon('star')}<span><strong>${h.appreciated?'Appreciation Sent':'Send Appreciation'}</strong></span></button></div>`:''}<h3>Repair next step</h3>${b.length?`<ul>${b.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>`:'<p>No recorded blockers. The assigned technician must explicitly continue a waiting repair.</p>'}${jobs.some(j=>j.id===h.jobId&&managerRules.assignedId(j)===activeTechnician)?`<button class="text-button" data-action="job" data-id="${esc(h.jobId)}">View Repair Job →</button>`:'<p>Assisting does not transfer repair ownership.</p>'}</section></main>${nav('more')}`;
  };
  const oldMessages=messages;
  messages=function(){const all=requests;try{requests=all.map(flow.normalize).filter(visible).map(h=>({...h,tech:flow.name(h.requesterId===activeTechnician?h.helperId:h.requesterId)}));return oldMessages();}finally{requests=all;}};
  const oldDetail=detail;
  detail=function(){const html=oldDetail(),j=jobs.find(j=>j.id===route().id);if(!j||managerRules.assignedId(j)!==activeTechnician)return html;const b=flow.blockers(j,requests);return html.replace('<div class="detail-actions">',`<section class="panel"><h2>Repair blockers</h2>${b.length?'<ul>'+b.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>No recorded blockers.</p>'}<p>Help, parts and customer decisions are tracked independently. Only the assigned technician can resume work.</p></section><div class="detail-actions">`);};
  const oldAction=handleAction;
  handleAction=function(a,b,e){
    if(['accept-help','resolve-help','close-help','appreciation','praise'].includes(a)){
      if(a==='appreciation'){if(perform('appreciation',{requestId:b.dataset.id})){render();toast('Appreciation saved.');}return;}
      if(['praise','close-help'].includes(a)){toast('Use the request conversation; resolved history is read-only.');return;}
      if(perform(a==='accept-help'?'accept':'resolve',{requestId:b.dataset.id})){render();toast(a==='accept-help'?'Request accepted.':'Help resolved. Other repair blockers are unchanged.');}return;
    }
    if(a==='confirm-reset'){try{FixFlowStore.reset();location.hash='#login';location.reload();}catch(error){toast('Could not reset: '+error.message);}return;}
    if(['start-repair','resume-repair','complete-repair','confirm-repair'].includes(a)){
      const j=jobs.find(j=>j.id===route().id),action=a==='start-repair'?'start':a==='resume-repair'?'resume':'ready',error=flow.workError(j,activeTechnician,requests,action);
      if(error){toast(error);return;}
      if(a!=='complete-repair'){
        const data=JSON.parse(JSON.stringify(snapshot())), next=data.jobs.find(x=>x.id===j.id),at=new Date().toISOString();
        next.status=action==='ready'?'Awaiting Customer Confirmation':'In Progress';
        next.progress=action==='ready'?100:Math.max(10,next.progress||0);next.updatedAt=at;next.updated=at;
        next.logs.push({title:action==='ready'?'Repair completed — awaiting customer confirmation':'Repair '+(action==='start'?'started':'resumed'),note:'Explicit technician action',actorId:activeTechnician,createdAt:at,time:at});
        if(commit({data})){closeSheet();render();toast('Saved. Status: '+next.status+'.');}return;
      }
    }
    return oldAction(a,b,e);
  };
  document.addEventListener('submit',e=>{
    const form=e.target;
    if(form.id==='help-request-form'||form.dataset.requestId){e.preventDefault();e.stopImmediatePropagation();toast('Open the current help form before submitting.');return;}
    if(form.id!=='tianshu-help-form' && !form.dataset.tianshuReply)return;
    e.preventDefault();e.stopImmediatePropagation();if(!form.reportValidity())return;
    const fd=new FormData(form);
    if(form.id==='tianshu-help-form'){
      const id='help-'+crypto.randomUUID();
      if(commit(flow.operate(snapshot(),'create',{jobId:route().id,helperId:fd.get('helperId'),problem:fd.get('problem'),blocking:fd.has('blocking'),photos:helpPhotos},activeTechnician,new Date().toISOString(),id))){helpDraft='';helpPhotos=[];state.helpMode='sent';go('help-detail',id);toast('Help request saved.');}
    }else if(perform('reply',{requestId:form.dataset.tianshuReply,text:fd.get('comment')})){render();toast('Reply saved.');}
  },true);
  FixFlowStore.banner();
})();
