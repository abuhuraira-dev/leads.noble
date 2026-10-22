// Supabase (PostgREST) store. One table `records(owner,id,kind,data jsonb)`; writes go through
// the put_record() SQL function so a suppressed lead can never be restored by a slow, stale write.
const enc=encodeURIComponent;
export function createStore(cfg,owner,fetchImpl=fetch){
 const base=String(cfg.url).replace(/\/$/,'')+'/rest/v1';
 const headers={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'};
 async function call(path,init){
  const r=await fetchImpl(base+path,{...init,headers,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Database error '+r.status+': '+(await r.text()).slice(0,200));
  return r.json();
 }
 const all=async kind=>{
  const rows=[];
  for(let offset=0;;offset+=1000){
   const page=await call(`/records?select=data&owner=eq.${enc(owner)}&kind=eq.${enc(kind)}&order=id&limit=1000&offset=${offset}`);
   rows.push(...page.map(r=>r.data));
   if(page.length<1000)break;
  }
  return rows;
 };
 const put=(kind,data)=>call('/rpc/put_record',{method:'POST',body:JSON.stringify({p_owner:owner,p_id:data.id,p_kind:kind,p_data:data})});
 const add=(kind,data)=>call('/rpc/add_record',{method:'POST',body:JSON.stringify({p_owner:owner,p_id:data.id,p_kind:kind,p_data:data})});
 return {all,put,add};
}
