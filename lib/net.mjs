// Network hardening for slow or IPv6-broken connections: prefer IPv4 and give each connection attempt more time
// (Node's default of 250 ms makes many home/ISP networks fail with "fetch failed").
import dns from 'node:dns';
import net from 'node:net';
try{dns.setDefaultResultOrder('ipv4first')}catch{}
try{net.setDefaultAutoSelectFamilyAttemptTimeout?.(3000)}catch{}
export const why=e=>e?.cause?.code||e?.cause?.errors?.[0]?.code||e?.cause?.message||e?.message||String(e);
