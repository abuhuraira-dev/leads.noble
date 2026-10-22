import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discover} from '../lib/discover.mjs';
import {qualify} from '../lib/core.mjs';
const options={category:'Dentists',city:'Karachi',country:'PK',lat:24.86,lon:67.01,radius:3,limit:3};
const fixture={elements:[{type:'node',id:1,tags:{name:'Fixture Dental',amenity:'dentist','contact:phone':'+92 300 0000000'}}]};
test('OSM listing has a stable source without inventing website absence',async t=>{t.mock.method(globalThis,'fetch',async()=>Response.json(fixture));const r=await discover(options);assert.equal(r.leads.length,1);assert.equal(r.leads[0].externalId,'osm:node:1');assert.equal(r.leads[0].source,'https://www.openstreetmap.org/node/1');assert.equal(r.leads[0].websiteStatus,'unknown');assert.notEqual(qualify(r.leads[0]).verdict,'Qualified')});
test('network failure uses the second permitted source',async t=>{let calls=0;const hosts=[];t.mock.method(globalThis,'fetch',async u=>{hosts.push(new URL(u).hostname);if(calls++===0)throw Error('Network unavailable');return Response.json(fixture)});const r=await discover(options);assert.equal(r.leads.length,1);assert.deepEqual(hosts,['overpass.private.coffee','maps.mail.ru'])});
test('rate limiting stops the workflow instead of hopping providers',async t=>{let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('',{status:429})});await assert.rejects(()=>discover(options),/rate limited/);assert.equal(calls,1)});
