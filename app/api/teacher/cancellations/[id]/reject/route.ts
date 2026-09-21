import { cancellationSchema, parseJson } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { fail, ok, routeError } from "@/lib/server/http";
import { store } from "@/lib/server/store";
import { storeError } from "@/lib/server/store-error";
import { requireTeacher } from "@/lib/server/teacher-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const teacher = await requireTeacher();
    const { id } = await context.params; const { reason } = await parseJson(request, cancellationSchema);
    return ok(await store().rejectCancellation(id, reason, teacher.id));
  } catch (error) { return error instanceof Error && error.message.includes("TEACHER_UNAUTHORIZED") ? fail("TEACHER_UNAUTHORIZED", "교사 로그인이 필요합니다.", 401) : storeError(error) ?? routeError(error); }
}
