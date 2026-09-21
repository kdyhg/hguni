import { createHash } from "node:crypto";
import { isMockMode, env } from "./env";
import { adminClient } from "./supabase";

export type BridgeIdentity = { id: string; scope: string };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function requireBridge(request: Request): Promise<BridgeIdentity> {
  const authorization = request.headers.get("authorization");
  const scope = request.headers.get("x-hguni-scope");
  if (!authorization?.startsWith("Bearer ") || !scope) throw new Error("BRIDGE_UNAUTHORIZED");
  const token = authorization.slice(7);
  if (isMockMode()) {
    if (token !== (process.env.MOCK_BRIDGE_TOKEN ?? "mock-bridge-token-for-development") || scope !== env().SOURCE_SCOPE) throw new Error("BRIDGE_UNAUTHORIZED");
    return { id: "00000000-0000-4000-8000-000000000001", scope };
  }
  const { data, error } = await adminClient().from("bridge_instances").select("id,scope,enabled").eq("token_hash", hash(token)).single();
  if (error || !data?.enabled || data.scope !== scope || data.scope !== env().SOURCE_SCOPE) throw new Error("BRIDGE_UNAUTHORIZED");
  return { id: data.id, scope: data.scope };
}
