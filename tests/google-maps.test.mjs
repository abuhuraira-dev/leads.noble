import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMapsCSV,mapsLead,mapsOptions,shortlist,startMaps,pollMaps,engine} from '../lib/google-maps.mjs';
const csv='title,address,phone,emails,website,review_rating,review_count,place_id,link\n"Smile, Dental",Karachi,123456789,hello@smile.pk,,4.8,90,place1,https://www.google.com/maps/place/smile\nOther,Karachi,123456788,,https://other.pk,4.9,100,place2,\nFew,Karachi,123456787,,,4.9,2,place3,\n';
const opts=mapsOptions({category:'Dentists',city:'Karachi',country:'PK'});
test('scraper columns, quoted titles and full details survive conversion',()=>{
 const rows=parseMapsCSV(csv);assert.equal(rows[0].name,'Smile, Dental');
 const l=mapsLead(rows[0]);assert.equal(l.rating,4.8);assert.equal(l.reviewCount,90);assert.equal(l.email,'hello@smile.pk');assert.equal(l.maps.raw.address,'Karachi');assert.equal(l.verification.noWebsite,false);assert.equal(l.verification.niche,false);assert.equal(l.websiteStatus,'unknown');assert.ok(l.source);assert.equal(l.id,mapsLead(rows[0]).id);
});
test('filters exclude websites and insufficient reviews, dedupe and rank',()=>{
 const rows=parseMapsCSV(csv);assert.equal(shortlist([...rows,rows[0]],opts).length,1);
 const social={...rows[0],place_id:'social',website:'https://facebook.com/examplebiz'};assert.equal(shortlist([social],opts).length,0);
 assert.equal(shortlist(rows,{...opts,noWebsite:false,minReviews:0}).length,3);
 assert.throws(()=>mapsOptions({...opts,minRating:9}));assert.throws(()=>mapsOptions({...opts,lat:1}));
});
test('job creation uses explicit coordinates and rejects invalid options',async()=>{
 let body;const run=await startMaps({...opts,lat:24.86,lon:67.01},{call:async(path,o)=>{assert.equal(path,'/api/v1/jobs');body=o.body;return {id:'job-1'}}});
 assert.equal(body.lat,'24.86');assert.equal(body.email,true);assert.equal(body.max_time,600);assert.equal(run.status,'Scraping');assert.equal(run.options.minRating,4);
});
test('background job imports in resumable batches without overwriting existing leads',async()=>{
 const leads=[],runs=[];const store={all:async()=>[...leads],put:async(k,v)=>{runs.push(structuredClone(v));return v},add:async(k,l)=>{leads.push(l);return true}};
 const run={id:'run1',jobId:'job1',status:'Scraping',options:opts,leadIds:[],duplicates:0};
 const call=async path=>path.endsWith('/download')?csv:{Status:'ok'};
 await pollMaps(run,store,{call});assert.equal(run.status,'Discovered');assert.equal(run.scanned,3);assert.equal(run.added,1);assert.equal(leads.length,1);
 await pollMaps(run,store,{call});assert.equal(leads.length,1);
 const second={id:'run2',jobId:'job2',status:'Scraping',options:opts,leadIds:[],duplicates:0};
 await pollMaps(second,store,{call});assert.equal(second.added,0);assert.equal(second.duplicates,1);assert.equal(leads[0].runId,'run1');
});
test('partial import resumes after a failed run save and uses stable IDs',async()=>{
 const leads=[];let fail=true;const store={all:async()=>[...leads],add:async(k,l)=>{leads.push(l);return true},put:async(k,v)=>{if(fail){fail=false;throw Error('database disconnected')}return v}};
 const original={id:'r',jobId:'j',status:'Scraping',options:opts,leadIds:[],duplicates:0};
 const call=async path=>path.endsWith('/download')?csv:{Status:'ok'};
 await assert.rejects(()=>pollMaps(structuredClone(original),store,{call}));
 const resumed=await pollMaps(structuredClone(original),store,{call});assert.equal(resumed.added,1);assert.equal(resumed.duplicates,0);assert.equal(leads.length,1);
});
test('engine failure does not fabricate empty successful results',async()=>{
 const run={jobId:'j',status:'Scraping'};await pollMaps(run,{put:async(k,v)=>v},{call:async()=>({Status:'failed'})});assert.equal(run.status,'Failed');
 await assert.rejects(()=>engine('/api/v1/jobs',{fetchImpl:async()=>{throw Error('offline')}}),/unreachable/);
 await assert.rejects(()=>engine('/api/v1/jobs',{fetchImpl:async()=>new Response('',{status:429})}),/Rate limited/);
 assert.deepEqual(await engine('/api/v1/jobs/j',{method:'DELETE',fetchImpl:async()=>new Response(null,{status:204})}),{});
 assert.throws(()=>parseMapsCSV('title,phone\nSample,123456789'),/missing website/);
});
test('a large shortlist imports in multiple bounded batches',async()=>{
 const many='title,address,phone,emails,website,review_rating,review_count,place_id,link\n'+Array.from({length:12},(_,i)=>`Business ${i},Street ${i},555000${String(i).padStart(4,'0')},,,4.5,50,place${i},`).join('\n');
 const leads=[];const c={all:async()=>[...leads],put:async(k,v)=>structuredClone(v),add:async(k,v)=>{leads.push(v);return true}};
 const call=async path=>path.endsWith('/download')?many:{Status:'ok'};
 let run={id:'batch',jobId:'j',status:'Scraping',options:opts,leadIds:[],duplicates:0};
 run=await pollMaps(run,c,{call});assert.equal(run.status,'Importing');assert.equal(run.added,5);
 run=await pollMaps(run,c,{call});assert.equal(run.added,10);
 run=await pollMaps(run,c,{call});assert.equal(run.status,'Discovered');assert.equal(run.added,12);assert.equal(leads.length,12);
});
