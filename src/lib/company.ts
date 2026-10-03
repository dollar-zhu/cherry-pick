import { z } from "zod";

// These fields map to the existing public.profiles table. `topics` is the
// backend's persisted equivalent of company tags.
export const CompanyProfile = z.object({
  name: z.string().trim().min(1, "Enter your company name.").max(120),
  description: z.string().trim().min(1, "Add a short company description.").max(2000),
  website_url: z.string().url("Enter a valid website URL.").max(2048).nullable(),
  city: z.string().trim().min(1, "Enter your city.").max(120),
  audience: z.string().trim().min(1, "Describe your audience.").max(500),
  topics: z.array(z.string().trim().min(1).max(40)).max(20),
});

export type CompanyProfile = z.infer<typeof CompanyProfile>;

export function readCompanyForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const website = text("website_url");

  return {
    name: text("name"),
    description: text("description"),
    website_url: website
      ? (/^https?:\/\//i.test(website) ? website : `https://${website}`)
      : null,
    city: text("city"),
    audience: text("audience"),
    topics: text("topics").split(",").map((topic) => topic.trim()).filter(Boolean),
  };
}
