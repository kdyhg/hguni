import { findBridge } from "./local-bridge";

export type BridgeIdentity = { id: string; scope: string };
export async function requireBridge(request: Request): Promise<BridgeIdentity> {
  const authorization = request.headers.get("authorization");
  const scope = request.headers.get("x-hguni-scope");
  if (!authorization?.startsWith("Bearer ") || !scope) throw new Error("BRIDGE_UNAUTHORIZED");
  const token = authorization.slice(7);
  const bridge = findBridge(token, scope);
  if (!bridge) throw new Error("BRIDGE_UNAUTHORIZED");
  return { id: bridge.id, scope: bridge.scope };
}
