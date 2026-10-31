// Isolated API/browser verification: no production credentials or records.
import http from 'node:http';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {makeSession} from '../lib/auth.mjs';
import {mkdir} from 'node:fs/promises';
const records=new Map();let jobBody;
const csv='title,address,phone,emails,website,review_rating,review_count,place_id,link\nBright Dental,Karachi,923001234567,,,4.8,120,test-place,https://www.google.com/maps/place/Bright\nWebsite Dental,Karachi,923001234568,,https://clinic.pk,4.9,200,test-website,\nFew Reviews,Karachi,923001234569,,,4.9,2,test-few,\n';
const fixture=http.createServer(async(req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;const b=raw?JSON.parse(raw):{};const url=new URL(req.url,'http://fixture');let data;
 if(url.pathname==='/api/v1/jobs'&&req.method==='POST'){jobBody=b;data={id:'fixture-job'}}
 else if(url.pathname==='/api/v1/jobs')data=[];
 else if(url.pathname.endsWith('/download')){res.end(csv);return}
 else if(url.pathname==='/api/v1/jobs/fixture-job')data={Status:'ok'};
 else if(url.pathname==='/rest/v1/records'){data=[...records.values()].filter(r=>r.kind===url.searchParams.get('kind')?.slice(3)).map(r=>({data:r.data}))}
 else if(url.pathname==='/rest/v1/rpc/put_record'){records.set(b.p_id,{kind:b.p_kind,data:b.p_data});data=b.p_data}
 else if(url.pathname==='/rest/v1/rpc/add_record'){if(records.has(b.p_id))data=false;else{records.set(b.p_id,{kind:b.p_kind,data:b.p_data});data=true}}
 else{res.statusCode=404;data={error:'Unknown fixture route'}}
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
});
await new Promise(r=>fixture.listen(0,'127.0.0.1',r));
const fixtureURL='http://127.0.0.1:'+fixture.address().port,secret='integration-only-secret-32-characters-long';
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3328'],{cwd:process.cwd(),env:{...process.env,SUPABASE_URL:fixtureURL,SUPABASE_SERVICE_KEY:'fixture',SESSION_SECRET:secret,SCRAPER_BASE_URL:fixtureURL,OWNER_ID:'fixture'}});
let logs='';app.stdout.on('data',c=>logs+=c);app.stderr.on('data',c=>logs+=c);
const cookie='nl_session='+await makeSession(secret),base='http://127.0.0.1:3328';
async function api(body,authenticated=true){const r=await fetch(base+'/api/studio',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(authenticated?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
try{
 let ready=false;for(let i=0;i<60;i++){try{await fetch(base+'/api/health');ready=true;break}catch{}await new Promise(r=>setTimeout(r,500))}assert.ok(ready,logs);
 assert.equal((await api(null,false)).status,401);
 assert.equal((await api({action:'googleHealth'})).data.ok,true);
 const start=await api({action:'googleStart',category:'Dentists',city:'Karachi',country:'PK',lat:24.86,lon:67.01,noWebsite:true,minRating:4,minReviews:10,limit:15,radius:5});assert.equal(start.status,200,JSON.stringify(start));assert.equal(start.data.run.status,'Scraping');assert.equal(jobBody.keywords[0],'Dentists in Karachi, PK');
 const polled=await api({action:'googlePoll',id:start.data.run.id});assert.equal(polled.status,200,JSON.stringify(polled));assert.equal(polled.data.run.status,'Discovered');assert.equal(polled.data.run.added,1);
 const state=(await api()).data;assert.equal(state.leads.length,1);assert.equal(state.leads[0].rating,4.8);assert.equal(state.leads[0].reviewCount,120);assert.equal(state.leads[0].verification.noWebsite,false);
 const imp=await api({action:'import',csv});assert.equal(imp.status,200);assert.equal(imp.data.duplicates,1);assert.equal(imp.data.added,2);
 const repeat=await api({action:'googlePoll',id:start.data.run.id});assert.equal(repeat.data.run.added,1);assert.equal((await api()).data.leads.length,3);
 if(process.argv.includes('--browser')){
  const {chromium}=await import('@playwright/test');const browser=await chromium.launch({headless:true});
  try{const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'nl_session',value:cookie.slice('nl_session='.length),url:base}]);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByRole('button',{name:'Discover',exact:true}).click();await page.getByLabel('Minimum Google rating').waitFor();assert.equal(await page.getByLabel('Minimum reviews').inputValue(),'10');await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/google-discover-desktop.png',fullPage:true});await page.getByRole('button',{name:'Leads',exact:false}).first().click();await page.getByText('Bright Dental',{exact:true}).first().click();await page.getByRole('dialog').waitFor();await page.screenshot({path:'artifacts/google-lead-detail.png',fullPage:true});assert.deepEqual(errors,[]);await page.getByRole('button',{name:'Close business'}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/google-leads-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));console.log('Browser: desktop discovery, lead details, mobile layout, no page errors.')}finally{await browser.close()}
 }
 console.log('PASS: authenticated create → poll → filter → save → reload → CSV import → idempotent repeat. Fixture data only.');
}finally{app.kill();await new Promise(r=>fixture.close(r))}
