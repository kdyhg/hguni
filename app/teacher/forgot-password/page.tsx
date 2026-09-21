import Link from "next/link";
import { OpticalSurface } from "@/components/ui/OpticalSurface";
import { RecoveryForm } from "@/components/teacher/RecoveryForm";

export default function ForgotPasswordPage() { return <main className="page-shell"><OpticalSurface className="screen" style={{ minHeight: 540 }}><div className="center-stage"><section className="narrow stack"><div><p className="eyebrow">교사 계정</p><h1>비밀번호 재설정</h1><p className="supporting">계정 존재 여부와 관계없이 같은 안내를 표시합니다.</p></div><RecoveryForm /><Link className="text-link" href="/teacher/login">로그인으로 돌아가기</Link></section></div></OpticalSurface></main>; }
