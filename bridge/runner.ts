import type { BridgeAdapter, BridgeJob, BridgeOutcome } from "./types";
import type { BridgeConfig } from "./config";
import { ApiClient } from "./api-client";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class BridgeRunner {
  private stopping = false;
  constructor(private readonly config: BridgeConfig, private readonly api: ApiClient, private readonly adapter: BridgeAdapter) {}
  stop() { this.stopping = true; }
  async run() {
    let lastHeartbeat = 0; let lastCatalog = 0; let failures = 0;
    while (!this.stopping) {
      try {
        const health = await this.adapter.health();
        if (health.sourceScope !== this.config.sourceScope) throw new Error("중계와 SQL source scope가 다릅니다.");
        if (Date.now() - lastHeartbeat >= 10_000) { await this.api.heartbeat({ sqlReady: health.sqlReady, penalty: health.penalty, cancellation: health.cancellation, version: "0.1.0" }); lastHeartbeat = Date.now(); }
        if (Date.now() - lastCatalog >= 24 * 60 * 60_000) { await this.api.publishCatalog(await this.adapter.listCatalog()); lastCatalog = Date.now(); }
        const { data: job } = await this.api.claim(); failures = 0;
        if (!job) { await wait(this.config.pollIdleMs); continue; }
        await this.execute(job);
      } catch (error) {
        failures += 1; console.error(JSON.stringify({ event: "bridge_cycle_failed", code: error instanceof Error ? error.message : "UNKNOWN", failures }));
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(failures, 5)) + Math.round(Math.random() * 700); await wait(delay);
      }
    }
    await this.adapter.close();
  }
  private async execute(job: BridgeJob) {
    const receipt = await this.adapter.lookupReceipt(job.requestId);
    if (receipt) { await this.api.reconcile(job, { outcome: "succeeded", result: receipt.result }); return; }
    const authorization = await this.api.authorize(job);
    if (!authorization.data.authorized) return;
    const outcome: BridgeOutcome = job.operation === "penalty" ? await this.adapter.applyPenalty(job) : await this.adapter.cancelPenalty(job);
    try { await this.api.report(job, outcome); } catch { const recovered = await this.adapter.lookupReceipt(job.requestId); if (recovered) await this.api.reconcile(job, { outcome: "succeeded", result: recovered.result }); else throw new Error("결과 보고 실패 후 영수증을 찾지 못했습니다."); }
  }
}
