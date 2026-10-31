// npm run doctor : checks that this PC can reach every service the app uses and says which one fails and why.
import '../lib/net.mjs';
import {why} from '../lib/net.mjs';
import dns from 'node:dns/promises';
const env=process.env,sb=(env.SUPABASE_URL||'').replace(/\/$/,'');
const targets=[
 ['Supabase database',sb?sb+'/rest/v1/':'',{headers:{apikey:env.SUPABASE_SERVICE_KEY||''}},'SUPABASE_URL is empty in .env.local'],
 ['Geoapify places',env.GEOAPIFY_API_KEY?'https://api.geoapify.com/v1/geocode/search?text=Dubai&limit=1&apiKey='+encodeURIComponent(env.GEOAPIFY_API_KEY.trim()):'',{},'GEOAPIFY_API_KEY is empty in .env.local'],
 ['Overpass: private.coffee','https://overpass.private.coffee/api/status',{}],
 ['Overpass: VK Maps','https://maps.mail.ru/osm/tools/overpass/api/status',{}],
 ['Telegram','https://api.telegram.org/',{}],
 ['Google Maps engine (optional)',env.SCRAPER_BASE_URL||'http://127.0.0.1:8080',{},''],
];
let bad=0;
for(const [name,url,init,missing] of targets){
 if(!url){console.log(`-  ${name.padEnd(30)} skipped: ${missing}`);continue}
 const host=new URL(url).hostname,t0=Date.now();
 let ips='';try{const a=await dns.lookup(host,{all:true});ips=a.map(x=>'IPv'+x.family).join('+')}catch(e){ips='DNS failed ('+e.code+')'}
 try{const r=await fetch(url,{...init,signal:AbortSignal.timeout(12000)});console.log(`${r.status<500?'OK':'!!'} ${name.padEnd(30)} HTTP ${r.status} in ${Date.now()-t0} ms  [${ips}]`);if(r.status>=500)bad++}
 catch(e){const optional=name.includes('optional');if(!optional)bad++;console.log(`${optional?'-':'XX'} ${name.padEnd(30)} ${/abort|timeout/i.test(e.message)?'TIMED OUT after 12 s':why(e)}  [${ips}]`)}
}
console.log(bad?'\nSomething above failed. XX = this PC cannot reach it (network, VPN, antivirus or firewall). Try a phone hotspot or a VPN, then run this again.':'\nAll required services reachable.');
