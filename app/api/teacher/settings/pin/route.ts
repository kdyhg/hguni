import { parseJson } from "@/lib/domain/validation";
import { pinChangeSchema } from "@/lib/domain/settings";
import { assertSameOrigin } from "@/lib/server/csrf";
import { fail, ok, routeError } from "@/lib/server/http";
import { requireTeacher } from "@/lib/server/teacher-auth";
import { changePin } from "@/lib/server/settings-service";

export async function POST(request: Request) {
  try { assertSameOrigin(request); const teacher = await requireTeacher("admin"); const { pin } = await parseJson(request, pinChangeSchema); await changePin(pin, teacher.id); return ok({ changed: true }); }
  catch (error) { return error instanceof Error && error.message.includes("TEACHER_UNAUTHORIZED") ? fail("FORBIDDEN", "관리자 권한이 필요합니다.", 403) : routeError(error); }
}
