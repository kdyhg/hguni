import type { BridgeConfig } from "./config";
import type { BridgeJob, BridgeOutcome, Catalog } from "./types";

export class ApiClient {
  constructor(private readonly config: BridgeConfig) {}
  private async request<T>(path: string, body: Record<string, unknown> = {}) {
    const response = await fetch(`${this.config.apiBaseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.bridgeToken}`, "X-Hguni-Scope": this.config.sourceScope }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    const payload = await response.json() as { data?: T; error?: { code: string; message: string }; serverTime?: string };
    if (!response.ok || payload.error) throw new Error(`${payload.error?.code ?? response.status}: ${payload.error?.message ?? "API 요청 실패"}`);
    return { data: payload.data as T, serverTime: payload.serverTime ?? new Date().toISOString() };
  }
  heartbeat(value: { sqlReady: boolean; penalty: boolean; cancellation: boolean; version: string }) { return this.request<{ bridgeId: string }>("/api/bridge/heartbeat", value); }
  publishCatalog(catalog: Catalog) { return this.request<{ version: string }>("/api/bridge/catalog", { catalog }); }
  claim() { return this.request<BridgeJob | null>("/api/bridge/jobs/claim"); }
  authorize(job: BridgeJob) { return this.request<{ authorized: boolean }>(`/api/bridge/jobs/${job.jobId}/authorize`, { leaseGeneration: job.leaseGeneration }); }
  report(job: BridgeJob, outcome: BridgeOutcome) { return this.request(`/api/bridge/jobs/${job.jobId}/report`, { leaseGeneration: job.leaseGeneration, ...outcome }); }
  reconcile(job: BridgeJob, outcome: BridgeOutcome) { return this.request(`/api/bridge/jobs/${job.jobId}/reconcile`, { leaseGeneration: job.leaseGeneration, ...outcome }); }
}
