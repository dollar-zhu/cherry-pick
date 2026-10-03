import { safeNext } from "@/lib/redirect";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextPath = safeNext(typeof params.next === "string" ? params.next : null) ?? undefined;
  return <LoginForm nextPath={nextPath} />;
}
