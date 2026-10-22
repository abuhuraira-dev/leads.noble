import {test} from 'node:test';
import assert from 'node:assert/strict';
import {leadInput,prospect,qualify} from '../lib/core.mjs';
import {discoveryQuery} from '../lib/discover.mjs';
import {parseTargets,runDaily} from '../lib/daily.mjs';
const mk=o=>({...leadInput({name:'Acme Dental',category:'Dentists',location:'Karachi',...o})});
test('prospect tiers: no website + contact is hot, no contact is cold, broken site is hot',()=>{
 assert.equal(prospect(mk({phone:'+92 300 1234567'})).tier,'hot');
 assert.equal(prospect(mk({})).tier,'cold');
 assert.match(prospect(mk({email:'a@b.co',website:'https://facebook.com/acme'})).reason,/Social page only/);
 const broken=mk({website:'https://acme.example.org',phone:'0300123456'});broken.research={status:'failed',message:'Website DNS lookup failed.'};assert.equal(prospect(broken).tier,'hot');
 const blocked=mk({website:'https://acme.example.org',phone:'0300123456'});blocked.research={status:'failed',message:'Website disallows this research path in robots.txt.'};assert.equal(prospect(blocked).tier,'cold');
 const weak=mk({website:'https://acme.example.org',phone:'0300123456'});weak.research={status:'completed',checks:[{detected:false},{detected:false},{detected:false},{detected:true}]};assert.equal(prospect(weak).tier,'warm');
 assert.equal(qualify(mk({phone:'0300123456'})).prospect.tier,'hot')});
test('noWebsite discovery asks OSM only for businesses with no website tag but a phone or email',()=>{
 const q=discoveryQuery({category:'Dentists',lat:24.86,lon:67.01,radius:5,limit:20,noWebsite:true});
 assert.match(q,/\[!"website"\]\[!"contact:website"\]/);assert.match(q,/phone\|mobile\|email/);
 assert.doesNotMatch(discoveryQuery({category:'Dentists',lat:24.86,lon:67.01,radius:5,limit:20}),/!"website"/)});
test('daily targets parse city and coordinate lines and ignore bad ones',()=>{
 const t=parseTargets('Dentists | Karachi | pk\nSalons | 24.86,67.01 | 3\nNonsense | X | PK\n\nPlumbers');
 assert.equal(t.length,2);assert.deepEqual([t[0].city,t[0].country],['Karachi','PK']);assert.equal(t[1].radius,3)});
function memory(){const m={lead:[],run:[],settings:[]};return {m,all:async k=>m[k].map(x=>({...x})),put:async(k,d)=>{const i=m[k].findIndex(x=>x.id===d.id);if(i<0)m[k].push({...d});else m[k][i]={...d};return {...d}}}}
test('daily run rotates targets, dedupes, researches, notifies and records the result',async()=>{
 const s=memory(),sent=[];const settings={dailyEnabled:true,dailyMode:'custom',dailyTargets:'Dentists | Karachi | PK\nSalons | Lahore | PK'};
 const found=()=>({leads:[mk({name:'Hot One',phone:'0300111222'}),mk({name:'No Contact'})],warning:''});
 const impl={discover:async o=>{assert.equal(o.noWebsite,true);assert.equal(o.category,'Salons');assert.equal(o.timeoutMs<=25000,true);return found()},research:async l=>({...l,research:{status:'website-unknown'}})};
 const r=await runDaily({...s,settings,impl,index:1,notify:async t=>sent.push(t)});
 assert.equal(r.added,2);assert.equal(r.hot,1);assert.equal(r.researched,2);assert.match(sent[0],/Hot One/);assert.doesNotMatch(sent[0],/No Contact/);
 assert.equal(s.m.settings[0].lastDaily.message,r.message);assert.equal(s.m.settings[0].dailyTargets,settings.dailyTargets);
 const again=await runDaily({...s,settings:s.m.settings[0],impl,index:1,force:true});assert.equal(again.added,0);assert.equal(again.duplicates,2)});
test('daily run is skipped when switched off, reports failures and never crashes the cron',async()=>{
 const s=memory();assert.equal((await runDaily({...s,settings:{dailyMode:'custom',dailyTargets:'Dentists | Karachi | PK'}})).skipped,true);
 assert.equal((await runDaily({...s,settings:{dailyEnabled:true,dailyMode:'custom'}})).ok,false);
 const sent=[];const r=await runDaily({...s,settings:{dailyEnabled:true,dailyMode:'custom',dailyTargets:'Dentists | Karachi | PK'},impl:{discover:async()=>{throw Error('Public discovery is temporarily unavailable.')},research:async l=>l},notify:async t=>sent.push(t)});
 assert.equal(r.ok,false);assert.match(sent[0],/failed/);assert.equal(s.m.run[0].status,'Failed');assert.equal(s.m.settings[0].dailyState.runs,0)});

