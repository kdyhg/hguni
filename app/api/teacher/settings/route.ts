import { parseJson } from "@/lib/domain/validation";
import { scheduleInputSchema, settingsUpdateSchema } from "@/lib/domain/settings";
import { assertSameOrigin } from "@/lib/server/csrf";
import { fail, ok, routeError } from "@/lib/server/http";
import { requireTeacher } from "@/lib/server/teacher-auth";
import { addSchedule, getSettings, updateSettings } from "@/lib/server/settings-service";

export async function GET() {
  try { await requireTeacher("admin"); return ok(await getSettings()); }
  catch (error) { return error instanceof Error && error.message.includes("TEACHER_UNAUTHORIZED") ? fail("FORBIDDEN", "관리자 권한이 필요합니다.", 403) : routeError(error); }
}
export async function POST(request: Request) {
  try { assertSameOrigin(request); await requireTeacher("admin"); return ok(await addSchedule(await parseJson(request, scheduleInputSchema)), 201); }
  catch (error) { if (error instanceof Error && error.message.includes("SCHEDULE_OVERLAP")) return fail("SCHEDULE_OVERLAP", "다른 활동시간과 겹칩니다.", 409); return error instanceof Error && error.message.includes("TEACHER_UNAUTHORIZED") ? fail("FORBIDDEN", "관리자 권한이 필요합니다.", 403) : routeError(error); }
}
export async function PATCH(request:Request){try{assertSameOrigin(request);await requireTeacher("admin");return ok(await updateSettings(await parseJson(request,settingsUpdateSchema)));}catch(error){if(error instanceof Error&&error.message.includes("SETTINGS_CONFLICT"))return fail("SETTINGS_CONFLICT","다른 관리자가 설정을 변경했습니다. 새로고침 후 다시 시도하세요.",409);if(error instanceof Error&&error.message.includes("NOT_READY"))return fail("NOT_READY","준비 상태를 모두 완료한 뒤 운영을 활성화하세요.",409);if(error instanceof Error&&error.message.includes("TEACHER_SOURCE_INVALID"))return fail("TEACHER_SOURCE_INVALID","현재 원본 목록에서 담당교사를 확인할 수 없습니다.",409);return error instanceof Error&&error.message.includes("TEACHER_UNAUTHORIZED")?fail("FORBIDDEN","관리자 권한이 필요합니다.",403):routeError(error);}}
