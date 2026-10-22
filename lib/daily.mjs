import {discover} from './discover.mjs';
import {research} from './research.mjs';
import {duplicate,now,niches,prospect} from './core.mjs';
import {pickCampaign} from './catalog.mjs';
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
 const prev=settings.dailyState||{},state={day:today,added:prev.day===today?prev.added||0:0,runs:prev.day===today?prev.runs||0:0,history:prev.history||[]};
 if(!force&&!settings.dailyEnabled)return {ok:true,skipped:true,message:'Daily run is switched off.'};
 if(!force&&state.runs>=1)return {ok:true,skipped:true,message:'Today’s campaign already ran.'};
 if(state.added>=cap)return {ok:true,limit:true,message:`Daily limit reached (${cap} new leads). Try again tomorrow.`};
 let jobs,label,key;
 if(settings.dailyMode==='custom'){
  const t=parseTargets(settings.dailyTargets);if(!t.length)return {ok:false,message:'Add at least one target, for example Dentists | Karachi | PK'};
  const x=t[(dayNum+index)%t.length];jobs=[x];label=`${x.category} · ${where(x)}`;
 }else{
  const p=pickCampaign({day:dayNum+index,history:state.history});key=p.key;
  jobs=p.regions.map(city=>({category:p.industry,city,country:p.country,lat:'',lon:'',radius:5}));label=`${p.industry} · ${p.regions.join(' + ')}, ${p.country}`;
 }
 const leads=await all('lead'),addLead=add||(async(k,d)=>put(k,d));
 const run={id:crypto.randomUUID(),createdAt:now(),category:jobs[0].category,location:label,status:'Running',added:0,duplicates:0,leadIds:[],daily:true};
 await put('run',run);
 const notes=[];let searched=0,researched=0;
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
    l.runId=run.id;if(!(await addLead('lead',l))){run.duplicates++;continue}
    leads.push(l);run.leadIds.push(l.id);run.added++;
   }
   if(!r.leads.length)notes.push(`${where(jobs[i])}: no mapped matches`);
  }catch(e){notes.push(`${where(jobs[i])}: ${e.message}`)}
 }
 const ok=searched>0;
 if(ok){
  const queue=leads.filter(l=>l.research?.status==='pending'&&l.stage!=='Do not contact').sort((a,b)=>(b.runId===run.id)-(a.runId===run.id));
  for(const l of queue){if(clock()-t0>budgetMs-20000)break;Object.assign(l,await put('lead',await impl.research(l)));researched++}
 }
 const hot=leads.filter(l=>l.runId===run.id&&l.stage!=='Do not contact'&&prospect(l).tier==='hot');
 run.status=ok?'Discovered':'Failed';run.warning=notes.join(' · ');run.hot=hot.length;await put('run',run);
 const message=`${label}: ${run.added} new (${hot.length} hot, ${run.duplicates} duplicates skipped), ${researched} researched.`+(notes.length?' '+notes.join(' · '):'');
 const next={day:today,added:state.added+run.added,runs:state.runs+(ok?1:0),history:(ok&&key?[...state.history,key]:state.history).slice(-300)};
 await put('settings',{sender:'Abu Huraira',email:'',booking:'',...settings,id:'settings',dailyState:next,lastDaily:{at:now(),message}});
 if(run.added||!ok)await notify(`LeadsNoble daily${ok?'':' failed'}\n${message}\n`+hot.slice(0,8).map(l=>`• ${l.name} — ${l.phone||l.email}`).join('\n'));
 return {ok,message,added:run.added,hot:hot.length,researched,duplicates:run.duplicates};
}
