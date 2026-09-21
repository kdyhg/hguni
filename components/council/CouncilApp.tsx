"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ApiFailure, ApiSuccess, CouncilStatus, PenaltyItem, PenaltyRecord, Student } from "@/lib/domain/contracts";
import { stateLabel } from "@/lib/domain/request-state";
import { OpticalSurface } from "@/components/ui/OpticalSurface";
import { Button } from "@/components/ui/Button";

type Stage = "loading" | "locked" | "roster" | "entry";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers }, cache: "no-store" });
  const body = (await response.json()) as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "요청을 처리하지 못했습니다.");
  return body.data;
}

function pointsLabel(points: number) { return `벌점 ${Math.abs(points)}점`; }

export function CouncilApp() {
  const [stage, setStage] = useState<Stage>("loading");
  const [status, setStatus] = useState<CouncilStatus | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const next = await api<CouncilStatus>("/api/council/status");
      setStatus(next);
      setStage(!next.session.unlocked ? "locked" : next.session.roster.length ? "entry" : "roster");
      setError("");
    } catch (value) {
      setStage("locked");
      setError(value instanceof Error ? value.message : "상태를 확인하지 못했습니다.");
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadStatus(), 0); return () => window.clearTimeout(timer); }, [loadStatus]);

  const onUnlocked = () => { setStatus((value) => value ? { ...value, session: { unlocked: true, roster: [] } } : value); setStage("roster"); };
  const onRoster = (names: string[]) => { setStatus((value) => value ? { ...value, session: { unlocked: true, roster: names } } : value); setStage("entry"); };

  return (
    <OpticalSurface className="screen" aria-busy={stage === "loading"}>
      {status?.mode === "mock" && <div className="mock-banner">시험 화면 · 연동 없이 동작 · PIN 246810</div>}
      <header className="main-header">
        <div>
          <p className="eyebrow">유니쿨 학생생활</p>
          <h1>아침 선도</h1>
          <p className="supporting">{status?.activity ? `${status.activity.name} · ${status.activity.startsAt}–${status.activity.endsAt}` : "활동 정보를 확인하고 있습니다"}</p>
        </div>
        {stage === "entry" && <Button tone="quiet" onClick={() => void endSession(setStage, setStatus, setError)}>활동 종료</Button>}
      </header>

      {stage === "loading" && <div className="center-stage"><p className="supporting">활동 상태를 확인하고 있습니다…</p></div>}
      {stage === "locked" && <LockedView status={status} onUnlocked={onUnlocked} error={error} setError={setError} setMessage={setMessage} />}
      {stage === "roster" && <RosterView initial={status?.session.roster ?? []} onSaved={onRoster} setError={setError} />}
      {stage === "entry" && status && <PenaltyEntry roster={status.session.roster} onEditRoster={() => setStage("roster")} onExpired={loadStatus} setError={setError} setMessage={setMessage} />}

      <div className={`status-line ${error ? "status-line--error" : ""}`} role="status" aria-live="polite">{error || message}</div>
      {stage === "locked" && <Link className="footer-link" href="/teacher/login">교사 로그인</Link>}
    </OpticalSurface>
  );
}

function LockedView({ status, onUnlocked, error, setError, setMessage }: {
  status: CouncilStatus | null; onUnlocked: () => void; error: string; setError: (value: string) => void; setMessage: (value: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const unavailable = Boolean(status?.lockReason);
  const reason = status?.lockReason === "outside_hours" ? "지금은 활동 시간이 아닙니다."
    : status?.lockReason === "bridge_offline" ? "학교 PC 연결을 확인해 주세요."
      : status?.lockReason === "teacher_missing" ? "담당교사가 아직 연결되지 않았습니다."
        : status?.lockReason === "catalog_missing" ? "학생·항목 목록을 준비하고 있습니다." : "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      await api("/api/council/unlock", { method: "POST", body: JSON.stringify({ pin }) });
      setPin(""); setMessage("활동이 열렸습니다."); onUnlocked();
    } catch (value) { setPin(""); setError(value instanceof Error ? value.message : "활동을 열지 못했습니다."); }
    finally { setBusy(false); }
  }

  return (
    <div className="center-stage">
      <form className="narrow stack" onSubmit={submit}>
        <div>
          <h2>교사가 활동을 열어 주세요</h2>
          <p className="supporting">현재 활동에서만 사용할 6자리 PIN을 입력합니다.</p>
        </div>
        <div className="field">
          <label htmlFor="council-pin">활동 PIN</label>
          <input id="council-pin" className="input input--pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={unavailable || busy} aria-describedby={error ? "unlock-error" : undefined} />
        </div>
        {reason && <p className="status-line status-line--error">{reason}</p>}
        <Button tone="primary" type="submit" disabled={unavailable || pin.length !== 6 || busy}>{busy ? "확인 중…" : "활동 열기"}</Button>
      </form>
    </div>
  );
}

