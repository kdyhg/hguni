import { assertSameOrigin } from "@/lib/server/csrf";
import { isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";
import { adminClient } from "@/lib/server/supabase";
import { requireTeacher } from "@/lib/server/teacher-auth";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{assertSameOrigin(request);const actor=await requireTeacher("admin");const{id}=await context.params;if(!isMockMode()){const client=adminClient();const{error}=await client.from("teacher_invitations").update({status:"revoked"}).eq("id",id).eq("status","pending");if(error)throw error;await client.from("audit_events").insert({actor_type:"teacher",actor_id:actor.id,action:"invitation.revoked",target_id:id});}return ok({revoked:true});}catch(error){return error instanceof Error&&error.message.includes("TEACHER_UNAUTHORIZED")?fail("FORBIDDEN","관리자 권한이 필요합니다.",403):routeError(error);}}
