import {leadInput,now} from './core.mjs';
import {CITY_CENTERS} from './catalog.mjs';
// Geoapify Places API (OpenStreetMap-based, free plan: 3,000 credits/day, attribution required).
// Used first when GEOAPIFY_API_KEY is set; the public Overpass servers are the fallback.
export const GEO_CATEGORIES={
 Dentists:['healthcare.dentist'],Restaurants:['catering.restaurant'],'Cafés':['catering.cafe'],Salons:['service.beauty.hairdresser'],Clinics:['healthcare.clinic_or_praxis'],
 Hotels:['accommodation.hotel'],Electricians:['service.electrician'],'Real estate':['office.estate_agent','service.estate_agent'],Lawyers:['office.lawyer'],Accountants:['office.accountant'],
 Bakeries:['commercial.food_and_drink.bakery'],'Car repair':['service.vehicle.repair.car'],Florists:['commercial.florist'],'Med spas':['service.beauty.spa'],'Insurance agents':['office.insurance'],
 'Mortgage & finance':['office.financial_advisor'],'Tax advisers':['office.tax_advisor'],Recruitment:['office.employment_agency'],'Business consulting':['office.consulting'],
 'Driving schools':['education.driving_school'],'Language schools':['education.language_school'],'Wedding & event venues':['activity.events_venue'],'Car detailing':['service.vehicle.car_wash'],
 'Travel agencies':['service.travel_agency','office.travel_agent'],'Medical practices':['healthcare.clinic_or_praxis.general'],'IT services':['office.it'],
};
const OSM_TYPE={n:'node',w:'way',r:'relation'};
const API='https://api.geoapify.com';
async function getJSON(url,ms,fetchImpl){
 const r=await fetchImpl(url,{signal:AbortSignal.timeout(ms)});
 if(r.status===401||r.status===403)throw Error('Geoapify rejected the API key.');
 if(r.status===429)throw Error('Geoapify daily limit reached.');
 if(!r.ok)throw Error('Geoapify returned HTTP '+r.status);
 return r.json();
}
async function area(o,key,ms,fetchImpl){
 if(o.lat!==''&&o.lat!=null&&o.lon!==''&&o.lon!=null)return `circle:${Number(o.lon)},${Number(o.lat)},${Math.max(1,Math.min(15,Number(o.radius)||5))*1000}`;
 const c=CITY_CENTERS[o.country+'|'+o.city];
 if(c)return `circle:${c[1]},${c[0]},${Math.max(Number(o.radius)||0,8)*1000}`;
 for(const type of ['&type=state','']){
  const g=await getJSON(`${API}/v1/geocode/search?text=${encodeURIComponent(o.city)}${type}&filter=countrycode:${encodeURIComponent(String(o.country).toLowerCase())}&limit=1&apiKey=${key}`,ms,fetchImpl);
  const id=g.features?.[0]?.properties?.place_id;if(id)return `place:${id}`;
 }
 throw Error(`Geoapify could not find the area “${o.city}”.`);
}
export function geoLead(f,o,cats){
 const p=f.properties||{},raw=p.datasource?.raw||{};
 const website=p.website||raw.website||raw['contact:website']||'',email=p.contact?.email||raw.email||raw['contact:email']||'',phone=p.contact?.phone||p.contact?.phone_other||raw.phone||raw['contact:phone']||raw.mobile||'';
 const l=leadInput({name:p.name,category:o.category,location:p.formatted||[p.housenumber,p.street,p.city,p.country].filter(Boolean).join(', '),website,email,phone,source:p.place_id?`https://www.openstreetmap.org/#map=18/${p.lat}/${p.lon}`:''});
 const t=OSM_TYPE[raw.osm_type];
 l.externalId=t&&raw.osm_id?`osm:${t}:${raw.osm_id}`:`geo:${p.place_id}`;l.id=l.externalId.replace(/:/g,'-');
 if(p.lat!=null&&p.lon!=null)l.geo={lat:p.lat,lon:p.lon};
 l.discoveryVerified=true;l.evidence=[{label:`Geoapify Places (${cats.join(', ')}), based on OpenStreetMap; inside requested search area. Listing may be outdated.`,url:l.source,at:now()}];
 return l;
}
export async function discoverGeoapify(o,{key,timeoutMs=20000,fetchImpl=fetch}={}){
 const cats=GEO_CATEGORIES[o.category];if(!key||!cats||o.tag)return null;
 const ms=Math.min(12000,timeoutMs),want=Math.max(1,Math.min(40,Number(o.limit)||15));
 const filter=await area(o,key,ms,fetchImpl);
 const leads=[],seen=new Set();
 for(let page=0;page<4&&leads.length<want;page++){
  const d=await getJSON(`${API}/v2/places?categories=${cats.join(',')}&filter=${filter}&limit=100&offset=${page*100}&apiKey=${key}`,ms,fetchImpl);
  const feats=d.features||[];
  for(const f of feats){
   if(!f.properties?.name||seen.has(f.properties.place_id))continue;seen.add(f.properties.place_id);
   const l=geoLead(f,o,cats),hasContact=!!(l.email||l.phone);
   if(o.noWebsite&&(l.website||l.socialUrl&&false||!hasContact))continue;
   if(o.contactOnly&&!hasContact)continue;
   leads.push(l);if(leads.length>=want)break;
  }
  if(feats.length<100)break;
 }
 return {leads,warning:leads.length?'Directory fields may be incomplete or outdated. Research and verify before contacting.':'No matching businesses with a phone or email and no website listed. Try another industry or area, or import your own list.',source:'geoapify'};
}
