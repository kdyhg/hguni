import { redirect } from "next/navigation";
import { OpticalSurface } from "@/components/ui/OpticalSurface";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { SettingsPanel } from "@/components/teacher/SettingsPanel";
import { currentTeacher } from "@/lib/server/teacher-auth";

export default async function SettingsPage() {
  const teacher = await currentTeacher(); if (!teacher) redirect("/teacher/login"); if (teacher.role !== "admin") redirect("/teacher");
  return <main className="page-shell"><OpticalSurface className="screen screen--teacher"><TeacherNav /><SettingsPanel /></OpticalSurface></main>;
}
