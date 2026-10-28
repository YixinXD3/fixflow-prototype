// Run with Playwright and an available FIXFLOW_BROWSER channel (default msedge).
'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
let server,browser,url;
const root=path.resolve(__dirname,'..');
before(async()=>{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://localhost').pathname;const p=path.resolve(root,'.'+(n.endsWith('/')?n+'index.html':n));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');res.end(d);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch(process.env.FIXFLOW_BROWSER_PATH?{executablePath:process.env.FIXFLOW_BROWSER_PATH,headless:true}:{channel:process.env.FIXFLOW_BROWSER||'msedge',headless:true});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
const fixture=()=>({jobs:[{id:'TG-DEMO',device:'Demo phone',type:'Phone',customer:'Demo Customer',issue:'Connector test',priority:'Medium',status:'In Progress',progress:20,assignedTechnicianId:'jordan',logs:[],shortages:[]}],requests:[],labels:[],techs:[]});
async function open(data=fixture(),size={width:390,height:844}){const ctx=await browser.newContext({viewport:size});await ctx.addInitScript(data=>{if(sessionStorage.getItem('fixflow-test-seeded')!=='yes'){sessionStorage.setItem('fixflow-prototype-v1',JSON.stringify(data));sessionStorage.setItem('fixflow-customer-v1','[]');sessionStorage.setItem('fixflow-role','technician');sessionStorage.setItem('fixflow-test-seeded','yes');}},data);const page=await ctx.newPage();await page.goto(url+'#job/TG-DEMO');return {ctx,page};}
test('mobile request → recipient accept/reply → requester resolve and refresh',{timeout:45000},async()=>{const {ctx,page}=await open();const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.locator('[data-action="job-help"]').click();assert.equal(await page.locator('select[name="helperId"] option[value="jordan"]').count(),0);
 await page.getByLabel('Explain the Problem',{exact:true}).fill('Please check this connector.');await page.getByRole('button',{name:'Send Help Request',exact:true}).click();await page.waitForURL('**/#help-detail/*');const link=page.url();
 await page.getByLabel('Demo technician',{exact:true}).selectOption('taylor');await page.goto(link);assert.equal(await page.locator('[data-action="resolve-help"]').count(),0);await page.getByRole('button',{name:'Accept request',exact:true}).click();
 await page.getByLabel('Reply',{exact:true}).fill('Connector checked.');await page.getByRole('button',{name:'Send reply',exact:true}).click();
 // Reload the actual tab without replaying the fixture or copying storage.
 await page.reload();await page.getByText('Connector checked.',{exact:true}).waitFor();
 await page.getByLabel('Demo technician',{exact:true}).selectOption('jordan');await page.goto(link);
 await page.getByRole('button',{name:'Mark as Resolved',exact:true}).click();assert.match(await page.locator('#app').innerText(),/Resolved by Jordan Smith/);
 await page.reload();assert.match(await page.locator('#app').innerText(),/Resolved by Jordan Smith/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}});
test('help save failure retains draft and does not create a request',{timeout:25000},async()=>{const {ctx,page}=await open();try{await page.locator('[data-action="job-help"]').click();await page.getByLabel('Explain the Problem',{exact:true}).fill('Retain my draft.');await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fixflow-prototype-v1')throw Error('Quota');return set.call(this,k,v);};});await page.getByRole('button',{name:'Send Help Request',exact:true}).click();assert.equal(await page.getByLabel('Explain the Problem',{exact:true}).inputValue(),'Retain my draft.');assert.match(await page.locator('#toast').innerText(),/Could not save/);assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('fixflow-prototype-v1')).requests.length),0);}finally{await ctx.close();}});
test('damaged saved data shows recovery controls and preserves the raw payload',{timeout:25000},async()=>{const ctx=await browser.newContext();await ctx.addInitScript(()=>{sessionStorage.setItem('fixflow-prototype-v1','{broken');});const page=await ctx.newPage();try{await page.goto(url);await page.locator('#shared-storage-error').waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixflow-prototype-v1')),'{broken');await page.getByRole('button',{name:'Export stored data',exact:true}).waitFor();}finally{await ctx.close();}});
