import {discover} from './discover.mjs';
import {research} from './research.mjs';
import {duplicate,now,niches,prospect} from './core.mjs';
// One line per target:  Dentists | Karachi | PK     or     Salons | 24.86,67.01 | 5   (lat,lon | km)
export function parseTargets(text){
 return String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,30).map(line=>{
  const [cat,where,extra]=line.split('|').map(s=>s.trim());
  if(!niches[cat]||!where)return null;
  const m=where.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  return m?{category:cat,lat:Number(m[1]),lon:Number(m[2]),radius:Number(extra)||5,city:'',country:''}
          :{category:cat,city:where,country:(extra||'').toUpperCase(),lat:'',lon:'',radius:5};
 }).filter(Boolean);
}
export async function runDaily({all,put,settings={},force=false,index,budgetMs=52000,impl={discover,research},notify=async()=>{},clock=Date.now}){
 const t0=clock(),targets=parseTargets(settings.dailyTargets);
 if(!targets.length)return {ok:false,message:'Add at least one daily target first, e.g. Dentists | Karachi | PK'};
 if(!force&&!settings.dailyEnabled)return {ok:true,skipped:true,message:'Daily run is switched off.'};
 const target=targets[(index??Math.floor(clock()/864e5))%targets.length];
 const label=target.city?`${target.category} in ${target.city}, ${target.country}`:`${target.category} near ${target.lat},${target.lon}`;
 const leads=await all('lead');
 const run={id:crypto.randomUUID(),createdAt:now(),category:target.category,location:label,status:'Running',added:0,duplicates:0,leadIds:[],daily:true};
 await put('run',run);
 let message,ok=true,researched=0;
 try{
  const r=await impl.discover({...target,limit:40,noWebsite:settings.dailyNoWebsite!==false});
  for(const l of r.leads){if(leads.some(a=>duplicate(a,l))){run.duplicates++;continue}l.runId=run.id;await put('lead',l);leads.push(l);run.leadIds.push(l.id);run.added++}
  run.status='Discovered';run.warning=r.warning;
  const queue=leads.filter(l=>l.research?.status==='pending'&&l.stage!=='Do not contact').sort((a,b)=>(b.runId===run.id)-(a.runId===run.id));
  for(const l of queue){if(clock()-t0>budgetMs-20000)break;Object.assign(l,await put('lead',await impl.research(l)));researched++}
  const hot=leads.filter(l=>l.runId===run.id&&l.stage!=='Do not contact'&&prospect(l).tier==='hot');
  message=`${label}: ${run.added} new (${hot.length} hot), ${researched} researched.`+(run.added?'':' '+(r.warning||''));
  if(run.added)await notify(`NobleLeads daily\n${message}\n`+hot.slice(0,8).map(l=>`• ${l.name} — ${l.phone||l.email}`).join('\n'));
  run.hot=hot.length;
 }catch(e){ok=false;run.status='Failed';run.warning=e.message;message=`${label}: ${e.message}`;await notify('NobleLeads daily failed\n'+message)}
 await put('run',run);
 await put('settings',{sender:'Abu Huraira',email:'',booking:'',...settings,id:'settings',lastDaily:{at:now(),message}});
 return {ok,message,added:run.added,hot:run.hot||0,researched};
}
