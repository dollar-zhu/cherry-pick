import { mcpHandler } from "@/lib/mcp/handler";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

async function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handle(request: Request) {
  return withCors(await mcpHandler(request));
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export { handle as GET, handle as POST, handle as DELETE };