import {COUNTRIES,AUTO_POOL,pickCampaign} from '../lib/catalog.mjs';
import {niches,duplicate as dup,pitchFor,makeOffer} from '../lib/core.mjs';
test('catalog: every industry exists, auto pool is the priority countries, regions come in pairs',()=>{
 for(const c of COUNTRIES)for(const i of c.industries)assert.ok(niches[i],c.code+' '+i);
 assert.deepEqual(AUTO_POOL.map(c=>c.code).sort(),['AE','AU','CA','DE','ES','FR','GB','IT','US','ZA']);
 const p=pickCampaign({day:20000});assert.equal(p.regions.length,2);assert.notEqual(p.regions[0],p.regions[1])});
test('rotation: stable for two days, reshuffles, avoids repeats until every combination was used',()=>{
 const a=pickCampaign({day:20000}),b=pickCampaign({day:20001});assert.equal(a.key,pickCampaign({day:20000}).key);assert.notEqual(pickCampaign({day:20000,history:[a.key]}).key,a.key);
 const seen=new Set(),hist=[];for(let d=0;d<30;d++){const p=pickCampaign({day:20000+d,history:hist});assert.ok(!hist.includes(p.key));hist.push(p.key);seen.add(p.country)}
 assert.ok(seen.size>=5);
 const all=AUTO_POOL.flatMap(c=>c.industries.map(i=>c.code+'|'+i));assert.equal(pickCampaign({day:1,history:all}).cycled,true);
 const first=Array.from({length:40},(_,e)=>pickCampaign({day:e*2}).country);assert.ok(new Set(first).size>=6)});
test('dedupe: formatted phones, legal suffixes, accents and nearby map objects are the same business',()=>{
 const A=leadInput({name:'Smile Dental Ltd.',location:'1 Main St',phone:'+92 300 1234567'}),B=leadInput({name:'Smile Dental',location:'Other',phone:'0300-1234567'});assert.equal(dup(A,B),true);
 const C=leadInput({name:'Café Noir',location:'A'}),D=leadInput({name:'Cafe Noir',location:'B'});C.geo={lat:1,lon:1};D.geo={lat:1.001,lon:1};assert.equal(dup(C,D),true);D.geo={lat:1.05,lon:1};assert.equal(dup(C,D),false);
 const E=leadInput({name:'Smile Dental',location:'City A',phone:'0300111222'}),F=leadInput({name:'Smile Dental',location:'City B',phone:'0300999888'});assert.equal(dup(E,F),false)});
test('pitch signals map to the right service line and offer',()=>{
 assert.match(pitchFor(mk({})).line,/professional website/);assert.match(pitchFor(mk({website:'https://facebook.com/x'})).line,/social traffic/);
 const w=mk({website:'https://x.example.org',category:'Dentists'});w.research={status:'completed',checks:[{label:'Mobile viewport',detected:false}]};assert.match(pitchFor(w).line,/mobile-friendly/);
 w.research={status:'completed',checks:[{label:'Mobile viewport',detected:true},{label:'Booking or enquiry action',detected:false}]};assert.match(pitchFor(w).line,/appointment scheduling/);
 w.research={status:'completed',checks:[{label:'Mobile viewport',detected:true}]};assert.match(pitchFor(w).line,/quote-request/);
 assert.match(makeOffer(w,{}).text,/quote-request and consultation funnel/)});
test('auto mode runs one campaign across two regions, falls back to contact-only, respects the daily cap and runs once a day',async()=>{
 const s=memory(),calls=[],sent=[];let n=0;
 const impl={discover:async o=>{calls.push(o);return o.noWebsite?{leads:[]}:{leads:[mk({name:'B'+(n++),phone:'03001'+(1000+n)})]}},research:async l=>({...l,research:{status:'website-unknown'}})};
 const settings={dailyEnabled:true,dailyMode:'auto'};
 const r=await runDaily({...s,settings,impl,clock:()=>20000*864e5,notify:async t=>sent.push(t)});
 assert.equal(calls.filter(c=>c.noWebsite).length,2);assert.equal(calls.filter(c=>c.contactOnly).length,2);assert.notEqual(calls[0].city,calls[2].city);assert.equal(r.added,2);
 const st=s.m.settings[0];assert.equal(st.dailyState.runs,1);assert.equal(st.dailyState.history.length,1);
 const again=await runDaily({...s,settings:st,impl,clock:()=>20000*864e5});assert.equal(again.skipped,true);
 const capped=await runDaily({...s,settings:{...st,dailyState:{...st.dailyState,added:40}},impl,force:true,clock:()=>20000*864e5});assert.equal(capped.limit,true);
 const next=await runDaily({...s,settings:st,impl,clock:()=>20001*864e5});assert.equal(next.skipped,undefined);assert.equal(s.m.settings[0].dailyState.history.length,2)});
