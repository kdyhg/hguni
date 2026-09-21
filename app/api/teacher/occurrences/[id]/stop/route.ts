import { assertSameOrigin } from "@/lib/server/csrf";
import { fail, ok, routeError } from "@/lib/server/http";
import { audit, localDb } from "@/lib/server/local-db";
import { requireTeacher } from "@/lib/server/teacher-auth";

export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request);
    const actor=await requireTeacher();
    const{id}=await context.params;
    const db=localDb();
    db.transaction(()=>{
      const sessionIds=(db.prepare("SELECT id FROM council_sessions WHERE occurrence_key=? AND revoked_at IS NULL").all(id) as Array<{id:string}>).map((row)=>row.id);
      db.prepare("UPDATE council_sessions SET revoked_at=? WHERE occurrence_key=? AND revoked_at IS NULL").run(new Date().toISOString(),id);
      const block=db.prepare("UPDATE bridge_jobs SET state='blocked',updated_at=? WHERE penalty_request_id IN (SELECT id FROM penalty_requests WHERE session_id=?) AND state='queued'");
      for(const sessionId of sessionIds)block.run(new Date().toISOString(),sessionId);
      audit("teacher","occurrence.stopped",actor.id,id);
    })();
    return ok({stopped:true});
  } catch(error) {
    return error instanceof Error&&error.message.includes("TEACHER_UNAUTHORIZED")?fail("TEACHER_UNAUTHORIZED","교사 로그인이 필요합니다.",401):routeError(error);
  }
}
