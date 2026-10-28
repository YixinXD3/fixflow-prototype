/* Tianshu: versioned validation for the existing shared browser-session contract. */
(function(root){
  'use strict';
  const KEY='fixflow-prototype-v1', VERSION=1;
  const copy=x=>JSON.parse(JSON.stringify(x));
  let blocked='', initial=null;
  const states=['To Do','In Progress','Waiting','Awaiting Customer Confirmation','Completed'];
  function normalize(value){
    if(!value || !Array.isArray(value.jobs) || (value.schemaVersion!==undefined && value.schemaVersion!==VERSION)) throw Error('Unsupported or damaged shared data.');
    const d=copy(value);d.schemaVersion=VERSION;
    for(const key of ['requests','labels','techs']){
      if(d[key]===undefined)d[key]=[];
      if(!Array.isArray(d[key]))throw Error('Invalid '+key+' collection.');
    }
    if(d.labels.some(x=>typeof x!=='string') || d.techs.some(x=>!x||typeof x!=='object'))throw Error('Invalid labels or technicians.');
    const ids=new Set();
    for(const j of d.jobs){
      if(!j || typeof j.id!=='string' || !j.id || ids.has(j.id) || !states.includes(j.status))throw Error('Invalid repair ID or status.');
      ids.add(j.id);
      for(const key of ['logs','shortages','attachments','assignmentHistory']){
        if(j[key]===undefined)j[key]=[];
        if(!Array.isArray(j[key]) || j[key].some(x=>!x || typeof x!=='object'))throw Error('Invalid repair '+key+'.');
      }
      for(const key of ['device','issue','customer','notes','label','updated']){if(j[key]===undefined)j[key]='';if(typeof j[key]!=='string')throw Error('Invalid repair '+key+'.');}
      if(!Number.isFinite(j.progress))j.progress=0;
      const partIds=new Set();
      for(const s of j.shortages){
        if(typeof s.id!=='string'||!s.id||partIds.has(s.id))throw Error('Invalid or duplicate parts ID.');
        partIds.add(s.id);
        if(s.status!==undefined&&!['Reported','Awaiting approval','Ordered','Received'].includes(s.status))throw Error('Invalid parts status.');
        if(s.blocking!==undefined&&typeof s.blocking!=='boolean')throw Error('Invalid parts blocking flag.');
        if(s.fulfilled!==undefined&&typeof s.fulfilled!=='boolean')throw Error('Invalid parts receipt flag.');
        if(s.status!==undefined&&s.fulfilled!==undefined&&s.fulfilled!==(s.status==='Received'))throw Error('Parts receipt flags disagree.');
        if(s.images===undefined)s.images=[];
        if(!Array.isArray(s.images)||s.images.some(a=>!a||typeof a.src!=='string'))throw Error('Invalid parts images.');
      }
      if(j.approvalRequests!==undefined && (!Array.isArray(j.approvalRequests)||j.approvalRequests.some(p=>!p||typeof p!=='object')))throw Error('Invalid approval requests.');
      for(const a of j.attachments)if(typeof a.src!=='string')throw Error('Invalid attachment.');
      if(j.publicProgress!==undefined && (j.publicProgress===null || typeof j.publicProgress!=='object'))throw Error('Invalid public progress.');
    }
    const requests=new Set();
    for(const h of d.requests){
      if(!h || typeof h.id!=='string' || !h.id || requests.has(h.id) || !ids.has(h.jobId))throw Error('Invalid help ID or repair reference.');
      requests.add(h.id);
      if(!['Open','Accepted','Waiting','Resolved','Completed'].includes(h.status))throw Error('Invalid help status.');
      for(const key of ['comments','photos']){if(h[key]===undefined)h[key]=[];if(!Array.isArray(h[key]) || h[key].some(x=>!x || typeof x!=='object'))throw Error('Invalid help '+key+'.');}
      if(h.blocking!==undefined&&typeof h.blocking!=='boolean')throw Error('Invalid help blocking flag.');
      for(const key of ['requesterId','helperId'])if(h[key]!==undefined&&(typeof h[key]!=='string'||!h[key]))throw Error('Invalid help participant.');
      const commentIds=new Set();
      for(const c of h.comments){
        if(typeof c.text!=='string'||typeof c.author!=='string')throw Error('Invalid help reply text or author.');
        if(c.id!==undefined){if(typeof c.id!=='string'||!c.id||commentIds.has(c.id))throw Error('Invalid or duplicate reply ID.');commentIds.add(c.id);}
      }
      if(h.photos.some(a=>typeof a.src!=='string'))throw Error('Invalid help photo.');
    }
    return d;
  }
  function storage(s){return s || root.sessionStorage;}
  function assertWritable(){if(blocked)throw Error(blocked);}
  function load(seed,s){
    initial=copy(seed);
    try{
      const raw=storage(s).getItem(KEY);
      const data=normalize(raw===null?seed:JSON.parse(raw));blocked='';return {ok:true,data};
    }catch(e){blocked='Shared data could not be restored. Saving is disabled; export the stored data before resetting. '+e.message;return {ok:false,error:blocked};}
  }
  function save(value,s){assertWritable();const data=normalize(value);storage(s).setItem(KEY,JSON.stringify(data));return data;}
  function reset(s){const target=storage(s);for(const key of [KEY,'fixflow-customer-v1','fixflow-customer-actions-v1','fixflow-role','fixflow-technician'])target.removeItem(key);blocked='';}
  function banner(){
    if(!blocked || !root.document)return;
    const el=document.createElement('section');el.className='panel';el.setAttribute('role','alert');el.id='shared-storage-error';
    const p=document.createElement('p');p.textContent=blocked;el.append(p);
    const exportButton=document.createElement('button');exportButton.textContent='Export stored data';exportButton.className='secondary';
    exportButton.onclick=()=>{try{const payload={};for(const key of [KEY,'fixflow-customer-v1','fixflow-customer-actions-v1'])payload[key]=root.sessionStorage.getItem(key);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download='fixflow-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){p.textContent=e.message;}};
    const resetButton=document.createElement('button');resetButton.textContent='Reset demo data';resetButton.className='secondary';
    resetButton.onclick=()=>{if(root.confirm('Remove only FixFlow demo data in this tab? Export anything you need first.')){try{reset();root.location.reload();}catch(e){p.textContent='Reset failed: '+e.message;}}};
    el.append(exportButton,resetButton);document.body.prepend(el);
  }
  const api={KEY,VERSION,normalize,load,save,reset,assertWritable,banner,get error(){return blocked;},get initial(){return copy(initial);}};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FixFlowStore=api;
})(typeof window==='undefined'?globalThis:window);
