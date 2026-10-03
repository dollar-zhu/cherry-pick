import Link from "next/link";
import { buttonDark, pageTitle } from "@/components/styles";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-4 px-4 py-24 sm:px-6">
      <h1 className={pageTitle}>Page not found</h1>
      <p className="text-ink-2">This page does not exist, or you do not have access to it.</p>
      <Link href="/" className={`${buttonDark} mt-2`}>
        Back to your events
      </Link>
    </main>
  );
}
