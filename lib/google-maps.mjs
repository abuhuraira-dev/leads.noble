import {createHash} from 'node:crypto';
import {leadInput,parseCSV,now,duplicate,qualify} from './core.mjs';
import {CITY_CENTERS} from './catalog.mjs';

export function parseMapsCSV(csv){
 const rows=parseCSV(csv);
 const keys=rows[0]?Object.keys(rows[0]):csv.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0].split(',').map(k=>k.trim().replace(/^"|"$/g,'').toLowerCase());
 if(!['website','review_rating','review_count'].every(k=>keys.includes(k)))throw Error('Scraper CSV is missing website, review_rating or review_count columns. Check the engine version; results were not classified.');
 return rows.map(r=>({...r,name:r.name||r.title}));
}
export function mapsLead(r){
 const l=leadInput({...r,name:r.name||r.title,location:r.location||r.address,email:String(r.email||r.emails||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||'',source:r.source||r.link});
 const identity=r.place_id||r.cid||l.source||`${l.name}|${l.location}`;
 l.externalId='google:'+identity;l.id='google-'+createHash('sha256').update(identity).digest('hex').slice(0,32);
 l.rating=Math.max(0,Math.min(5,Number(r.review_rating||r.rating)||0));
 l.reviewCount=Math.max(0,Math.floor(Number(String(r.review_count||r.reviewCount||0).replace(/,/g,''))||0));
 l.maps={placeId:r.place_id||'',cid:r.cid||'',rating:l.rating,reviewCount:l.reviewCount,websiteListed:!!String(r.website||'').trim(),raw:r};
 if(!l.source&&r.place_id)l.source='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(l.name)+'&query_place_id='+encodeURIComponent(r.place_id);
 if(!l.source)l.source='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(l.name+' '+l.location);
 if(r.latitude!==''&&r.longitude!==''&&r.latitude!=null&&r.longitude!=null&&Number.isFinite(Number(r.latitude))&&Number.isFinite(Number(r.longitude)))l.geo={lat:Number(r.latitude),lon:Number(r.longitude)};
 l.evidence=[{label:`Google Maps listing: ${l.rating}/5 from ${l.reviewCount} reviews. ${l.maps.websiteListed?'Website field populated.':'No website listed; independently verify before offering.'}`,url:l.source,at:now()}];
 return qualify(l);
}
export function mapsOptions(b){
 const number=(key,fallback,min,max)=>{const v=Number(b[key]??fallback);if(!Number.isFinite(v)||v<min||v>max)throw Error(`Invalid ${key}: use ${min}–${max}.`);return v};
 const category=String(b.category||'').trim().slice(0,100),city=String(b.city||'').trim().slice(0,100),country=String(b.country||'').trim().toUpperCase();
 if(!category||category==='__tag')throw Error('Choose a business industry for Google Maps.');
 if(!city||!country.match(/^[A-Z]{2}$/))throw Error('Enter a city and two-letter country code.');
 const o={category,city,country,minRating:number('minRating',4,0,5),minReviews:number('minReviews',10,0,1000000),limit:Math.floor(number('limit',15,1,40)),radius:number('radius',5,1,15),noWebsite:b.noWebsite!==false};
 if(b.lat!==''&&b.lat!=null||b.lon!==''&&b.lon!=null){if(b.lat===''||b.lat==null||b.lon===''||b.lon==null)throw Error('Enter both coordinates.');o.lat=number('lat',0,-90,90);o.lon=number('lon',0,-180,180)}
 return o;
}
export function shortlist(rows,o){
 const seen=new Set();return rows.map(mapsLead).filter(l=>{if(!l.name||seen.has(l.id))return false;seen.add(l.id);return l.rating>=o.minRating&&l.reviewCount>=o.minReviews&&(!o.noWebsite||!l.maps.websiteListed)}).sort((a,b)=>b.reviewCount-a.reviewCount||b.rating-a.rating).slice(0,o.limit);
}
export async function engine(path,{method='GET',body,fetchImpl=fetch}={}){
 const base=process.env.SCRAPER_BASE_URL||'http://127.0.0.1:8080';
 let r;try{r=await fetchImpl(base.replace(/\/$/,'')+path,{method,headers:{'Content-Type':'application/json',...(process.env.SCRAPER_API_KEY?{'X-API-Key':process.env.SCRAPER_API_KEY}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000),redirect:'error'})}catch{throw Error('Google Maps engine unreachable. Start Docker and run scripts/start-scraper.ps1 in this project. A hosted app needs a reachable, protected scraper server.');}
 if(!r.ok)throw Error(`Google Maps engine returned HTTP ${r.status}. ${r.status===429?'Rate limited; wait before retrying.':r.status===401||r.status===403?'Check scraper authentication.':'Check the engine logs.'}`);
 const text=await r.text();if(text.length>10000000)throw Error('Scraper output exceeds 10 MB; use a smaller search.');
 return path.endsWith('/download')?text:text?JSON.parse(text):{};
}
export async function startMaps(b,{call=engine,fetchImpl=fetch}={}){
 const o=mapsOptions(b);let coords=o.lat!=null?[o.lat,o.lon]:CITY_CENTERS[o.country+'|'+o.city];
 if(!coords){
  const r=await fetchImpl('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes='+o.country.toLowerCase()+'&q='+encodeURIComponent(o.city),{headers:{'User-Agent':'LeadsNoble/1.0 (business discovery)'},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('City lookup failed. Enter coordinates to search without city lookup.');const g=(await r.json())[0];if(!g)throw Error('City not found. Enter coordinates.');coords=[Number(g.lat),Number(g.lon)];
 }
 const j=await call('/api/v1/jobs',{method:'POST',body:{name:`LeadsNoble ${o.category} ${o.city}`,keywords:[`${o.category} in ${o.city}, ${o.country}`],lat:String(coords[0]),lon:String(coords[1]),lang:'en',zoom:14,radius:Math.round(o.radius*1000),depth:5,email:true,fast_mode:false,max_time:600}});
 if(!/^[a-zA-Z0-9_-]+$/.test(j.id||''))throw Error('Engine returned an invalid job ID.');
 return {id:crypto.randomUUID(),createdAt:now(),category:o.category,location:o.city+', '+o.country,provider:'google',jobId:j.id,options:o,status:'Scraping',added:0,duplicates:0,leadIds:[],warning:'Google Maps job queued. Results can take several minutes. Radius guides the search; confirm listing locations.'};
}
export async function pollMaps(run,c,{call=engine}={}){
 if(!['Scraping','Importing'].includes(run.status))return run;
 const path='/api/v1/jobs/'+encodeURIComponent(run.jobId);
 if(run.status==='Scraping'){
  const j=await call(path);const status=String(j.Status??j.status??'').toLowerCase();
  if(status==='failed'){run.status='Failed';run.warning='Google Maps engine reported failure. Inspect Docker logs; blocking, rate limits or browser failures are possible. No cause has been confirmed.';return c.put('run',run)}
  if(status!=='ok'){run.warning='Google Maps engine status: '+(status||'unknown')+'. Waiting for completion.';return c.put('run',run)}
 }
 const rows=parseMapsCSV(await call(path+'/download'));const matches=shortlist(rows,run.options);
 run.status='Importing';run.scanned=rows.length;run.matched=matches.length;let cursor=run.cursor||0;
 const leads=await c.all('lead');
 for(const l of matches.slice(cursor,cursor+5)){
  const existing=leads.find(a=>duplicate(a,l));
  if(existing){if(existing.runId===run.id){if(!run.leadIds.includes(existing.id))run.leadIds.push(existing.id)}else run.duplicates++}
  else{l.runId=run.id;if(await c.add('lead',l)){leads.push(l);run.leadIds.push(l.id)}else run.duplicates++}
  run.cursor=++cursor;
 }
 run.added=run.leadIds.length;
 if(cursor>=matches.length){run.status='Discovered';run.warning=`${rows.length} listings collected; ${matches.length} meet your filters; ${run.added} saved. ${matches.length?'Review location, contact details and website absence before qualifying.':'Try a smaller city area or lower the rating/review thresholds. Empty results alone do not prove blocking.'}`}
 return c.put('run',run);
}