function RosterView({ initial, onSaved, setError }: { initial: string[]; onSaved: (names: string[]) => void; setError: (value: string) => void }) {
  const [names, setNames] = useState(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function add() {
    const normalized = name.trim();
    if (!normalized) return;
    if (names.includes(normalized)) { setError("이미 등록한 이름입니다."); return; }
    if (names.length >= 10) { setError("담당자는 최대 10명까지 등록할 수 있습니다."); return; }
    setNames([...names, normalized]); setName(""); setError(""); inputRef.current?.focus();
  }

  async function save() {
    setBusy(true); setError("");
    try {
      const result = await api<{ names: string[] }>("/api/council/roster", { method: "PUT", body: JSON.stringify({ names }) });
      onSaved(result.names);
    } catch (value) { setError(value instanceof Error ? value.message : "담당자를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return (
    <div className="center-stage">
      <section className="narrow stack">
        <div><h2>오늘 활동하는 학생회 이름</h2><p className="supporting">입력 내역에 함께 남습니다. 개인 계정이나 실명 인증은 아닙니다.</p></div>
        <div className="row">
          <input ref={inputRef} className="input grow" aria-label="담당자 이름" placeholder="이름 입력" maxLength={30} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
          <Button type="button" onClick={add} disabled={!name.trim()}>추가</Button>
        </div>
        <div className="roster-tags" aria-label="등록한 담당자">
          {names.map((value) => <span className="tag" key={value}>{value}<button type="button" aria-label={`${value} 삭제`} onClick={() => setNames(names.filter((nameValue) => nameValue !== value))}>×</button></span>)}
        </div>
        <Button tone="primary" type="button" onClick={() => void save()} disabled={!names.length || busy}>{busy ? "저장 중…" : "시작하기"}</Button>
      </section>
    </div>
  );
}

function PenaltyEntry({ roster, onEditRoster, onExpired, setError, setMessage }: {
  roster: string[]; onEditRoster: () => void; onExpired: () => Promise<void>; setError: (value: string) => void; setMessage: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [items, setItems] = useState<PenaltyItem[]>([]);
  const [catalogVersion, setCatalogVersion] = useState("");
  const [item, setItem] = useState<PenaltyItem | null>(null);
  const [recent, setRecent] = useState<PenaltyRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<PenaltyRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api<{ version: string; items: PenaltyItem[] }>("/api/council/items")
      .then((value) => { setItems(value.items); setCatalogVersion(value.version); })
      .catch((value) => setError(value instanceof Error ? value.message : "항목을 불러오지 못했습니다."));
  }, [setError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) { setResults([]); return; }
      void api<Student[]>(`/api/council/students?q=${encodeURIComponent(query.trim())}`)
        .then(setResults).catch((value) => setError(value instanceof Error ? value.message : "학생을 검색하지 못했습니다."));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, setError]);

  useEffect(() => {
    if (!recent || recent.state !== "queued") return;
    const timer = window.setInterval(() => {
      void api<PenaltyRecord>(`/api/council/penalties/${recent.requestId}`).then((value) => {
        setRecent(value);
        if (value.state !== "queued" && value.state !== "executing") window.clearInterval(timer);
      }).catch(() => undefined);
    }, 700);
    return () => window.clearInterval(timer);
  }, [recent]);

  async function submit() {
    if (!student || !item || !catalogVersion || busy) return;
    setBusy(true); setError(""); setMessage("");
    requestId.current ??= crypto.randomUUID();
    try {
      const record = await api<PenaltyRecord>("/api/council/penalties", { method: "POST", body: JSON.stringify({ requestId: requestId.current, studentId: student.id, itemKey: item.key, catalogVersion }) });
      setRecent(record); setStudent(null); setItem(null); setQuery(""); setResults([]); requestId.current = null;
      setMessage("접수했습니다. 원본 반영 결과를 확인하고 있습니다."); searchRef.current?.focus();
    } catch (value) {
      const text = value instanceof Error ? value.message : "접수하지 못했습니다.";
      setError(text);
      if (text.includes("세션")) await onExpired();
    } finally { setBusy(false); }
  }

  async function openHistory() {
    setHistoryOpen(true);
    try { setHistory(await api<PenaltyRecord[]>("/api/council/history")); }
    catch (value) { setError(value instanceof Error ? value.message : "내역을 불러오지 못했습니다."); }
  }

  return (
    <div className="stack" style={{ flex: 1, paddingTop: 18 }}>
      <button className="text-link" type="button" onClick={onEditRoster} style={{ justifySelf: "start" }}>담당 {roster.join(", ")} · 변경</button>
      <div className="field">
        <label htmlFor="student-search">학생 검색</label>
        <input ref={searchRef} id="student-search" className="input input--search" type="search" enterKeyHint="search" autoComplete="off" placeholder="이름 또는 학번 2자 이상" value={query} onChange={(event) => { setQuery(event.target.value); setStudent(null); }} />
      </div>
      {results.length > 0 && !student && <div className="result-list" aria-label="학생 검색 결과">{results.map((value) => <button className="result-button" type="button" key={value.id} onClick={() => { setStudent(value); setResults([]); setQuery(value.name); }}><span className="result-meta">{value.grade}학년 {value.classLabel}반 {value.number}번</span><span className="result-name">{value.name}</span></button>)}</div>}
      {query.trim().length >= 2 && results.length === 0 && !student && <p className="status-line muted">검색 결과가 없습니다.</p>}

      {student && <section className="selected-student"><span>{student.grade}학년 {student.classLabel}반 {student.number}번</span><strong>{student.name}</strong></section>}

      <section className="stack stack--tight" aria-labelledby="item-label">
        <span className="field-label" id="item-label">벌점 항목</span>
        <div className="item-grid">{items.map((value) => <button className="item-button" type="button" key={value.key} aria-pressed={item?.key === value.key} onClick={() => setItem(value)}>{value.label} · {Math.abs(value.signedPoints)}점</button>)}</div>
      </section>

      <div className="spacer" />
      {recent && <div className="recent-strip" aria-live="polite"><span className={`status-dot ${recent.state === "succeeded" ? "status-dot--success" : recent.state.includes("failed") || recent.state === "uncertain" ? "status-dot--danger" : ""}`} /><span><strong>{recent.student.name}</strong> · {recent.item.label} · {stateLabel[recent.state]}</span><button className="text-link" type="button" onClick={() => void openHistory()}>내역 보기</button></div>}
      <div className="primary-zone"><Button className="grow" style={{ width: "100%" }} tone="primary" type="button" onClick={() => void submit()} disabled={!student || !item || busy}>{busy ? "접수 중…" : item ? `${item.label} · ${pointsLabel(item.signedPoints)} 부과` : "학생과 항목을 선택하세요"}</Button></div>

      {historyOpen && <HistorySheet history={history} close={() => setHistoryOpen(false)} onChanged={async () => setHistory(await api<PenaltyRecord[]>("/api/council/history"))} setError={setError} />}
    </div>
  );
}

function HistorySheet({ history, close, onChanged, setError }: { history: PenaltyRecord[]; close: () => void; onChanged: () => Promise<void>; setError: (value: string) => void }) {
  const [selected, setSelected] = useState<PenaltyRecord | null>(null);
  const [reason, setReason] = useState("");
  async function cancel() {
    if (!selected) return;
    try {
      await api(`/api/council/penalties/${selected.requestId}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
      setSelected(null); setReason(""); await onChanged();
    } catch (value) { setError(value instanceof Error ? value.message : "취소를 요청하지 못했습니다."); }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="sheet stack" role="dialog" aria-modal="true" aria-labelledby="history-title"><div className="row row--between"><h2 id="history-title">이번 활동 내역</h2><Button tone="quiet" type="button" onClick={close}>닫기</Button></div><div className="history-list">{history.length ? history.map((record) => <article className="history-row" key={record.requestId}><div><div className="history-title">{record.student.name} · {record.item.label}</div><div className="small muted">{record.student.grade}학년 {record.student.classLabel}반 {record.student.number}번 · {stateLabel[record.state]}</div></div>{record.state === "succeeded" && <Button type="button" onClick={() => setSelected(record)}>상세</Button>}</article>) : <p className="supporting">아직 입력 내역이 없습니다.</p>}</div>{selected && <div className="stack"><div><h3>{selected.student.name} · {selected.item.label}</h3><p className="supporting">교사가 승인하고 원본 취소를 확인해야 완료됩니다.</p></div><textarea className="input" aria-label="취소 요청 이유" placeholder="취소 이유를 입력하세요" value={reason} onChange={(event) => setReason(event.target.value)} /><div className="row"><Button tone="quiet" type="button" onClick={() => setSelected(null)}>돌아가기</Button><Button tone="danger" className="grow" type="button" disabled={reason.trim().length < 2} onClick={() => void cancel()}>교사에게 취소 요청</Button></div></div>}</section></div>;
}

async function endSession(setStage: (stage: Stage) => void, setStatus: React.Dispatch<React.SetStateAction<CouncilStatus | null>>, setError: (value: string) => void) {
  try {
    await api("/api/council/end", { method: "POST" });
    setStatus((value) => value ? { ...value, session: { unlocked: false, roster: [] } } : value);
    setStage("locked");
  } catch (value) { setError(value instanceof Error ? value.message : "활동을 종료하지 못했습니다."); }
}
