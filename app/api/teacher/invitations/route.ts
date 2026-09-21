import { parseJson } from "@/lib/domain/validation";
import { inviteSchema } from "@/lib/domain/settings";
import { assertSameOrigin } from "@/lib/server/csrf";
import { fail, ok, routeError } from "@/lib/server/http";
import { requireTeacher } from "@/lib/server/teacher-auth";
import { inviteTeacher, listInvitations } from "@/lib/server/settings-service";

export async function GET() {
  try { await requireTeacher("admin"); return ok(await listInvitations()); }
  catch (error) { return error instanceof Error && error.message.includes("TEACHER_UNAUTHORIZED") ? fail("FORBIDDEN", "관리자 권한이 필요합니다.", 403) : routeError(error); }
}
export async function POST(request: Request) {
  try { assertSameOrigin(request); const teacher = await requireTeacher("admin"); const input = await parseJson(request, inviteSchema); return ok(await inviteTeacher(input.email, input.role, teacher.id), 201); }
  catch (error) { return error instanceof Error && error.message.includes("TEACHER_UNAUTHORIZED") ? fail("FORBIDDEN", "관리자 권한이 필요합니다.", 403) : routeError(error); }
}
