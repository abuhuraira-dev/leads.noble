import {nicheOf, leadInput, now} from './core.mjs';
import './net.mjs';
import {why} from './net.mjs';
import {CITY_CENTERS} from './catalog.mjs';
import {discoverGeoapify} from './geoapify.mjs';
const endpoint='https://overpass.private.coffee/api/interpreter';
export function discoveryQuery(o){const niche=nicheOf(o);const limit=Math.max(1,Math.min(40,Number(o.limit)||15));const radius=Math.max(1,Math.min(15,Number(o.radius)||5))*1000;let scope,setup='';if(o.lat!==''&&o.lat!=null&&o.lon!==''&&o.lon!=null){const lat=Number(o.lat),lon=Number(o.lon);if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)throw Error('Enter valid latitude and longitude.');scope=`(around:${radius},${lat},${lon})`}else{const city=String(o.city||'').trim();const country=String(o.country||'').trim().toUpperCase();if(!city||city.length>100||!/^[-\p{L}\p{N} .'’]+$/u.test(city)||!/^[A-Z]{2}$/.test(country))throw Error('Enter a city and a two-letter country code, such as Karachi and PK.');setup=`area["ISO3166-1"="${country}"]["admin_level"="2"]->.country;(${['name','name:en'].map(k=>`rel(area.country)["${k}"=${JSON.stringify(city)}]["boundary"="administrative"]["admin_level"~"^[3-8]$"];`).join('')});map_to_area->.city;`;scope='(area.city)'}return `[out:json][timeout:20];${setup}nwr["${niche[0]}"="${niche[1]}"]["name"]${o.noWebsite?'[!"website"][!"contact:website"][~"^(contact:)?(phone|mobile|email)$"~"."]':o.contactOnly?'[~"^(contact:)?(phone|mobile|email)$"~"."]':''}${scope};out center tags ${limit*2};`;}
export async function discover(o0){const ctr=CITY_CENTERS[o0.country+'|'+o0.city],o=ctr&&(o0.lat===''||o0.lat==null)?{...o0,lat:ctr[0],lon:ctr[1],radius:Math.max(Number(o0.radius)||0,8)}:o0;let geoError='';if(process.env.GEOAPIFY_API_KEY){try{const g=await discoverGeoapify(o,{key:process.env.GEOAPIFY_API_KEY,timeoutMs:Number(o.timeoutMs)||20000});if(g)return g;geoError=o.tag?'':`does not cover “${o.category}”. Pick an industry such as Dentists, Salons, Real estate, Lawyers, Accountants, Clinics or Restaurants for reliable results.`}catch(e){geoError=e.message}}else geoError='no GEOAPIFY_API_KEY is set in .env.local (a free key makes searches reliable).';
const query=discoveryQuery(o);let r;try{r=await querySource(query,Number(o.timeoutMs)||28000)}catch(e){throw geoError?Error(e.message+' Geoapify: '+geoError):e}if(!r.ok)throw Error(`OpenStreetMap discovery returned HTTP ${r.status}. Wait a minute and retry or import leads.`);const data=await r.json();if(data.remark)throw Error('Discovery could not finish within its resource limit. Use coordinates with a smaller radius.');const leads=(data.elements||[]).filter(e=>e.tags?.name).slice(0,Math.min(40,Number(o.limit)||15)).map(e=>{const t=e.tags;const l=leadInput({name:t.name,category:o.category||o.tag,location:[t['addr:housenumber'],t['addr:street'],t['addr:city']||o.city,o.country].filter(Boolean).join(', '),website:t.website||t['contact:website'],email:t.email||t['contact:email'],phone:t.phone||t['contact:phone']||t.mobile||t['contact:mobile'],source:`https://www.openstreetmap.org/${e.type}/${e.id}`});l.externalId=`osm:${e.type}:${e.id}`;l.id=`osm-${e.type}-${e.id}`;const la=e.lat??e.center?.lat,lo=e.lon??e.center?.lon;if(la!=null&&lo!=null)l.geo={lat:la,lon:lo};l.discoveryVerified=true;l.evidence=[{label:`OpenStreetMap ${nicheOf(o).join('=')}; location inside requested search area. Listing may be outdated.`,url:l.source,at:now()}];return l});return {leads,warning:leads.length?'Directory fields may be incomplete or outdated. Research and verify before contacting.':'No matching mapped businesses. Try coordinates, a different industry, or import your own list.'};}
async function querySource(query,timeoutMs=28000){
 const custom=(process.env.OVERPASS_ENDPOINTS||'').split(',').map(s=>s.trim()).filter(u=>/^https:\/\//.test(u));
 const list=custom.length?custom:[endpoint,'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
 const end=Date.now()+timeoutMs,errors=[];
 for(let pass=0;pass<2;pass++)for(const url of list){
  const left=end-Date.now();if(left<4000)break;
  const name=new URL(url).hostname;
  try{
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'NoblesoftLeadStudio/1.0 (+https://noblesoft.site)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(Math.min(left,Math.round(timeoutMs/list.length*1.3)))});
   if(r.status===429)throw Object.assign(Error('Discovery is rate limited. Wait before retrying.'),{stop:true});
   if(r.status>=500){errors.push(`${name}: HTTP ${r.status}`);continue}
   return r;
  }catch(e){if(e.stop)throw e;errors.push(`${name}: ${/abort|timeout/i.test(e.message)?'timed out':why(e)}`)}
  await new Promise(r=>setTimeout(r,pass?0:1200));
 }
 throw Error('Public discovery is temporarily unavailable. Your saved leads are safe. Retry later or import a CSV. ('+[...new Set(errors)].join('; ')+')');
}
