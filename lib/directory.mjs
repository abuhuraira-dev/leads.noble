import {prospect,pitchFor,now} from './core.mjs';
// The directory: every discovered business is stored once (triage "new"), evaluated within a daily quota,
// then either suppressed ("rejected") or kept ("eligible"); the best eligible ones are shortlisted each day.
export const SHORTLIST_SIZE=Number(process.env.SHORTLIST_SIZE)||50;
export const EVAL_QUOTA=Number(process.env.EVAL_QUOTA)||60;
export const DONE=['Contacted','Replied','Meeting','Proposal','Won','Lost','Do not contact'];
const HIGHVALUE=['Dentists','Med spas','Alternative health','Lawyers','Accountants','Real estate','Insurance agents','Mortgage & finance','Construction','Roofing','HVAC','Solar installers','Medical practices','Clinics','Tax advisers'];
export const isOpen=l=>l.triage==='shortlisted'&&!DONE.includes(l.stage);
export const hasContact=l=>/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(l.email||'')||String(l.phone||'').replace(/\D/g,'').length>=7;
export function priority(l,p=prospect(l)){
 let s=p.tier==='hot'?100:p.tier==='warm'?60:25;
 if(/^[^\s@]+@/.test(l.email||''))s+=15;if(l.phone)s+=5;
 if(l.rating>=4&&l.reviewCount>=10)s+=Math.min(15,5+Math.round(l.reviewCount/20));
 if(l.socialUrl&&!l.website)s+=5;if(HIGHVALUE.includes(l.category))s+=8;
 return s;
}
// Decide what happens to a business after it has been researched.
export function triage(l){
 if(l.stage==='Do not contact')return {state:'rejected',why:'Do not contact'};
 if(!hasContact(l))return {state:'rejected',why:'No phone or email'};
 const p=prospect(l);
 if(p.tier==='cold'&&!pitchFor(l))return {state:'rejected',why:'Website looks fine, no clear need'};
 return {state:'eligible',priority:priority(l,p)};
}
// Cheap checks first (no website to fetch), then websites while time remains. Stops at the daily quota.
export async function evaluate({leads,put,research,quota,clock=Date.now,deadline=Infinity}){
 const queue=leads.filter(l=>l.triage==='new'&&l.stage!=='Do not contact').sort((a,b)=>(!!a.website-!!b.website)||(hasContact(b)-hasContact(a)));
 const out={evaluated:0,eligible:0,rejected:0};
 for(const l of queue){
  if(out.evaluated>=quota)break;
  const slow=!!l.website&&l.research?.status==='pending';
  if(slow&&clock()>deadline)continue;
  const r=l.research?.status==='pending'?await research(l):l,t=triage(r);
  Object.assign(l,await put('lead',{...r,triage:t.state,triageWhy:t.why||'',priority:t.priority||0,evaluatedAt:now()}));
  out.evaluated++;out[t.state==='eligible'?'eligible':'rejected']++;
 }
 return out;
}
// Fill today's shortlist from the eligible pool: best first, but no single country takes more than 40%.
export async function shortlist({leads,put,size=SHORTLIST_SIZE,addedToday=0,today=now().slice(0,10)}){
 const room=Math.max(0,Math.min(size-leads.filter(isOpen).length,size-addedToday));
 const pool=leads.filter(l=>l.triage==='eligible'&&!DONE.includes(l.stage)).sort((a,b)=>(b.priority||0)-(a.priority||0)||String(a.createdAt).localeCompare(String(b.createdAt)));
 const cap=Math.max(1,Math.ceil(size*0.4)),per={},picked=[];
 for(const pass of [0,1])for(const l of pool){
  if(picked.length>=room)break;if(picked.includes(l))continue;
  const g=l.country||'?';if(pass===0&&(per[g]||0)>=cap)continue;
  picked.push(l);per[g]=(per[g]||0)+1;
 }
 for(const l of picked)Object.assign(l,await put('lead',{...l,triage:'shortlisted',shortlistDate:today}));
 return {picked,open:leads.filter(isOpen).length};
}
export function counts(leads){
 const c={total:0,new:0,eligible:0,shortlisted:0,rejected:0,open:0};
 for(const l of leads){if(!l.triage)continue;c.total++;c[l.triage]++;if(isOpen(l))c.open++}
 return c;
}
// Evening nudge: what is waiting, what is due, and whether today's search finished.
export async function runReminder({all,settings={},notify=async()=>{},clock=Date.now}){
 const leads=await all('lead'),today=new Date(clock()).toISOString().slice(0,10),c=counts(leads);
 const due=leads.filter(l=>l.followUp&&l.followUp<=today&&!DONE.includes(l.stage)).length;
 const searched=settings.dailyState?.day===today&&settings.dailyState.runs>=1;
 const lines=[];
 if(c.open)lines.push(`${c.open} shortlisted businesses are waiting for you.`);
 if(due)lines.push(`${due} follow-up${due>1?'s':''} due.`);
 if(settings.dailyEnabled&&!searched)lines.push('Today’s search did not finish. Open the app and press “Run today’s cycle now”, or import a list.');
 if(!lines.length)return {ok:true,skipped:true,message:'Nothing to remind about.'};
 const message=lines.join(' ');await notify('LeadsNoble reminder\n'+message);
 return {ok:true,message,open:c.open,due};
}
