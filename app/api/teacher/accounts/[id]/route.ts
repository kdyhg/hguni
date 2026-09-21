import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { fail,ok,routeError } from "@/lib/server/http";
import { updateLocalTeacher } from "@/lib/server/local-accounts";
import { requireTeacher } from "@/lib/server/teacher-auth";

const schema=z.object({role:z.enum(["admin","teacher"]).optional(),enabled:z.boolean().optional()}).strict().refine(v=>v.role!==undefined||v.enabled!==undefined);
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request);
    const actor=await requireTeacher("admin");
    const{id}=await context.params;
    updateLocalTeacher(id,await parseJson(request,schema),actor.id);
    return ok({updated:true});
  } catch(error) {
    if(error instanceof Error&&error.message.includes("LAST_ADMIN_REQUIRED"))return fail("LAST_ADMIN_REQUIRED","마지막 관리자는 정지하거나 일반 교사로 변경할 수 없습니다.",409);
    return error instanceof Error&&error.message.includes("TEACHER_UNAUTHORIZED")?fail("FORBIDDEN","관리자 권한이 필요합니다.",403):routeError(error);
  }
}
