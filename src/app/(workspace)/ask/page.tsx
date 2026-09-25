import type { Metadata } from "next";
import { AskThread } from "@/components/ask/ask-thread";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Ask" };

const SUGGESTIONS = [
  "What did customers say about SSO?",
  "What did we decide about enterprise pricing?",
  "What is blocking the Helix rollout?",
  "Who owns the October launch work?",
  "What did Foundry Ventures push back on?",
];

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  return (
    <div className="mx-auto flex h-[calc(100dvh-56px-6rem)] max-w-3xl flex-col px-4 pt-8 sm:px-6 sm:pt-12 md:h-[calc(100dvh-56px-2.5rem)]">
      <header className="border-b border-ink pb-5">
        <Eyebrow>Ask</Eyebrow>
        <h1 className="mt-2 font-display text-[40px] leading-[1.02] tracking-tight text-ink sm:text-[52px]">What do you need to know?</h1>
        <p className="mt-2 text-[14px] text-muted">Questions run across every meeting. Answers quote the transcript, so you can check them.</p>
      </header>
      <div className="min-h-0 flex-1 pt-6">
        <AskThread key={q ?? ""} suggestions={SUGGESTIONS} initialQuestion={q} />
      </div>
    </div>
  );
}
