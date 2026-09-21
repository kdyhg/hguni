"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function LoginForm({ mock }: { mock: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(mock ? "admin@demo.local" : "");
  const [password, setPassword] = useState(mock ? "hguni-demo" : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/teacher/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "로그인하지 못했습니다.");
      router.replace("/teacher");
    } catch (value) { setError(value instanceof Error ? value.message : "로그인하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <form className="stack" onSubmit={submit}><div className="field"><label htmlFor="email">이메일</label><input className="input" id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="field"><label htmlFor="password">비밀번호</label><input className="input" id="password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></div><div className="status-line status-line--error" role="alert">{error}</div><Button tone="primary" type="submit" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</Button><Link className="text-link" href="/teacher/forgot-password">비밀번호 재설정</Link></form>;
}
