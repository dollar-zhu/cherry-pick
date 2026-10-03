export default function InboxLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="rounded-lg h-24 animate-pulse bg-muted"
          />
        ))}
      </div>
    </main>
  );
}
