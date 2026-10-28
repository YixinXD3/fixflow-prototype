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
test('supplier workflow: stock, editable draft, persisted links, unsaved guard and receipt separation',{timeout:60000},async()=>{
 const ctx=await browser.newContext({viewport:{width:1280,height:900}}),page=await ctx.newPage();page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const id=await create(page,'Supplier demo phone');await assign(page,id,'jordan');await role(page,'technician');await page.goto(url+'#job/'+id);await part(page,'Compatible display');await manager(page,id);
  const sid=(await data(page,id)).shortages[0].id;
  const detail=page.locator('.manager-procurement');await detail.locator(':scope > summary').click();
  const form=page.locator('[data-manager-form="procurement"]');
  await form.getByLabel('Stock check',{exact:true}).selectOption('available');await form.getByLabel('Requirement and stock check notes').fill('Display required; one found in shelf A.');await form.getByRole('button',{name:'Save stock and supplier details'}).click();assert.equal(await page.locator('[data-supplier-contact]').count(),0);assert.equal((await data(page,id)).shortages[0].fulfilled,false);
  await detail.locator(':scope > summary').click();await form.getByLabel('Stock check',{exact:true}).selectOption('unavailable');await form.getByLabel('Requirement and stock check notes').fill('Shelf part incompatible. Correct display unavailable.');await form.getByLabel('Quantity',{exact:true}).fill('2');await form.getByLabel('Supplier name',{exact:true}).fill('Example parts');await form.getByLabel('Supplier email (optional)',{exact:true}).fill('parts@example.com');await form.getByLabel('Supplier website (optional, HTTPS)',{exact:true}).fill('https://example.com/parts');await form.getByLabel('Email message',{exact:true}).fill('Please quote two compatible displays.\nConfirm delivery time.');await form.getByRole('button',{name:'Save stock and supplier details'}).click();
  await page.reload();await detail.locator(':scope > summary').click();assert.equal(await form.getByLabel('Quantity',{exact:true}).inputValue(),'2');assert.equal((await data(page,id)).shortages[0].procurementHistory.length,2);
  const link=page.getByRole('link',{name:'Open email draft'});const mail=new URL(await link.getAttribute('href'));assert.equal(mail.protocol,'mailto:');assert.equal(mail.searchParams.get('body'),'Please quote two compatible displays.\nConfirm delivery time.');assert.equal(await page.getByRole('link',{name:'Open supplier website'}).getAttribute('href'),'https://example.com/parts');
  await form.getByLabel('Supplier name',{exact:true}).fill('Unsaved change');let blocked=false;page.once('dialog',async d=>{blocked=/Save your stock/.test(d.message());await d.accept();});await link.click();assert.equal(blocked,true);await form.getByRole('button',{name:'Save stock and supplier details'}).click();await detail.locator(':scope > summary').click();
  await page.route('https://example.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<h1>Mock supplier only</h1>'}));
  const [popup]=await Promise.all([page.waitForEvent('popup'),page.getByRole('link',{name:'Open supplier website'}).click()]);await popup.waitForLoadState();assert.equal(popup.url(),'https://example.com/parts');await popup.close();
  let record=await data(page,id);assert.equal(record.status,'Waiting');assert.equal(record.shortages[0].fulfilled,false);assert.notEqual(record.shortages[0].status,'Ordered');
  await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fixflow-prototype-v1')throw Error('full');return originalSet.call(this,k,v);};});await form.getByLabel('External order reference (optional)').fill('REF-123');await form.getByRole('button',{name:'Save stock and supplier details'}).click();assert.match(await form.locator('.manager-error').innerText(),/Could not save/);assert.equal((await data(page,id)).shortages[0].procurement.orderReference,'');await page.evaluate(()=>Storage.prototype.setItem=originalSet);await form.getByRole('button',{name:'Save stock and supplier details'}).click();
  await detail.locator(':scope > summary').click();await detail.scrollIntoViewIfNeeded();if(process.env.FIXFLOW_ARTIFACT_DIR){fs.mkdirSync(process.env.FIXFLOW_ARTIFACT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.FIXFLOW_ARTIFACT_DIR,'supplier-desktop.png')});}await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(process.env.FIXFLOW_ARTIFACT_DIR)await page.screenshot({path:path.join(process.env.FIXFLOW_ARTIFACT_DIR,'supplier-mobile.png')});assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
});
