import Link from "next/link";

export function ResetPasswordForm(){
  return <div className="stack"><p className="status-line">로컬 서버에서는 이메일 재설정 링크를 보내지 않습니다. 관리자에게 계정 재초대 링크를 요청하세요.</p><Link className="button button--primary" href="/teacher/login">로그인으로 돌아가기</Link></div>;
}
