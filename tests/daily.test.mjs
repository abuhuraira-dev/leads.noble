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
 const s=memory(),sent=[];const settings={dailyEnabled:true,dailyTargets:'Dentists | Karachi | PK\nSalons | Lahore | PK'};
 const found=()=>({leads:[mk({name:'Hot One',phone:'0300111222'}),mk({name:'No Contact'})],warning:''});
 const impl={discover:async o=>{assert.equal(o.noWebsite,true);assert.equal(o.category,'Salons');return found()},research:async l=>({...l,research:{status:'website-unknown'}})};
 const r=await runDaily({...s,settings,impl,index:1,notify:async t=>sent.push(t)});
 assert.equal(r.added,2);assert.equal(r.hot,1);assert.equal(r.researched,2);assert.match(sent[0],/Hot One/);assert.doesNotMatch(sent[0],/No Contact/);
 assert.equal(s.m.settings[0].lastDaily.message,r.message);assert.equal(s.m.settings[0].dailyTargets,settings.dailyTargets);
 const again=await runDaily({...s,settings,impl,index:1});assert.equal(again.added,0)});
test('daily run is skipped when switched off, reports failures and never crashes the cron',async()=>{
 const s=memory();assert.equal((await runDaily({...s,settings:{dailyTargets:'Dentists | Karachi | PK'}})).skipped,true);
 assert.equal((await runDaily({...s,settings:{}})).ok,false);
 const sent=[];const r=await runDaily({...s,settings:{dailyEnabled:true,dailyTargets:'Dentists | Karachi | PK'},impl:{discover:async()=>{throw Error('Public discovery is temporarily unavailable.')},research:async l=>l},notify:async t=>sent.push(t)});
 assert.equal(r.ok,false);assert.match(sent[0],/failed/);assert.equal(s.m.run[0].status,'Failed')});
