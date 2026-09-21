import { assertSameOrigin } from "@/lib/server/csrf";
import { isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";
import { adminClient } from "@/lib/server/supabase";
import { requireTeacher } from "@/lib/server/teacher-auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireTeacher();
    const { id } = await context.params;

    if (!isMockMode()) {
      const client = adminClient();
      const now = new Date().toISOString();
      const { error } = await client
        .from("activity_occurrences")
        .update({ status: "stopped", updated_at: now })
        .eq("id", id)
        .in("status", ["scheduled", "active"]);

      if (error) throw error;

      await client
        .from("council_sessions")
        .update({ revoked_at: now })
        .eq("occurrence_id", id)
        .is("revoked_at", null);

      const { data: occurrenceRequests, error: requestsError } = await client
        .from("penalty_requests")
        .select("request_id")
        .eq("occurrence_id", id);

      if (requestsError) throw requestsError;

      const requestIds = occurrenceRequests?.map((value) => value.request_id) ?? [];
      if (requestIds.length > 0) {
        const { error: jobsError } = await client
          .from("bridge_jobs")
          .update({ state: "blocked", updated_at: now })
          .in("request_id", requestIds)
          .eq("state", "queued");

        if (jobsError) throw jobsError;
      }

      const { error: auditError } = await client.from("audit_events").insert({
        actor_type: "teacher",
        actor_id: actor.id,
        action: "occurrence.stopped",
        target_id: id,
      });

      if (auditError) throw auditError;
    }

    return ok({ stopped: true });
  } catch (error) {
    return error instanceof Error && error.message.includes("TEACHER_UNAUTHORIZED")
      ? fail("TEACHER_UNAUTHORIZED", "교사 로그인이 필요합니다.", 401)
      : routeError(error);
  }
}
