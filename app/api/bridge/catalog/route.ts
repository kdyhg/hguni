import { createHash } from "node:crypto";
import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { requireBridge } from "@/lib/server/bridge-auth";
import { adminClient } from "@/lib/server/supabase";
import { isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";

const student = z.object({ id:z.string(),name:z.string(),grade:z.number().int(),classLabel:z.string(),number:z.number().int(),sourceClass:z.string(),active:z.boolean() }).strict();
const item = z.object({ key:z.string(),kind:z.literal("D"),code:z.string(),label:z.string(),signedPoints:z.number(),enabled:z.boolean() }).strict();
const teacher = z.object({ id:z.string(),name:z.string(),active:z.boolean() }).strict();
const schema = z.object({ catalog:z.object({ students:z.array(student).max(10000),items:z.array(item).max(1000),teachers:z.array(teacher).max(1000) }).strict() }).strict();
export async function POST(request: Request) {
  try {
    const bridge=await requireBridge(request); const {catalog}=await parseJson(request,schema); const checksum=createHash("sha256").update(JSON.stringify(catalog)).digest("hex");
    if(isMockMode()) return ok({version:`mock-${checksum.slice(0,12)}`});
    const client=adminClient(); const counts={students:catalog.students.length,items:catalog.items.length,teachers:catalog.teachers.length}; const {data:version,error}=await client.from("catalog_versions").insert({source_scope:bridge.scope,status:"uploading",counts,checksum}).select("id").single(); if(error)throw error;
    try {
      for(let offset=0;offset<catalog.students.length;offset+=500){const {error:e}=await client.from("students").insert(catalog.students.slice(offset,offset+500).map((v)=>({catalog_version:version.id,source_id:v.id,name:v.name,grade:v.grade,class_label:v.classLabel,number:v.number,source_class:v.sourceClass,active:v.active})));if(e)throw e;}
      const {error:itemError}=await client.from("penalty_items").insert(catalog.items.map((v)=>({catalog_version:version.id,kind:v.kind,code:v.code,label:v.label,signed_points:v.signedPoints,enabled:v.enabled})));if(itemError)throw itemError;
      const {error:teacherError}=await client.from("source_teachers").insert(catalog.teachers.map((v)=>({catalog_version:version.id,source_id:v.id,name:v.name,active:v.active})));if(teacherError)throw teacherError;
      const {error:activateError}=await client.rpc("hguni_activate_catalog",{p_catalog_id:version.id});if(activateError)throw activateError;
    } catch(error) { await client.from("catalog_versions").update({status:"failed"}).eq("id",version.id); throw error; }
    return ok({version:version.id});
  } catch(error){return error instanceof Error&&error.message.includes("BRIDGE_UNAUTHORIZED")?fail("BRIDGE_UNAUTHORIZED","중계 인증 또는 실행 환경이 올바르지 않습니다.",401):routeError(error);}
}
