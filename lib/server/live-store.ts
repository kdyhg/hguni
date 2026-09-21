import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { AppStore, PenaltyInput } from "./store";
import type { CouncilStatus, PenaltyItem, PenaltyRecord, Student } from "@/lib/domain/contracts";
import { adminClient } from "./supabase";
import { env } from "./env";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const asRecord = (value: unknown) => value as PenaltyRecord;

async function rpc<T>(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await adminClient().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const liveStore: AppStore = {
  async status(token) {
    return rpc<CouncilStatus>("hguni_council_status", { p_token_hash: token ? hash(token) : null });
  },
  async unlock(pin, clientKey) {
    const client = adminClient();
    const config = env();
    if (!config.PIN_PEPPER) throw new Error("PIN_NOT_CONFIGURED");
    const attempt = await rpc<{ allowed: boolean; retry_after: number }>("hguni_check_pin_attempt", { p_bucket_hash: hash(`${clientKey}:${config.PIN_PEPPER}`) });
    if (!attempt.allowed) throw new Error("PIN_RATE_LIMITED");
    const { data, error } = await client.from("app_settings").select("pin_hash,pin_version").eq("id", 1).single();
    if (error || !data?.pin_hash) throw new Error("PIN_NOT_CONFIGURED");
    if (!(await argon2.verify(data.pin_hash, `${pin}:${config.PIN_PEPPER}`))) {
      await rpc("hguni_record_pin_failure", { p_bucket_hash: hash(`${clientKey}:${config.PIN_PEPPER}`) });
      throw new Error("PIN_INVALID");
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = await rpc<string>("hguni_open_council_session", { p_token_hash: hash(token), p_pin_version: data.pin_version });
    return { token, expiresAt };
  },
  async setRoster(token, names) { return rpc<string[]>("hguni_set_roster", { p_token_hash: hash(token), p_names: names }); },
  async students(token, query) { return rpc<Student[]>("hguni_search_students", { p_token_hash: hash(token), p_query: query, p_limit: 20 }); },
  async items(token) { return rpc<{ version: string; items: PenaltyItem[] }>("hguni_current_items", { p_token_hash: hash(token) }); },
  async createPenalty(token, input: PenaltyInput) { return asRecord(await rpc("hguni_accept_penalty", { p_token_hash: hash(token), p_request_id: input.requestId, p_student_id: input.studentId, p_item_key: input.itemKey, p_catalog_version: input.catalogVersion })); },
  async penalty(token, requestId) { return asRecord(await rpc("hguni_penalty_status", { p_token_hash: hash(token), p_request_id: requestId })); },
  async history(token) { return rpc<PenaltyRecord[]>("hguni_council_history", { p_token_hash: hash(token) }); },
  async requestCancellation(token, requestId, reason) { return asRecord(await rpc("hguni_request_cancellation", { p_token_hash: hash(token), p_request_id: requestId, p_reason: reason })); },
  async end(token) { await rpc("hguni_end_council_session", { p_token_hash: hash(token) }); },
  async teacherHistory() { return rpc<PenaltyRecord[]>("hguni_teacher_history"); },
  async approveCancellation(requestId, reason, actorId) { return asRecord(await rpc("hguni_approve_cancellation", { p_request_id: requestId, p_reason: reason, p_actor_id: actorId })); },
  async rejectCancellation(requestId, reason, actorId) { return asRecord(await rpc("hguni_reject_cancellation", { p_request_id: requestId, p_reason: reason, p_actor_id: actorId })); },
};
