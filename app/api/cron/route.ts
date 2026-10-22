// @ts-nocheck
import {safeEqual} from '../../../lib/auth.mjs';
import {createStore} from '../../../lib/store.mjs';
import {runDaily} from '../../../lib/daily.mjs';
import {telegram} from '../../../lib/notify.mjs';
export const dynamic='force-dynamic';
export const maxDuration=60;
// Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET". Fails closed without the secret.
export async function GET(req){
 const secret=process.env.CRON_SECRET,got=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!secret||secret.length<16||!safeEqual(got,secret))return Response.json({error:'Unauthorized'},{status:401});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_KEY;if(!url||!key)return Response.json({error:'Database is not configured.'},{status:500});
 const {all,put}=createStore({url,key},process.env.OWNER_ID||'noblesoft');
 try{return Response.json(await runDaily({all,put,settings:(await all('settings'))[0]||{},notify:telegram}))}
 catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
