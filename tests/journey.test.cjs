const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../customer.js'),'utf8');
const start=source.indexOf('  window.FixFlowJourney = {');
const end=source.indexOf('  const technicianRender = render;',start);
function setup(){const saved={},ctx={window:{FixFlowManager:{mayLeave:()=>true}},role:'customer',route:()=>({page:'customer-progress'}),mine:()=>[{id:'C1',jobId:'J1'}],jobs:[{id:'J1',assignedTechnicianId:'taylor'}],managerRules:{assignedId:j=>j.assignedTechnicianId},document:{querySelector:()=>null},toast:x=>ctx.message=x,sessionStorage:{setItem:(k,v)=>saved[k]=v},history:{pushState:(_,__,v)=>ctx.url=v},render:()=>ctx.renders++,renders:0,confirm:()=>true};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);ctx.saved=saved;return ctx;}
test('handoffs map customer IDs to shared job IDs and select the actual assigned technician',()=>{const c=setup();assert.ok(c.window.FixFlowJourney.open('technician','J1'));assert.equal(c.url,'#job/J1');assert.equal(c.activeTechnician,'taylor');assert.equal(c.saved['fixflow-technician'],'taylor');assert.ok(c.window.FixFlowJourney.open('customer','J1'));assert.equal(c.url,'#customer-progress/C1');assert.ok(c.window.FixFlowJourney.open('manager','J1'));assert.equal(c.url,'#manager/J1');});
test('unassigned, missing and noncustomer records fail without changing role',()=>{const c=setup();c.jobs[0].assignedTechnicianId=null;assert.equal(c.window.FixFlowJourney.open('technician','J1'),false);assert.equal(c.role,'customer');assert.equal(c.window.FixFlowJourney.open('technician','bad'),false);c.mine=()=>[];assert.equal(c.window.FixFlowJourney.open('customer','J1'),false);assert.equal(c.renders,0);});
test('manager cancel preserves page and never persists another role',()=>{const c=setup();c.role='manager';c.window.FixFlowManager.mayLeave=()=>false;assert.equal(c.window.FixFlowJourney.open('customer','J1'),false);assert.equal(c.role,'manager');assert.equal(c.renders,0);assert.deepEqual(c.saved,{});});
test('open dialog and cancelled form navigation prevent handoff',()=>{const c=setup();c.document.querySelector=()=>({});assert.equal(c.window.FixFlowJourney.open('manager','J1'),false);c.document.querySelector=s=>s==='#app form'?{}:null;c.confirm=()=>false;assert.equal(c.window.FixFlowJourney.open('manager','J1'),false);assert.equal(c.renders,0);});
test('new request opens existing customer form and does not create business data',()=>{const c=setup();const before=JSON.stringify(c.jobs);assert.ok(c.window.FixFlowJourney.open('customer','',true));assert.equal(c.url,'#customer-request');assert.equal(JSON.stringify(c.jobs),before);});

function railSetup(current={page:'manager'}){
  const handlers={},panel={setAttribute(){},classList:{toggle(){}},addEventListener:(name,fn)=>handlers[name]=fn};
  const api={records:()=>[{id:'C1',jobId:'J1',device:'One'},{id:'C2',jobId:'J2',device:'Two'}],role:()=> 'manager',open:()=>false};
  const ctx={window:{FixFlowJourney:api},document:{createElement:()=>panel,body:{append(){}},querySelector:()=>({})},route:()=>current,requests:[],jobs:[{id:'J1',status:'To Do'},{id:'J2',status:'To Do'}],managerRules:{assignedId:()=>null,blockers:()=>[],proposal:()=>null},esc:String,MutationObserver:class{observe(){}}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../journey.js'),'utf8'),ctx);
  return {panel,api,change:value=>handlers.change({target:{id:'journey-repair',value}})};
}
test('rail selection invokes navigation guard even on a page without a repair ID',()=>{
  const c=railSetup();let calls=0;c.api.open=(role,id)=>{calls++;assert.equal(id,'J2');return false;};
  c.change('J2');assert.equal(calls,1);assert.match(c.panel.innerHTML,/value="J1" selected/);assert.doesNotMatch(c.panel.innerHTML,/value="J2" selected/);
});
test('rail commits a successful selection and never substitutes another journey on an unlinked detail',()=>{
  const c=railSetup();c.api.open=()=>true;c.change('J2');assert.match(c.panel.innerHTML,/value="J2" selected/);
  const unlinked=railSetup({page:'job',id:'seed-job'});assert.match(unlinked.panel.innerHTML,/This repair has no customer journey/);assert.doesNotMatch(unlinked.panel.innerHTML,/value="J1" selected/);
});
