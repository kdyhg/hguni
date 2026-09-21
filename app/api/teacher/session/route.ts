import { currentTeacher } from "@/lib/server/teacher-auth";
import { fail, ok, routeError } from "@/lib/server/http";

export async function GET() {
  try {
    const teacher = await currentTeacher();
    return teacher ? ok(teacher) : fail("TEACHER_UNAUTHORIZED", "교사 로그인이 필요합니다.", 401);
  } catch (error) { return routeError(error); }
}
