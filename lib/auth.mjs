// Single-owner password login with an HMAC-signed, expiring cookie. Fails closed without secrets.
const enc=new TextEncoder();
async function hmac(msg,secret){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Buffer.from(await crypto.subtle.sign('HMAC',k,enc.encode(msg))).toString('base64url')}
export function safeEqual(a,b){a=String(a);b=String(b);let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0}
export async function passwordOk(input,real){if(!real||real.length<12)return false;const [a,b]=await Promise.all([hmac(String(input),'pw'),hmac(real,'pw')]);return safeEqual(a,b)}
export async function makeSession(secret,days=30){if(!secret||secret.length<32)throw Error('SESSION_SECRET must be at least 32 characters.');const exp=String(Date.now()+days*864e5);return exp+'.'+await hmac(exp,secret)}
export async function checkSession(token,secret){if(!token||!secret||secret.length<32)return false;const [exp,sig]=String(token).split('.');if(!(Number(exp)>Date.now()))return false;return safeEqual(sig||'',await hmac(exp,secret))}
export const COOKIE='nl_session';
