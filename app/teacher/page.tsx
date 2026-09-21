import { redirect } from "next/navigation";
import { OpticalSurface } from "@/components/ui/OpticalSurface";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { TeacherDashboard } from "@/components/teacher/TeacherDashboard";
import { currentTeacher } from "@/lib/server/teacher-auth";

export default async function TeacherPage() {
  if (!(await currentTeacher())) redirect("/teacher/login");
  return <main className="page-shell"><OpticalSurface className="screen screen--teacher"><TeacherNav /><TeacherDashboard /></OpticalSurface></main>;
}
