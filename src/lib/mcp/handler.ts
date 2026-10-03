import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/lib/mcp/auth";
import { MCP_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { registerMcpTools } from "@/lib/mcp/tools";
import { siteUrl } from "@/lib/site";

const mcp = createMcpHandler(
  (server) => {
    registerMcpTools(server);
  },
  {
    serverInfo: { name: "cherry-pick", version: "0.1.0" },
    instructions: MCP_INSTRUCTIONS,
  },
  {
    streamableHttpEndpoint: "/api/mcp",
    disableSse: true,
    maxDuration: 60,
  },
);

export const mcpHandler = withMcpAuth(mcp, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
  resourceUrl: siteUrl(),
});
