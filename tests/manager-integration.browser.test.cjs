'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
let server,browser,url;
const publicRoot=path.resolve(__dirname,'..');
before(async()=>{
  server=http.createServer((req,res)=>{
    let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';
    const file=path.resolve(publicRoot,'.'+name);
    if(!file.startsWith(publicRoot+path.sep))return res.writeHead(403).end();
    fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch({channel:process.env.FIXFLOW_BROWSER || 'msedge',headless:true});
});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
async function role(page,value){await page.goto(url+'#login');await page.locator(`[data-customer-action="login"][data-role="${value}"]`).click();await page.waitForURL('**/#'+({manager:'manager',customer:'customer-home',technician:'dashboard'})[value]);}
async function create(page,device){await role(page,'customer');await page.goto(url+'#customer-request');await page.getByLabel('Device model',{exact:true}).fill(device);await page.getByLabel('Problem description',{exact:true}).fill('Cracked screen. Please preserve data.');await page.getByRole('button',{name:'Select Technician →',exact:true}).click();await page.locator('[data-customer-action="select-tech"][data-id="taylor"]').click();await page.getByRole('button',{name:'Submit Repair Request',exact:true}).click();await page.waitForURL('**/#customer-progress/*');return page.evaluate(()=>route().id);}
async function manager(page,id){await role(page,'manager');await page.locator(`[data-manager-job="${id}"]`).click();}
async function assign(page,id,tech){await manager(page,id);await page.locator('[data-manager-form="assign"] select').selectOption(tech);await page.getByRole('button',{name:'Save assignment',exact:true}).click();}
async function data(page,id){return page.evaluate(id=>JSON.parse(sessionStorage.getItem('fixflow-prototype-v1')).jobs.find(j=>j.id===id),id);}
async function part(page,description){await page.getByRole('button',{name:/Shortage Material/}).click();await page.getByLabel('Comment',{exact:true}).fill(description);await page.getByRole('button',{name:'Submit Request',exact:true}).click();}
async function receive(page,id){const f=page.locator(`[data-manager-form="shortage"][data-shortage-id="${id}"]`);await f.getByLabel('Follow-up owner').selectOption('Demo manager');await f.getByLabel('Parts status').selectOption('Received');await f.getByLabel('Next action').fill('Technician to inspect and fit the received part.');await f.getByRole('button',{name:'Save parts follow-up'}).click();}
async function publish(page,description){const f=page.locator('[data-manager-form="propose"]');await f.getByLabel('Reason for additional work').fill('Inspection confirmed the display module is damaged.');await f.getByLabel('Proposed repair work').fill(description);await f.getByLabel('Additional cost (AUD)').fill('85');await f.getByRole('button',{name:/Publish/}).click();}
test('customer → manager assignment/reassignment → two shortages and help → revised approval → customer completion',{timeout:180000},async()=>{
  const ctx=await browser.newContext({viewport:{width:1280,height:900}}),page=await ctx.newPage();page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    const id=await create(page,'Integration Phone');assert.equal((await data(page,id)).assignedTechnicianId,null);
    await assign(page,id,'jordan');await assign(page,id,'taylor');let j=await data(page,id);assert.equal(j.assignmentHistory.length,2);assert.equal(j.preferredTechnicianId,'taylor');
    await page.reload();assert.equal((await data(page,id)).assignedTechnicianId,'taylor');
    await role(page,'technician');await page.goto(url+'#jobs');assert.equal(await page.locator(`[data-action="job"][data-id="${id}"]`).count(),0);
    await page.getByLabel('Demo technician').selectOption('taylor');await page.locator(`[data-action="job"][data-id="${id}"]`).click();await page.getByRole('button',{name:'Start Repair',exact:true}).click();
    await part(page,'Replacement display');await part(page,'Replacement adhesive');
    await page.locator('[data-action="job-help"]').click();await page.getByLabel('Explain the Problem',{exact:true}).fill('Please check the connector before I continue.');await page.getByRole('button',{name:'Send Help Request',exact:true}).click();
    const helpId=await page.evaluate(()=>route().id);
    j=await data(page,id);assert.equal(j.shortages.length,2);assert.equal(j.status,'Waiting');
    await manager(page,id);await receive(page,j.shortages[0].id);assert.equal((await data(page,id)).shortages[1].fulfilled,false);
    await role(page,'technician');await page.goto(url+'#job/'+id);await page.getByRole('button',{name:'Continue Repair',exact:true}).click();assert.equal((await data(page,id)).status,'Waiting');
    await manager(page,id);await receive(page,j.shortages[1].id);await role(page,'technician');await page.goto(url+'#job/'+id);await page.getByRole('button',{name:'Continue Repair',exact:true}).click();assert.equal((await data(page,id)).status,'Waiting');
    await page.goto(url+'#help-detail/'+helpId);await page.locator('[data-action="resolve-help"]').click();await page.goto(url+'#job/'+id);await page.getByRole('button',{name:'Continue Repair',exact:true}).click();assert.equal((await data(page,id)).status,'In Progress');
    await manager(page,id);await publish(page,'Replace the damaged display.');
    await role(page,'customer');await page.goto(url+'#customer-progress/'+id);await page.getByRole('button',{name:'Need clarification',exact:true}).click();await page.getByLabel('Clarification request').fill('Does this include a warranty?');await page.getByRole('button',{name:'Send clarification request',exact:true}).click();
    assert.equal((await data(page,id)).approvalRequests[0].response.kind,'clarification');
    await manager(page,id);await publish(page,'Replace the display, including the stated warranty.');
    if(process.env.FIXFLOW_ARTIFACT_DIR){fs.mkdirSync(process.env.FIXFLOW_ARTIFACT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.FIXFLOW_ARTIFACT_DIR,'manager-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(process.env.FIXFLOW_ARTIFACT_DIR,'manager-mobile.png'),fullPage:true});}
    await role(page,'customer');await page.goto(url+'#customer-progress/'+id);await page.getByRole('button',{name:'Approve',exact:true}).click();j=await data(page,id);assert.equal(j.approvalRequests.length,2);assert.equal(j.approvalRequests[0].response.note,'Does this include a warranty?');assert.equal(j.approvalRequests[1].response.kind,'approved');assert.equal(j.status,'Waiting');
    await role(page,'technician');await page.goto(url+'#job/'+id);await page.getByRole('button',{name:'Continue Repair',exact:true}).click();await page.locator('[data-action="complete-repair"]').click();await page.getByRole('button',{name:'Confirm Repair Complete',exact:true}).click();assert.equal((await data(page,id)).status,'Awaiting Customer Confirmation');
    await role(page,'customer');await page.goto(url+'#customer-progress/'+id);await page.getByRole('button',{name:'Confirm repair completion',exact:true}).click();assert.equal((await data(page,id)).status,'Completed');await page.reload();assert.equal((await data(page,id)).status,'Completed');assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('manager failed storage save retains form and original job; user text is escaped',{timeout:45000},async()=>{
  const ctx=await browser.newContext(),page=await ctx.newPage();page.setDefaultTimeout(6000);
  try{
    const id=await create(page,'<img src=x onerror=alert(1)>');await manager(page,id);const before=await data(page,id);
    await page.evaluate(()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fixflow-prototype-v1')throw new DOMException('Full','QuotaExceededError');return window.savedSetItem.call(this,k,v);};});
    await page.locator('[data-manager-form="assign"] select').selectOption('marcus');await page.getByRole('button',{name:'Save assignment',exact:true}).click();assert.match(await page.locator('[data-manager-form="assign"] .manager-error').innerText(),/Could not save/);assert.deepEqual(await data(page,id),before);assert.equal(await page.locator('[data-manager-form="assign"] select').inputValue(),'marcus');assert.equal(await page.locator('.manager-detail img').count(),0);
    await page.evaluate(()=>Storage.prototype.setItem=window.savedSetItem);await page.getByRole('button',{name:'Save assignment',exact:true}).click();assert.equal((await data(page,id)).assignedTechnicianId,'marcus');
  }finally{await ctx.close();}
});
test('legacy manager URL opens shared workspace and mobile layout fits',{timeout:20000},async()=>{
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();
  try{await page.goto(url+'manager/');await page.getByRole('heading',{name:'Repair overview',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}finally{await ctx.close();}
});
