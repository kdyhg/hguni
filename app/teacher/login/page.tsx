import { redirect } from "next/navigation";
import { OpticalSurface } from "@/components/ui/OpticalSurface";
import { LoginForm } from "@/components/teacher/LoginForm";
import { currentTeacher } from "@/lib/server/teacher-auth";
import { isMockMode } from "@/lib/server/env";

export default async function TeacherLoginPage() {
  if (await currentTeacher()) redirect("/teacher");
  const mock = isMockMode();
  return <main className="page-shell"><OpticalSurface className="screen" style={{ minHeight: 620 }}><div className="center-stage"><section className="narrow stack">{mock && <div className="mock-banner">시험용 교사 계정이 입력되어 있습니다</div>}<div><p className="eyebrow">유니쿨 아침선도</p><h1>교사 로그인</h1><p className="supporting">초대받은 학교 교사 계정으로 로그인하세요.</p></div><LoginForm mock={mock} /></section></div></OpticalSurface></main>;
}
