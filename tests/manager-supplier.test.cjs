const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../manager/shared-model.js');
const job={id:'R1',device:'Demo phone',status:'Waiting',shortages:[{id:'S1',type:'Screen',fulfilled:false},{id:'S2',type:'Battery',fulfilled:false}]};
const input={shortageId:'S1',stockCheck:'unavailable',stockNote:'Display required; checked shelf, none available.',partDescription:'Demo screen',quantity:'2',supplierName:'Example supplier',email:'parts@example.com',website:'https://example.com/parts',subject:'Quote & availability',body:'Screen x 2\nPlease quote.',orderReference:''};
test('procurement saves isolated history and never orders, receives or resumes',()=>{
 const r=model.operate(job,'procurement',input);assert.ok(!r.error);assert.equal(r.job.status,'Waiting');assert.equal(r.job.shortages[0].fulfilled,false);assert.equal(r.job.shortages[0].status,undefined);assert.deepEqual(r.job.shortages[1],job.shortages[1]);assert.equal(job.shortages[0].procurement,undefined);
 const next=model.operate(r.job,'procurement',{...input,orderReference:'External-123'});assert.equal(next.job.shortages[0].procurementHistory.length,2);assert.equal(next.job.shortages[0].procurementHistory[0].orderReference,'');
});
test('available stock needs no supplier and does not clear the repair blocker',()=>{
 const r=model.operate(job,'procurement',{...input,stockCheck:'available',email:'',website:'',supplierName:''});assert.ok(!r.error);assert.deepEqual(model.supplierLinks(r.job.shortages[0].procurement),{});assert.equal(model.blockers(r.job).length,2);
});
test('contact links encode the draft and reject unsafe targets',()=>{
 const links=model.supplierLinks(input);const mail=new URL(links.email);assert.equal(mail.searchParams.get('subject'),input.subject);assert.equal(mail.searchParams.get('body'),input.body);assert.equal(links.website,input.website);
 for(const website of ['javascript:alert(1)','http://example.com','https://user:pass@example.com'])assert.ok(model.operate(job,'procurement',{...input,website}).error);
 assert.ok(model.operate(job,'procurement',{...input,email:'parts@example.com?bcc=other@example.com'}).error);
 assert.ok(model.operate(job,'procurement',{...input,subject:'Quote\nBcc: other@example.com'}).error);
});
test('invalid or final records cannot be updated',()=>{
 for(const change of [{quantity:0},{quantity:1.5},{stockNote:''},{supplierName:''},{email:'',website:''},{shortageId:'missing'},{stockCheck:'guess'}])assert.ok(model.operate(job,'procurement',{...input,...change}).error);
 assert.ok(model.operate({...job,status:'Completed'},'procurement',input).error);
});
