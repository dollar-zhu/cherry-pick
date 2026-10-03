import { cardGrid } from "@/components/event-card";

export default function InboxLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pb-24 pt-12 sm:px-6">
      <div className="flex flex-col gap-3">
        <div className="h-12 w-40 animate-pulse rounded-xl bg-paper-2" />
        <div className="h-5 w-72 max-w-full animate-pulse rounded bg-paper-2" />
      </div>
      <div className={cardGrid}>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <div className="aspect-[4/3] animate-pulse rounded-2xl bg-paper-2" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-paper-2" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-paper-2" />
          </div>
        ))}
      </div>
    </main>
  );
}
