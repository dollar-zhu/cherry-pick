import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Cherry Pick</h1>
      <Link
        href="/events/new"
        className="self-start rounded-full bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black"
      >
        Plan an event
      </Link>
    </main>
  );
}
