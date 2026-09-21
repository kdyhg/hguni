"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function RecoveryForm() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); await fetch("/api/teacher/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); setMessage("등록된 계정이라면 비밀번호 재설정 안내를 보냈습니다."); setBusy(false); }
  return <form className="stack" onSubmit={submit}><div className="field"><label htmlFor="recovery-email">이메일</label><input id="recovery-email" className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><Button tone="primary" disabled={busy}>{busy ? "요청 중…" : "재설정 안내 받기"}</Button><p className="status-line" role="status">{message}</p></form>;
}
