"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function InviteCompletion({ token }: { token: string }) {
  const [password,setPassword]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function complete(event:React.FormEvent){
    event.preventDefault();setBusy(true);setMessage("");
    try{
      if(password!==confirmation)throw new Error("비밀번호 확인이 일치하지 않습니다.");
      const response=await fetch("/api/teacher/invitations/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,password})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error?.message??"초대를 완료하지 못했습니다.");
      setMessage("교사 계정이 준비되었습니다. 로그인 화면에서 로그인하세요.");
    }catch(value){setMessage(value instanceof Error?value.message:"초대를 완료하지 못했습니다.");}
    finally{setBusy(false);}
  }
  return <form className="stack" onSubmit={complete}><div className="field"><label htmlFor="invite-password">새 비밀번호</label><input id="invite-password" className="input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event)=>setPassword(event.target.value)} /></div><div className="field"><label htmlFor="invite-confirm">비밀번호 확인</label><input id="invite-confirm" className="input" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} /></div><Button tone="primary" disabled={busy}>{busy?"계정 준비 중…":"교사 계정 만들기"}</Button><p className="status-line" role="status">{message}</p></form>;
}
