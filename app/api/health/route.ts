// @ts-nocheck
import {isAuthed} from '../../session';
import {discover} from '../../../lib/discover.mjs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request){
 const h={'Cache-Control':'no-store'},result={database:'unavailable',discovery:'not checked'};
 try{const r=await fetch(process.env.SUPABASE_URL+'/rest/v1/records?select=id&limit=1',{headers:{apikey:process.env.SUPABASE_SERVICE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_KEY},signal:AbortSignal.timeout(8000)});if(!r.ok)throw 0;result.database='ready'}catch{return Response.json(result,{status:503,headers:h})}
 if(new URL(request.url).searchParams.get('check')==='discovery'){
  if(!(await isAuthed()))return Response.json({error:'Sign in first.'},{status:401,headers:h});
  try{const s=await discover({category:'Dentists',city:'Karachi',country:'PK',lat:24.86,lon:67.01,radius:3,limit:3});result.discovery='ready';result.sampleCount=s.leads.length}catch(e){result.discovery=e.message;return Response.json(result,{status:503,headers:h})}
 }
 return Response.json(result,{headers:h});
}