test('discovery query matches regions by local or English name and supports custom tags',()=>{
 const q=discoveryQuery({category:'Dentists',city:'Bavaria',country:'DE',limit:20});assert.match(q,/"name"="Bavaria"/);assert.match(q,/"name:en"="Bavaria"/);assert.doesNotMatch(q,/\[~"\^name/);
 assert.match(discoveryQuery({tag:'craft=roofer',city:'Texas',country:'US'}),/"craft"="roofer"/);assert.throws(()=>discoveryQuery({tag:'craft=roofer"];out;',city:'Texas',country:'US'}))});

import {CITY_CENTERS} from '../lib/catalog.mjs';
import {discover} from '../lib/discover.mjs';
test('every listed city has a centre or is a state/province; city searches use a cheap radius query',async()=>{
 const seen=[];const realFetch=globalThis.fetch;globalThis.fetch=async(u,i)=>{seen.push(String(i.body));return {ok:true,status:200,json:async()=>({elements:[{type:'node',id:7,lat:25.2,lon:55.3,tags:{name:'Gulf Travel',phone:'+971 4 000 0000'}}]})}};
 try{const r=await discover({category:'Travel agencies',city:'Dubai',country:'AE',limit:5,radius:5,lat:'',lon:''});
  assert.match(seen[0],/around%3A8000%2C25\.2048%2C55\.2708|around:8000,25\.2048,55\.2708/);assert.doesNotMatch(seen[0],/ISO3166/);assert.equal(r.leads[0].id,'osm-node-7');assert.deepEqual(r.leads[0].geo,{lat:25.2,lon:55.3});
  await discover({category:'Roofing',city:'Texas',country:'US',limit:5,lat:'',lon:''});assert.match(seen[1],/ISO3166/)}finally{globalThis.fetch=realFetch}});
test('discovery fails over between servers on 504 and names what went wrong',async()=>{
 const urls=[];const realFetch=globalThis.fetch;globalThis.fetch=async(u)=>{urls.push(new URL(u).hostname);return {ok:false,status:504,json:async()=>({})}};
 try{await assert.rejects(()=>discover({category:'Dentists',lat:24.86,lon:67.01,radius:3,limit:5,timeoutMs:20000}),/overpass\.private\.coffee: HTTP 504; maps\.mail\.ru: HTTP 504/);assert.ok(urls.length>=2)}finally{globalThis.fetch=realFetch}});

import {discoverGeoapify,geoLead,GEO_CATEGORIES} from '../lib/geoapify.mjs';
test('geoapify categories are all real keys and every one maps to a known industry',()=>{for(const k of Object.keys(GEO_CATEGORIES))assert.ok(niches[k],k)});
test('geoapify source: circle search for cities, no-website + contact filter, OSM ids for dedupe, key errors are clear',async()=>{
 const urls=[];const feat=(id,name,extra={})=>({properties:{place_id:id,name,formatted:name+', Dubai',lat:25.2,lon:55.3,datasource:{raw:{osm_type:'n',osm_id:Number(id.slice(1))}},...extra}});
 const fetchImpl=async u=>{urls.push(u);return {ok:true,status:200,json:async()=>({features:[feat('p1','Has Site',{website:'https://x.example.org',contact:{phone:'+971 4 1'}}),feat('p2','No Site Phone',{contact:{phone:'+971 4 2222222'}}),feat('p3','Nothing')]})}};
 const r=await discoverGeoapify({category:'Travel agencies',city:'Dubai',country:'AE',lat:'',lon:'',radius:5,limit:10,noWebsite:true},{key:'K',fetchImpl});
 assert.equal(r.leads.length,1);assert.equal(r.leads[0].name,'No Site Phone');assert.equal(r.leads[0].externalId,'osm:node:2');assert.equal(r.leads[0].id,'osm-node-2');
 assert.match(urls[0],/categories=service\.travel_agency,office\.travel_agent&filter=circle:55\.2708,25\.2048,8000&limit=100/);assert.match(urls[0],/apiKey=K/);
 assert.equal(await discoverGeoapify({category:'Roofing',city:'Dubai',country:'AE'},{key:'K',fetchImpl}),null);
 await assert.rejects(()=>discoverGeoapify({category:'Dentists',city:'Dubai',country:'AE',limit:5},{key:'bad',fetchImpl:async()=>({ok:false,status:401})}),/rejected the API key/)});
test('discover prefers geoapify when a key exists and falls back to the public servers when it fails',async()=>{
 const realFetch=globalThis.fetch;process.env.GEOAPIFY_API_KEY='K';const hosts=[];
 globalThis.fetch=async u=>{const h=new URL(u).hostname;hosts.push(h);if(h==='api.geoapify.com')return {ok:false,status:500,json:async()=>({})};return {ok:true,status:200,json:async()=>({elements:[{type:'node',id:9,lat:1,lon:1,tags:{name:'Fallback Dental',phone:'0300 111 2222'}}]})}};
 try{const r=await discover({category:'Dentists',city:'Karachi',country:'PK',limit:5,lat:'',lon:'',noWebsite:true});assert.equal(r.leads[0].name,'Fallback Dental');assert.ok(hosts[0]==='api.geoapify.com'&&hosts.some(h=>h!=='api.geoapify.com'))}finally{globalThis.fetch=realFetch;delete process.env.GEOAPIFY_API_KEY}});
