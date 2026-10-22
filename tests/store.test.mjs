import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../lib/store.mjs';
import {makeSession,checkSession,passwordOk} from '../lib/auth.mjs';
function fake(pages){const calls=[];const f=async(url,init)=>{calls.push({url,init});const body=pages.shift();return {ok:true,status:200,json:async()=>body,text:async()=>''}};return {f,calls}}
test('store scopes reads to the owner, pages past 1000 rows and sends the service key',async()=>{
 const full=Array.from({length:1000},(_,i)=>({data:{id:'a'+i}}));const {f,calls}=fake([full,[{data:{id:'last'}}]]);
 const s=createStore({url:'https://x.supabase.co/',key:'k'},'own er',f);const rows=await s.all('lead');
 assert.equal(rows.length,1001);assert.match(calls[0].url,/owner=eq\.own%20er&kind=eq\.lead.*offset=0/);assert.match(calls[1].url,/offset=1000/);
 assert.equal(calls[0].init.headers.apikey,'k');assert.equal(calls[0].init.headers.Authorization,'Bearer k')});
test('writes go through the put_record function with owner and kind',async()=>{
 const {f,calls}=fake([{id:'1',name:'A'}]);const s=createStore({url:'https://x.supabase.co',key:'k'},'o',f);
 assert.equal((await s.put('lead',{id:'1',name:'A'})).name,'A');
 assert.match(calls[0].url,/\/rest\/v1\/rpc\/put_record$/);assert.deepEqual(JSON.parse(calls[0].init.body),{p_owner:'o',p_id:'1',p_kind:'lead',p_data:{id:'1',name:'A'}})});
test('database errors surface instead of being swallowed',async()=>{
 const s=createStore({url:'https://x.co',key:'k'},'o',async()=>({ok:false,status:401,text:async()=>'bad key'}));await assert.rejects(()=>s.all('lead'),/Database error 401/)});
test('sessions verify, expire, reject tampering and need a strong secret',async()=>{
 const secret='x'.repeat(40);const t=await makeSession(secret);assert.equal(await checkSession(t,secret),true);
 assert.equal(await checkSession(t,'y'.repeat(40)),false);assert.equal(await checkSession(t.replace(/.$/,c=>c==='a'?'b':'a'),secret),false);
 assert.equal(await checkSession('1.abc',secret),false);assert.equal(await checkSession(t,'short'),false);await assert.rejects(()=>makeSession('short'));
 assert.equal(await passwordOk('correct horse battery','correct horse battery'),true);assert.equal(await passwordOk('nope','correct horse battery'),false);assert.equal(await passwordOk('short','short'),false)});
