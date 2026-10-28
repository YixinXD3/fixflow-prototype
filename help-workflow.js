/* Tianshu: immutable help operations and shared blocker decisions. Demo roles only. */
(function(root){
  'use strict';
  const technicians=[{id:'jordan',name:'Jordan Smith'},{id:'taylor',name:'Taylor Kim'},{id:'marcus',name:'Marcus Lee'}];
  const clone=x=>JSON.parse(JSON.stringify(x)), closed=h=>['Resolved','Completed'].includes(h.status);
  const assigned=j=>Object.hasOwn(j,'assignedTechnicianId')?j.assignedTechnicianId:'jordan';
  const final=j=>['Awaiting Customer Confirmation','Completed'].includes(j.status);
  const name=id=>technicians.find(t=>t.id===id)?.name || 'Legacy technician';
  function normalize(h){
    const r=clone(h);
    if(!r.requesterId || !r.helperId){
      const peer=technicians.find(t=>t.name===r.tech)?.id || 'legacy-unmapped';
      r.requesterId ||= r.mode==='received'?peer:'jordan';
      r.helperId ||= r.mode==='received'?'jordan':peer;
      r.legacyIdentity=true;
    }
    r.blocking=r.blocking!==false;
    r.status=r.status==='Waiting'?'Open':r.status==='Completed'?'Resolved':r.status;
    r.comments ||= [];r.photos ||= [];
    return r;
  }
  function blockers(job,help=[]){
    if(!job)return ['Repair not found'];
    const items=(job.shortages||[]).filter(s=>s.blocking!==false && !(s.status==='Received' || s.fulfilled)).map(s=>'Part: '+(s.part||s.comment||s.type));
    help.filter(h=>h.jobId===job.id && h.blocking!==false && !closed(h)).forEach(()=>items.push('Technical help still open'));
    const p=(job.approvalRequests||[]).find(p=>p.id===job.currentApprovalRequestId);
    if(p&&!['approved','withdrawn','superseded'].includes(p.status))items.push(p.status==='pending'?'Customer decision pending':'Manager follow-up required: '+p.status);
    return items;
  }
  function workError(job,actor,help=[],action='resume'){
    if(!job)return 'Repair not found.';
    if(!technicians.some(t=>t.id===actor))return 'Choose a valid demo technician.';
    if(!assigned(job))return 'A manager must assign this repair first.';
    if(assigned(job)!==actor)return 'This repair is assigned to a different technician.';
    if(final(job))return 'This repair is already awaiting confirmation or completed.';
    const allowed=action==='start'?['To Do']:action==='ready'?['In Progress']:['Waiting'];
    if(!allowed.includes(job.status))return 'This action is not allowed from '+job.status+'.';
    const b=blockers(job,help);return b.length?'Resolve these before continuing: '+b.join('; '):'';
  }
  function operate(original,action,input,actor,at=new Date().toISOString(),id=''){
    const data=clone(original);data.requests=(data.requests||[]).map(normalize);
    const tech=technicians.find(t=>t.id===actor);
    if(!tech)return {error:'Choose a valid demo technician.'};
    let h,j;
    if(action==='create'){
      j=data.jobs.find(j=>j.id===input.jobId);
      if(!j || final(j) || assigned(j)!==actor)return {error:'Open an active repair assigned to this technician.'};
      if(!technicians.some(t=>t.id===input.helperId) || actor===input.helperId)return {error:'Choose another valid technician.'};
      const question=String(input.problem||'').trim();
      if(!question || question.length>500)return {error:'Enter a problem of 1–500 characters.'};
      if(!id || data.requests.some(h=>h.id===id))return {error:'A unique help ID is required.'};
      if(data.requests.filter(h=>h.helperId===input.helperId&&!closed(h)).length>=4)return {error:'This technician has no available help capacity.'};
      h={id,jobId:j.id,requesterId:actor,helperId:input.helperId,problem:question,blocking:input.blocking!==false,status:'Open',created:at,createdAt:at,photos:input.photos||[],comments:[{id:id+'-question',authorId:actor,author:tech.name,text:question,createdAt:at,time:at}]};
      data.requests.unshift(h);if(h.blocking)j.status='Waiting';
    }else{
      h=data.requests.find(h=>h.id===input.requestId);j=data.jobs.find(j=>j.id===h?.jobId);
      if(!h || !j || ![h.requesterId,h.helperId].includes(actor))return {error:'This help request is not available to this technician.'};
      if(action==='appreciation'){
        if(h.requesterId!==actor || h.appreciated)return {error:'Only the requester can send appreciation once.'};
        h.appreciated=true;h.appreciatedAt=at;
        return {data,request:h};
      }
      if(closed(h))return {error:'This help request is already resolved.'};
      if(action==='accept'){
        if(h.helperId!==actor || h.status!=='Open')return {error:'Only the recipient can accept an open request.'};
        h.status='Accepted';h.acceptedById=actor;h.acceptedAt=at;
      }else if(action==='reply'){
        const text=String(input.text||'').trim();
        if(!text || text.length>1000)return {error:'Enter a reply of 1–1000 characters.'};
        if(!id || h.comments.some(c=>c.id===id))return {error:'A unique reply ID is required.'};
        if(h.helperId===actor && h.status!=='Accepted')return {error:'Accept the request before replying.'};
        h.comments.push({id,authorId:actor,author:tech.name,text,createdAt:at,time:at});
      }else if(action==='resolve'){
        if(h.requesterId!==actor)return {error:'Only the requester can mark this request resolved.'};
        h.status='Resolved';h.resolvedById=actor;h.resolvedAt=at;
      }else return {error:'Unknown help action.'};
    }
    j.logs ||= [];j.logs.push({title:action==='create'?'Help requested from '+name(h.helperId):'Help '+action,note:action==='reply'?String(input.text).trim():h.id,time:at,createdAt:at,actorId:actor});j.updatedAt=at;j.updated=at;
    return {data,request:h};
  }
  const api={technicians,name,normalize,blockers,workError,operate,closed};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FixFlowHelpWorkflow=api;
})(typeof window==='undefined'?globalThis:window);
