import {test} from 'node:test';
import assert from 'node:assert/strict';
import {leadInput} from '../lib/core.mjs';
import {triage,evaluate,shortlist,counts,runReminder,isOpen} from '../lib/directory.mjs';
const mk=(o={})=>({...leadInput({name:'Biz',category:'Dentists',location:'Dubai',...o}),triage:'new',country:'AE'});
const mem=()=>{const m=[];return {m,put:async(k,d)=>{const i=m.findIndex(x=>x.id===d.id);i<0?m.push({...d}):m[i]={...d};return {...d}}}};
const noop=async l=>({...l,research:{status:'website-unknown'}});
test('triage suppresses no-contact and fine websites, keeps hot and weak ones',()=>{
 assert.equal(triage(mk({})).state,'rejected');assert.equal(triage(mk({})).why,'No phone or email');
 assert.equal(triage(mk({phone:'0300 1234567'})).state,'eligible');
 const fine=mk({website:'https://x.example.org',phone:'0300 1234567',category:'Florists'});fine.research={status:'completed',checks:[{label:'Mobile viewport',detected:true},{label:'Booking or enquiry action',detected:true}]};assert.equal(triage(fine).state,'rejected');
 const dnc=mk({phone:'0300 1234567'});dnc.stage='Do not contact';assert.equal(triage(dnc).state,'rejected')});
test('priority prefers hot, email and proven demand',()=>{
 const a=triage(mk({phone:'0300 1234567'})).priority,b=triage(mk({phone:'0300 1234567',email:'a@b.co'})).priority;assert.ok(b>a);
 const g=mk({phone:'0300 1234567'});g.rating=4.6;g.reviewCount=120;assert.ok(triage(g).priority>a)});
test('evaluation honours the quota, does cheap checks first and skips slow ones when out of time',async()=>{
 const s=mem(),leads=[mk({name:'Site',website:'https://a.example.org',phone:'0300 1111111'}),mk({name:'N1',phone:'0300 2222222'}),mk({name:'N2',phone:'0300 3333333'})];
 const order=[];const research=async l=>{order.push(l.name);return noop(l)};
 const r=await evaluate({leads,put:s.put,research,quota:2});assert.equal(r.evaluated,2);assert.deepEqual(order,['N1','N2']);assert.equal(leads[0].triage,'new');
 const late=await evaluate({leads,put:s.put,research,quota:5,clock:()=>10,deadline:0});assert.equal(late.evaluated,0)});
test('shortlist tops up to the size, never exceeds it, caps one country at 40% and skips contacted leads',async()=>{
 const s=mem(),leads=[];
 for(let i=0;i<12;i++){const l=mk({name:'AE'+i,phone:'030011'+(1000+i)});Object.assign(l,{triage:'eligible',priority:100+i,country:'AE'});leads.push(l)}
 for(let i=0;i<12;i++){const l=mk({name:'US'+i,phone:'030022'+(1000+i)});Object.assign(l,{triage:'eligible',priority:50+i,country:'US'});leads.push(l)}
 const r=await shortlist({leads,put:s.put,size:10,today:'2026-10-25'});assert.equal(r.picked.length,10);
 assert.ok(r.picked.filter(l=>l.country==='AE').length<=6);assert.ok(r.picked.filter(l=>l.country==='US').length>=4);
 r.picked[0].stage='Contacted';assert.equal(isOpen(r.picked[0]),false);
 const again=await shortlist({leads,put:s.put,size:10,addedToday:10,today:'2026-10-25'});assert.equal(again.picked.length,0);
 const next=await shortlist({leads,put:s.put,size:10,addedToday:0,today:'2026-10-26'});assert.equal(next.picked.length,1);
 assert.equal(counts(leads).shortlisted,11)});
test('reminder reports waiting leads, due follow-ups and an unfinished search; stays quiet otherwise',async()=>{
 const sent=[],lead=mk({phone:'0300 1234567'});Object.assign(lead,{triage:'shortlisted',followUp:'2026-10-24'});
 const all=async()=>[lead];const clock=()=>Date.parse('2026-10-25T14:00:00Z');
 const r=await runReminder({all,settings:{dailyEnabled:true},notify:async t=>sent.push(t),clock});
 assert.match(r.message,/1 shortlisted/);assert.match(r.message,/1 follow-up due/);assert.match(r.message,/did not finish/);
 const quiet=await runReminder({all:async()=>[],settings:{dailyEnabled:true,dailyState:{day:'2026-10-25',runs:1}},clock});assert.equal(quiet.skipped,true)});
