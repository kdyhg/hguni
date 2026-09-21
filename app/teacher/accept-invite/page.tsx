import Link from "next/link";
import { OpticalSurface } from "@/components/ui/OpticalSurface";
import { InviteCompletion } from "@/components/teacher/InviteCompletion";

export default async function AcceptInvitePage({searchParams}:{searchParams:Promise<{token?:string}>}){const{token}=await searchParams;return <main className="page-shell"><OpticalSurface className="screen" style={{minHeight:600}}><div className="center-stage"><section className="narrow stack"><div><p className="eyebrow">교사 초대</p><h1>계정 만들기</h1><p className="supporting">관리자가 전달한 일회용 링크에서 비밀번호를 설정합니다.</p></div>{token?<InviteCompletion token={token}/>:<p className="status-line status-line--error">초대 토큰이 없습니다. 관리자에게 최신 초대 링크를 요청하세요.</p>}<Link className="text-link" href="/teacher/login">로그인으로 이동</Link></section></div></OpticalSurface></main>;}
