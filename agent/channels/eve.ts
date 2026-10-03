import { createClient } from "@supabase/supabase-js";
import { type AuthFn, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

function supabaseUser(): AuthFn<Request> {
  return async (request) => {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!token || !url || !key) return null;

    const { data, error } = await createClient(url, key).auth.getClaims(token);
    if (error || !data) return null;

    const attributes: Record<string, string> = {};
    if (typeof data.claims.email === "string") attributes.email = data.claims.email;

    return {
      attributes,
      authenticator: "supabase",
      principalId: data.claims.sub,
      principalType: "user",
    };
  };
}

export default eveChannel({
  auth: [supabaseUser(), vercelOidc(), localDev()],
});
