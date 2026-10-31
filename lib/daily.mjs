import {discover} from './discover.mjs';
import {research} from './research.mjs';
import {duplicate,now,niches,prospect} from './core.mjs';
import {evaluate,shortlist,counts,EVAL_QUOTA,SHORTLIST_SIZE} from './directory.mjs';
import {pickCampaign,GEO_CATEGORIES} from './catalog.mjs';
export const DAILY_CAP=Number(process.env.DAILY_LEAD_CAP)||40;
// Custom mode, one line per target:  Dentists | Karachi | PK     or     Salons | 24.86,67.01 | 5   (lat,lon | km)
export function parseTargets(text){
 return String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,30).map(line=>{
  const [cat,where,extra]=line.split('|').map(s=>s.trim());
  if(!niches[cat]||!where)return null;
  const m=where.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  return m?{category:cat,lat:Number(m[1]),lon:Number(m[2]),radius:Number(extra)||5,city:'',country:''}
          :{category:cat,city:where,country:(extra||'').toUpperCase(),lat:'',lon:'',radius:5};
 }).filter(Boolean);
}
const where=j=>j.city?`${j.city}, ${j.country}`:`${j.lat},${j.lon}`;
// One campaign per day (one country, two regions, one industry), at most `cap` new leads per day across manual and automatic runs.
export async function runDaily({all,put,add,settings={},force=false,index=0,budgetMs=52000,cap=DAILY_CAP,impl={discover,research},notify=async()=>{},clock=Date.now}){
 const t0=clock(),dayNum=Math.floor(clock()/864e5),today=new Date(clock()).toISOString().slice(0,10);
 const prev=settings.dailyState||{},same=prev.day===today;
 const state={day:today,added:same?prev.added||0:0,runs:same?prev.runs||0:0,evaluated:same?prev.evaluated||0:0,shortlisted:same?prev.shortlisted||0:0,history:prev.history||[]};
 if(!force&&!settings.dailyEnabled)return {ok:true,skipped:true,message:'Daily run is switched off.'};
 const custom=settings.dailyMode==='custom',targets=custom?parseTargets(settings.dailyTargets):[];
 if(custom&&!targets.length)return {ok:false,message:'Add at least one target, for example Dentists | Karachi | PK'};
 const leads=await all('lead');
 // 1) collect: one campaign (one country, two regions, one industry) per day, bounded by the daily lead cap
 let label='',key,added=0,duplicates=0,hot=[],notes=[],searched=0,collected=false;
 if((force||state.runs<1)&&state.added<cap){
  collected=true;let jobs;
  if(custom){const x=targets[(dayNum+index)%targets.length];jobs=[x];label=`${x.category} · ${where(x)}`}
  else{const p=pickCampaign({day:dayNum+index,history:state.history,only:process.env.GEOAPIFY_API_KEY?Object.keys(GEO_CATEGORIES):null});key=p.key;jobs=p.regions.map(city=>({category:p.industry,city,country:p.country,lat:'',lon:'',radius:5}));label=`${p.industry} · ${p.regions.join(' + ')}, ${p.country}`}
  const addLead=add||(async(k,d)=>put(k,d));
  const run={id:crypto.randomUUID(),createdAt:now(),category:jobs[0].category,location:jobs.map(where).join(' + '),status:'Running',added:0,duplicates:0,leadIds:[],daily:true};
  await put('run',run);
  for(let i=0;i<jobs.length;i++){
   const remaining=cap-state.added-run.added;if(remaining<=0)break;
   const timeoutMs=Math.min(25000,budgetMs-(clock()-t0)-18000);if(timeoutMs<8000){notes.push(`${where(jobs[i])}: skipped, out of time`);continue}
   const limit=Math.min(40,Math.ceil(remaining/(jobs.length-i))),startAdded=run.added;
   try{
    let r=await impl.discover({...jobs[i],limit,timeoutMs,noWebsite:settings.dailyNoWebsite!==false});searched++;
    if(!r.leads.length&&settings.dailyNoWebsite!==false&&budgetMs-(clock()-t0)>45000){r=await impl.discover({...jobs[i],limit,timeoutMs:Math.min(timeoutMs,15000),contactOnly:true});notes.push(`${jobs[i].city||'area'}: no “no-website” match, used businesses with contact details`)}
    for(const l of r.leads){
     if(run.added-startAdded>=limit||state.added+run.added>=cap)break;
     if(leads.some(a=>duplicate(a,l))){run.duplicates++;continue}
     l.runId=run.id;l.triage='new';l.country=jobs[i].country;l.region=jobs[i].city;
     if(!(await addLead('lead',l))){run.duplicates++;continue}
     leads.push(l);run.leadIds.push(l.id);run.added++;
    }
    if(!r.leads.length)notes.push(`${where(jobs[i])}: no mapped matches`);
   }catch(e){notes.push(`${where(jobs[i])}: ${e.message}`)}
  }
  added=run.added;duplicates=run.duplicates;
  run.status=searched?'Discovered':'Failed';run.warning=notes.join(' · ');await put('run',run);
  hot=leads.filter(l=>l.runId===run.id&&l.stage!=='Do not contact'&&prospect(l).tier==='hot');
  state.runs+=searched?1:0;state.added+=added;if(searched&&key)state.history=[...state.history,key].slice(-300);
 }
 // 2) evaluate within the daily quota, then 3) top up the shortlist
 const ev=await evaluate({leads,put,research:impl.research,quota:Math.max(0,EVAL_QUOTA-state.evaluated),clock,deadline:t0+budgetMs-20000});
 state.evaluated+=ev.evaluated;
 const size=Math.max(5,Math.min(200,Number(settings.shortlistSize)||SHORTLIST_SIZE));
 const sl=await shortlist({leads,put,size,addedToday:state.shortlisted,today});
 state.shortlisted+=sl.picked.length;
 const c=counts(leads);
 if(!collected&&!ev.evaluated&&!sl.picked.length){const capped=state.added>=cap;return {ok:true,...(capped?{limit:true}:{skipped:true}),message:capped?`Daily limit reached (${cap} new leads). Try again tomorrow.`:'Nothing new to do right now.'}}
 const ok=!collected||searched>0;
 const message=(collected?`${label}: ${added} new (${hot.length} hot, ${duplicates} duplicates skipped). `:'')+`Evaluated ${ev.evaluated}: ${ev.eligible} kept, ${ev.rejected} suppressed. Shortlist ${sl.open} open (+${sl.picked.length} today). Directory ${c.total}.`+(notes.length?' '+notes.join(' · '):'');
 await put('settings',{sender:'Abu Huraira',email:'',booking:'',...settings,id:'settings',dailyState:state,lastDaily:{at:now(),message}});
 if(added||sl.picked.length||(!ok&&!prev.failNotified))await notify(`LeadsNoble daily${ok?'':' failed'}\n${message}\n`+sl.picked.slice(0,8).map(l=>`• ${l.name} — ${l.phone||l.email}`).join('\n'));
 return {ok,message,added,hot:hot.length,evaluated:ev.evaluated,researched:ev.evaluated,shortlisted:sl.picked.length,duplicates};
}
