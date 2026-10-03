import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { siteUrl, supabaseAuthIssuer } from "@/lib/site";

const issuer = supabaseAuthIssuer();

const resource = protectedResourceHandler({
  authServerUrls: issuer ? [issuer] : [],
  resourceUrl: `${siteUrl()}/api/mcp`,
});

export function GET(request: Request) {
  if (!issuer) {
    return Response.json({ error: "Supabase is not configured." }, { status: 500 });
  }
  return resource(request);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
