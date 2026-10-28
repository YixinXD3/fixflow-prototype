'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../manager/shared-model.js');
const customer=require('../customer-actions.js');
const at='2026-10-27T01:00:00Z';
const repair=()=>({id:'test-repair',status:'To Do',assignedTechnicianId:null,preferredTechnicianId:'taylor',logs:[{title:'Original log'}],shortages:[]});
const proposal={reason:'Display failed',description:'Replace display and test touch',additionalCost:'80.50'};
test('assignment preserves preference, prior logs and unrelated metadata; reassignment is auditable',()=>{
  const original=repair(); original.custom={preserve:true};
  const first=m.operate(original,'assign',{technicianId:'jordan'},at).job;
  assert.equal(original.assignedTechnicianId,null); assert.equal(first.preferredTechnicianId,'taylor');
  const second=m.operate(first,'assign',{technicianId:'marcus'},at).job;
  assert.equal(second.assignmentHistory.length,2);assert.equal(second.logs[0].title,'Original log');assert.deepEqual(second.custom,{preserve:true});
  assert.match(m.workError(second,'jordan'),/different technician/);assert.equal(m.workError(second,'marcus'),'');
});
test('unknown technician and changes to final repairs are rejected',()=>{
  assert.ok(m.operate(repair(),'assign',{technicianId:'unknown'},at).error);
  for(const status of ['Completed','Awaiting Customer Confirmation']) assert.ok(m.operate({...repair(),status},'assign',{technicianId:'jordan'},at).error);
});
test('preference is not assignment; legacy jobs remain assigned to Jordan',()=>{
  assert.match(m.workError(repair(),'taylor'),/assign this repair/);
  const old=repair();delete old.assignedTechnicianId;assert.equal(m.assignedId(old),'jordan');
});
test('receiving one shortage preserves another and open help; receipt never resumes the job',()=>{
  let j={...repair(),assignedTechnicianId:'jordan',status:'Waiting',shortages:[{id:'a',type:'Display',blocking:true},{id:'b',type:'Battery',blocking:true}]};
  const help=[{jobId:j.id,status:'Open'}];
  j=m.operate(j,'shortage',{shortageId:'a',owner:'Demo manager',status:'Received',nextAction:'Check fitting',expectedArrival:''},at).job;
  assert.equal(j.status,'Waiting');assert.equal(j.shortages[1].fulfilled,undefined);assert.equal(m.blockers(j,help).length,2);
  j=m.operate(j,'shortage',{shortageId:'b',owner:'Demo manager',status:'Received',nextAction:'Check fitting',expectedArrival:''},at).job;
  assert.match(m.workError(j,'jordan',help),/Technical help/);help[0].status='Resolved';assert.equal(m.workError(j,'jordan',help),'');
});
test('nonblocking shortage does not prevent work; invalid follow-up is atomic',()=>{
  const j={...repair(),assignedTechnicianId:'jordan',shortages:[{id:'a',type:'Tool',blocking:false}]};
  assert.equal(m.blockers(j).length,0);
  const before=JSON.stringify(j);
  for(const input of [{owner:'',status:'Ordered',nextAction:'Call supplier',expectedArrival:''},{owner:'Demo manager',status:'Ordered',nextAction:'',expectedArrival:''},{owner:'Demo manager',status:'Ordered',nextAction:'Call supplier',expectedArrival:'2026-02-30'}]) assert.ok(m.operate(j,'shortage',{shortageId:'a',...input},at).error);
  assert.equal(JSON.stringify(j),before);
});
test('pending and declined proposals block work until manager follow-up',()=>{
  let j={...repair(),assignedTechnicianId:'jordan'};j=m.operate(j,'propose',proposal,at,'p1').job;
  assert.equal(j.status,'Waiting');assert.equal(j.publicProgress.actionRequired,true);
  assert.equal(customer.applyResponse(j,{requestId:'p1',kind:'declined',at}).ok,true);
  assert.match(m.workError(j,'jordan'),/follow-up/);
  j=m.operate(j,'withdraw',{reason:'Continue original repair only'},at).job;
  assert.equal(m.workError(j,'jordan'),'');assert.equal(j.approvalRequests[0].response.kind,'declined');assert.equal(j.status,'Waiting');
});
test('clarification revision preserves response and rejects stale approval',()=>{
  let j=m.operate(repair(),'propose',proposal,at,'p1').job;
  customer.applyResponse(j,{requestId:'p1',kind:'clarification',note:'Is this original equipment?',at});
  j=m.operate(j,'propose',{...proposal,description:'Compatible display with warranty'},at,'p2').job;
  assert.equal(j.approvalRequests[0].response.note,'Is this original equipment?');assert.equal(j.approvalRequests[0].status,'superseded');
  assert.equal(customer.applyResponse(j,{requestId:'p1',kind:'approved',at}).ok,false);
  assert.equal(customer.applyResponse(j,{requestId:'p2',kind:'approved',at}).ok,true);
  assert.equal(j.status,'Waiting');assert.equal(m.blockers(j).length,0);
});
test('withdrawal is not approval; a pending replaced request cannot be answered',()=>{
  let j=m.operate(repair(),'propose',proposal,at,'p1').job;
  j=m.operate(j,'propose',proposal,at,'p2').job;
  assert.equal(customer.applyResponse(j,{requestId:'p1',kind:'approved',at}).ok,false);
  j=m.operate(j,'withdraw',{reason:'No longer required'},at).job;
  assert.equal(customer.applyResponse(j,{requestId:'p2',kind:'approved',at}).ok,false);assert.equal(j.approvalRequests[1].response,null);
});
test('proposal rejects blank, negative, excessive or invalid amounts without changing repair',()=>{
  const j=repair(),before=JSON.stringify(j);
  for(const amount of ['', '-1','1.111','NaN','100001','Infinity']) assert.ok(m.operate(j,'propose',{...proposal,additionalCost:amount},at,'p').error);
  assert.equal(JSON.stringify(j),before);
});
test('approved proposal cannot be silently replaced and unrelated blockers remain',()=>{
  let j=repair();j.shortages=[{id:'a',type:'Battery',blocking:true}];j=m.operate(j,'propose',proposal,at,'p1').job;
  customer.applyResponse(j,{requestId:'p1',kind:'approved',at});assert.ok(m.operate(j,'propose',proposal,at,'p2').error);assert.equal(m.blockers(j).length,1);
});
