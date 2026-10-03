import { defineTool } from "eve/tools";
import Exa from "exa-js";
import { z } from "zod";

export default defineTool({
  description: "Search the web with Exa. Returns titles, URLs, and relevant highlights.",
  inputSchema: z.object({
    query: z.string().min(1),
    numResults: z.number().int().min(1).max(10).default(5),
  }),
  async execute({ query, numResults }) {
    const exa = new Exa(process.env.EXA_API_KEY);
    const { results } = await exa.search(query, {
      numResults,
      contents: { highlights: true },
    });
    return results.map((result) => ({
      title: result.title,
      url: result.url,
      publishedDate: result.publishedDate,
      highlights: result.highlights,
    }));
  },
});
