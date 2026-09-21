import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";
import { acceptLocalInvitation } from "@/lib/server/local-accounts";

const schema = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(200) }).strict();
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input=await parseJson(request,schema);
    if(!isMockMode())await acceptLocalInvitation(input.token,input.password);
    return ok({accepted:true});
  } catch(error) {
    if(error instanceof Error&&error.message.includes("INVITATION_INVALID"))return fail("INVITATION_INVALID","초대가 만료되었거나 철회되었습니다.",409);
    return routeError(error);
  }
}
