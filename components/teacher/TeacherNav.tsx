"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function TeacherNav() {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() { await fetch("/api/teacher/logout", { method: "POST" }); router.replace("/teacher/login"); }
  return <nav className="teacher-nav" aria-label="교사 메뉴"><div><p className="eyebrow">교사 관리</p><div className="teacher-nav__links"><Link href="/teacher" aria-current={pathname === "/teacher" ? "page" : undefined}>오늘 내역</Link><Link href="/teacher/settings" aria-current={pathname === "/teacher/settings" ? "page" : undefined}>설정</Link></div></div><Button tone="quiet" type="button" onClick={() => void logout()}>로그아웃</Button></nav>;
}
