"use client";

import { useCallback, useEffect, useState } from "react";
import type { PenaltyRecord } from "@/lib/domain/contracts";
import { stateLabel } from "@/lib/domain/request-state";
import { Button } from "@/components/ui/Button";

export function TeacherDashboard() {
  const [records, setRecords] = useState<PenaltyRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/teacher/history", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "내역을 불러오지 못했습니다."); setRecords(body.data); }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load().catch((value) => setError(value.message)), 0); const timer = window.setInterval(() => void load().catch(() => undefined), 5000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  async function decide(record: PenaltyRecord, action: "approve" | "reject") {
    setBusy(`${record.requestId}:${action}`); setError("");
    const reason = action === "approve" ? "교사 승인" : "취소 요청을 확인했으나 거절함";
    try {
      const response = await fetch(`/api/teacher/cancellations/${record.requestId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "처리하지 못했습니다."); await load();
    } catch (value) { setError(value instanceof Error ? value.message : "처리하지 못했습니다."); }
    finally { setBusy(""); }
  }
  const pending = records.filter((record) => record.state === "cancel_requested").length;
  return <div className="stack"><div className="summary-bar"><div><h1>오늘 내역</h1><p className="supporting">학생회 입력 결과와 취소 요청을 실시간으로 확인합니다.</p></div><span className={`badge ${pending ? "badge--danger" : "badge--success"}`}>{pending ? `취소 요청 ${pending}건` : "대기 요청 없음"}</span></div><div className="status-line status-line--error" role="alert">{error}</div><section className="history-list" aria-label="오늘 입력 내역">{records.length ? records.map((record) => <article className="history-row" key={record.requestId}><div><div className="history-title">{record.student.name} · {record.item.label}</div><div className="small muted">{record.student.grade}학년 {record.student.classLabel}반 {record.student.number}번 · 담당 {record.roster.join(", ")}</div><div className="small muted">{new Date(record.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</div></div><div className="stack stack--tight" style={{ justifyItems: "end" }}><span className={`badge ${record.state === "succeeded" || record.state === "cancel_succeeded" ? "badge--success" : record.state === "cancel_requested" ? "badge--danger" : ""}`}>{stateLabel[record.state]}</span>{record.state === "cancel_requested" && <div className="row"><Button type="button" disabled={Boolean(busy)} onClick={() => void decide(record, "reject")}>거절</Button><Button tone="danger" type="button" disabled={Boolean(busy)} onClick={() => void decide(record, "approve")}>취소 승인</Button></div>}</div></article>) : <p className="supporting" style={{ paddingTop: 24 }}>아직 입력 내역이 없습니다.</p>}</section></div>;
}
