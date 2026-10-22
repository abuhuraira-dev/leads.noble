import {niches, leadInput, now} from './core.mjs';
const endpoint='https://overpass.private.coffee/api/interpreter';
export function discoveryQuery(o){const niche=niches[o.category];if(!niche)throw Error('Choose an available industry.');const limit=Math.max(1,Math.min(40,Number(o.limit)||15));const radius=Math.max(1,Math.min(15,Number(o.radius)||5))*1000;let scope,setup='';if(o.lat!==''&&o.lat!=null&&o.lon!==''&&o.lon!=null){const lat=Number(o.lat),lon=Number(o.lon);if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)throw Error('Enter valid latitude and longitude.');scope=`(around:${radius},${lat},${lon})`}else{const city=String(o.city||'').trim();const country=String(o.country||'').trim().toUpperCase();if(!city||city.length>100||!/^[-\p{L}\p{N} .'’]+$/u.test(city)||!/^[A-Z]{2}$/.test(country))throw Error('Enter a city and a two-letter country code, such as Karachi and PK.');setup=`area["ISO3166-1"="${country}"]["admin_level"="2"]->.country;rel(area.country)["name"=${JSON.stringify(city)}]["boundary"="administrative"];map_to_area->.city;`;scope='(area.city)'}return `[out:json][timeout:20];${setup}nwr["${niche[0]}"="${niche[1]}"]["name"]${o.noWebsite?'[!"website"][!"contact:website"][~"^(contact:)?(phone|mobile|email)$"~"."]':''}${scope};out center tags ${limit*2};`;}
export async function discover(o){const query=discoveryQuery(o);const r=await querySource(query);if(!r.ok)throw Error(`OpenStreetMap discovery returned HTTP ${r.status}. Wait a minute and retry or import leads.`);const data=await r.json();if(data.remark)throw Error('Discovery could not finish within its resource limit. Use coordinates with a smaller radius.');const leads=(data.elements||[]).filter(e=>e.tags?.name).slice(0,Math.min(40,Number(o.limit)||15)).map(e=>{const t=e.tags;const l=leadInput({name:t.name,category:o.category,location:[t['addr:housenumber'],t['addr:street'],t['addr:city']||o.city,o.country].filter(Boolean).join(', '),website:t.website||t['contact:website'],email:t.email||t['contact:email'],phone:t.phone||t['contact:phone']||t.mobile||t['contact:mobile'],source:`https://www.openstreetmap.org/${e.type}/${e.id}`});l.externalId=`osm:${e.type}:${e.id}`;l.discoveryVerified=true;l.evidence=[{label:`OpenStreetMap ${niches[o.category].join('=')}; location inside requested search area. Listing may be outdated.`,url:l.source,at:now()}];return l});return {leads,warning:leads.length?'Directory fields may be incomplete or outdated. Research and verify before contacting.':'No matching mapped businesses. Try coordinates, a different industry, or import your own list.'};}
async function querySource(query){
 let last;
 for(const url of [endpoint,'https://maps.mail.ru/osm/tools/overpass/api/interpreter']){
  try{
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'NoblesoftLeadStudio/1.0 (+https://noblesoft.site)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(28000)});
   if(r.status===429)throw Object.assign(Error('Discovery is rate limited. Wait before retrying.'),{stop:true});
   if(r.status>=500){last=Error('Discovery service returned HTTP '+r.status);continue}
   return r;
  }catch(e){if(e.stop)throw e;last=e}
 }
 throw Error('Public discovery is temporarily unavailable. Your saved leads are safe. Retry later or import a CSV. '+(last?.message||''));
}

