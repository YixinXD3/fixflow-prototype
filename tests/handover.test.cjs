const {test}=require('node:test');
const assert=require('node:assert/strict');
const {append}=require('../handover.js');
const store=require('../shared-store.js');
const sample=()=>({id:'J1',status:'Waiting',assignedTechnicianId:'taylor',notes:'Keep this',logs:[],shortages:[{id:'s1',status:'Reported',blocking:true}],publicProgress:{summary:'Public only'}});
const fields={tests:'Checked connector',finding:'Display faulty',next:'Wait for replacement'};
const at='2026-10-29T02:00:00Z';
test('handover preserves business status, public progress, blockers and original record',()=>{const j=sample(),before=JSON.stringify(j),r=append(j,fields,'taylor',at,'h1');assert.equal(JSON.stringify(j),before);assert.equal(r.job.status,'Waiting');assert.deepEqual(r.job.publicProgress,j.publicProgress);assert.deepEqual(r.job.shortages,j.shortages);assert.equal(r.job.handovers[0].jobId,'J1');assert.equal(r.job.handovers[0].authorId,'taylor');});
test('reassignment retains authors and append-only history',()=>{const first=append(sample(),fields,'taylor',at,'h1').job;first.assignedTechnicianId='jordan';const second=append(first,fields,'jordan',at,'h2').job;assert.deepEqual(second.handovers.map(x=>x.authorId),['taylor','jordan']);assert.equal(second.logs.length,2);});
test('foreign, unknown and final actors/states cannot save',()=>{for(const actor of ['jordan','bad'])assert.ok(append(sample(),fields,actor,at,'h1').error);for(const status of ['Completed','Awaiting Customer Confirmation'])assert.ok(append({...sample(),status},fields,'taylor',at,'h1').error);});
test('blank, excessive, duplicate and invalid audit values are rejected',()=>{for(const key of ['tests','finding','next'])for(const value of [' ', 'x'.repeat(1001)])assert.ok(append(sample(),{...fields,[key]:value},'taylor',at,'h1').error);const j=append(sample(),fields,'taylor',at,'h1').job;assert.ok(append(j,fields,'taylor',at,'h1').error);assert.ok(append(sample(),fields,'taylor','bad','h1').error);});

test('legacy repairs and valid handover history survive normalization',()=>{
  assert.equal(store.normalize({jobs:[sample()]}).jobs[0].handovers,undefined);
  const job=append(sample(),fields,'taylor',at,'h1').job;
  assert.deepEqual(store.normalize({jobs:[job]}).jobs[0].handovers,job.handovers);
});
test('damaged audit history is rejected without overwriting stored recovery data',()=>{
  const valid=append(sample(),fields,'taylor',at,'h1').job;
  const h=valid.handovers[0];
  for(const history of [{},[null],[h,h],[{...h,jobId:'other'}],[{...h,authorId:'unknown'}],[{...h,createdAt:'bad'}],[{...h,next:''}],[{...h,tests:'x'.repeat(1001)}]]){
    const raw=JSON.stringify({jobs:[{...valid,handovers:history}]});let writes=0;
    const storage={getItem:()=>raw,setItem:()=>writes++};
    assert.equal(store.load({jobs:[]},storage).ok,false);
    assert.throws(()=>store.save({jobs:[valid]},storage));
    assert.equal(writes,0);assert.equal(storage.getItem(),raw);
  }
  store.load({jobs:[]},{getItem:()=>null});
});
test('append rejects malformed containers and missing input without crashing',()=>{
  for(const handovers of [{},[null]])assert.ok(append({...sample(),handovers},fields,'taylor',at,'h1').error);
  assert.ok(append(sample(),null,'taylor',at,'h1').error);
  assert.ok(append(sample(),fields,'taylor',at,123).error);
});
