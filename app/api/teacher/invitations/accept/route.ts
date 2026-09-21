import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";
import { adminClient } from "@/lib/server/supabase";

const schema = z.object({ invitationId: z.string().uuid() }).strict();
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const { invitationId } = await parseJson(request, schema);
    if (isMockMode()) return ok({ accepted: true });
    const authorization=request.headers.get("authorization"); if(!authorization?.startsWith("Bearer "))return fail("INVITE_SESSION_REQUIRED","초대 링크를 다시 열어 주세요.",401);
    const client=adminClient(); const{data,error}=await client.auth.getUser(authorization.slice(7)); if(error||!data.user?.email)return fail("INVITE_SESSION_REQUIRED","초대 세션이 만료되었습니다.",401);
    const{error:acceptError}=await client.rpc("hguni_accept_invitation",{p_invitation_id:invitationId,p_user_id:data.user.id,p_email:data.user.email}); if(acceptError)return fail("INVITATION_INVALID","초대가 만료되었거나 철회되었습니다.",409);
    return ok({accepted:true});
  } catch(error){return routeError(error);}
}
