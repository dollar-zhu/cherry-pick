import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";
import { runTool } from "@/lib/mcp/run-tool";
import { applyToCohostTool } from "@/lib/mcp/tools/apply-to-cohost";
import { browseCohostOpportunitiesTool } from "@/lib/mcp/tools/browse-cohost-opportunities";
import { browsePostedEventsTool } from "@/lib/mcp/tools/browse-posted-events";
import { createEventIntentTool } from "@/lib/mcp/tools/create-event-intent";
import { decideCohostTool } from "@/lib/mcp/tools/decide-cohost";
import { generateFlierTool } from "@/lib/mcp/tools/generate-flier";
import { getApprovalStatusTool } from "@/lib/mcp/tools/get-approval-status";
import { getEventReadinessTool } from "@/lib/mcp/tools/get-event-readiness";
import { reviewApplicationsTool } from "@/lib/mcp/tools/review-applications";
import { saveCompanyProfileTool } from "@/lib/mcp/tools/save-company-profile";
import { whoamiTool } from "@/lib/mcp/tools/whoami";

export const MCP_TOOLS = [
  whoamiTool,
  saveCompanyProfileTool,
  createEventIntentTool,
  browsePostedEventsTool,
  applyToCohostTool,
  reviewApplicationsTool,
  decideCohostTool,
  browseCohostOpportunitiesTool,
  getEventReadinessTool,
  generateFlierTool,
  getApprovalStatusTool,
];

export const MCP_TOOL_LIST = MCP_TOOLS.map((tool) => ({
  name: tool.name,
  description: tool.description,
}));

export function registerMcpTools(server: McpServer) {
  for (const tool of MCP_TOOLS) {
    server.tool(tool.name, tool.description, tool.schema as ZodRawShape, async (args, extra) =>
      runTool(tool.name, args, extra, () => tool.run(args as never, extra)),
    );
  }
}
