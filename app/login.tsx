'use client';
import {useState} from 'react';
export default function Login(){
 const [u,setU]=useState('admin'),[p,setP]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 async function go(e:React.FormEvent){e.preventDefault();setBusy(true);setErr('');
  const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
  if(r.ok)location.reload();else{setErr((await r.json().catch(()=>({}))).error||'Login failed.');setBusy(false)}}
 const f={display:'block',width:'100%',padding:'14px',margin:'8px 0',border:'1px solid #d9d3c6',background:'#fffdf7',font:'16px sans-serif',boxSizing:'border-box'} as const;
 return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:'#f4f0e5',color:'#11110f',padding:24}}>
  <form onSubmit={go} style={{width:'100%',maxWidth:360}}>
   <img src="/logo-wordmark.png" alt="LeadsNoble" width={240} style={{height:"auto",maxWidth:"100%",display:"block",marginBottom:8}}/>
   <input style={f} value={u} onChange={e=>setU(e.target.value)} autoComplete="username" aria-label="Username"/>
   <input style={f} type="password" value={p} onChange={e=>setP(e.target.value)} autoComplete="current-password" placeholder="Password" aria-label="Password" autoFocus/>
   {err&&<p role="alert" style={{color:'#b3261e'}}>{err}</p>}
   <button disabled={busy||!p} style={{...f,background:'#11110f',color:'#f4f0e5',border:0,cursor:'pointer'}}>{busy?'Signing in…':'Sign in'}</button>
  </form></main>}
