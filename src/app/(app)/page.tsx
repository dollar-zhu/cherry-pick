import { Chat } from "@/components/chat";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Find an event partner</h1>
      <Chat />
    </main>
  );
}
