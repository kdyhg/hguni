import { assertSameOrigin } from "@/lib/server/csrf";
import { isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";
import { revokeLocalInvitation } from "@/lib/server/local-accounts";
import { requireTeacher } from "@/lib/server/teacher-auth";

export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request);
    const actor=await requireTeacher("admin");
    const{id}=await context.params;
    if(!isMockMode())revokeLocalInvitation(id,actor.id);
    return ok({revoked:true});
  } catch(error) {
    return error instanceof Error&&error.message.includes("TEACHER_UNAUTHORIZED")?fail("FORBIDDEN","관리자 권한이 필요합니다.",403):routeError(error);
  }
}
