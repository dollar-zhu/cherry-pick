export default function EventLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10 font-sans">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-5 animate-pulse rounded bg-muted" />
        ))}
      </div>
      <section className="flex flex-col gap-3">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-muted" />
        ))}
      </section>
    </main>
  );
}
