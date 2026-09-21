import Link from "next/link";
import { OpticalSurface } from "@/components/ui/OpticalSurface";
import { InviteCompletion } from "@/components/teacher/InviteCompletion";

export default async function AcceptInvitePage({searchParams}:{searchParams:Promise<{invitation?:string}>}){const{invitation}=await searchParams;return <main className="page-shell"><OpticalSurface className="screen" style={{minHeight:600}}><div className="center-stage"><section className="narrow stack"><div><p className="eyebrow">교사 초대</p><h1>계정 만들기</h1><p className="supporting">초대받은 이메일의 검증된 세션에서 비밀번호를 설정합니다.</p></div>{invitation?<InviteCompletion invitationId={invitation}/>:<p className="status-line status-line--error">초대 식별값이 없습니다. 최신 초대 메일을 다시 열어 주세요.</p>}<Link className="text-link" href="/teacher/login">로그인으로 이동</Link></section></div></OpticalSurface></main>;}
