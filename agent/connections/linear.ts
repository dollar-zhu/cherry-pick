import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description: "Linear workspace: issues, projects, cycles, and comments.",
  auth: {
    credentialOwner: "app",
    getToken: async () => ({ token: process.env.LINEAR_API_KEY! }),
  },
});
