import { store } from "@/lib/server/store";
import { fail, ok, routeError } from "@/lib/server/http";
import { requireTeacher } from "@/lib/server/teacher-auth";

export async function GET() {
  try { await requireTeacher(); return ok(await store().teacherHistory()); }
  catch (error) { return error instanceof Error && error.message.includes("TEACHER_UNAUTHORIZED") ? fail("TEACHER_UNAUTHORIZED", "교사 로그인이 필요합니다.", 401) : routeError(error); }
}
