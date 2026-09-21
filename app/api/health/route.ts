import { ok } from "@/lib/server/http";

export async function GET() { return ok({ status: "ok" }); }
