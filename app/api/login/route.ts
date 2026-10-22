// @ts-nocheck
import {passwordOk,makeSession,safeEqual,COOKIE} from '../../../lib/auth.mjs';
export const dynamic='force-dynamic';
const fails=new Map();
const cookie=(v,age)=>`${COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function POST(req){
 try{
  const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'Cross-origin request rejected.'},{status:403});
  const ip=(req.headers.get('x-forwarded-for')||'local').split(',')[0].trim();const f=fails.get(ip)||{n:0,t:Date.now()};
  if(Date.now()-f.t>600000){f.n=0;f.t=Date.now()}
  if(f.n>=8)return Response.json({error:'Too many attempts. Wait 10 minutes.'},{status:429});
  const b=await req.json();const real=process.env.ADMIN_PASSWORD;
  if(!real||real.length<12||!process.env.SESSION_SECRET)return Response.json({error:'Server login is not configured.'},{status:500});
  const user=process.env.ADMIN_USERNAME||'admin';
  const ok=safeEqual(String(b.username||user),user)&&await passwordOk(b.password,real);
  if(!ok){f.n++;fails.set(ip,f);await new Promise(r=>setTimeout(r,500));return Response.json({error:'Wrong username or password.'},{status:401})}
  fails.delete(ip);
  return Response.json({ok:true},{headers:{'Set-Cookie':cookie(await makeSession(process.env.SESSION_SECRET),2592000),'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:'Login failed.'},{status:400})}
}
export async function DELETE(){return Response.json({ok:true},{headers:{'Set-Cookie':cookie('',0)}})}
