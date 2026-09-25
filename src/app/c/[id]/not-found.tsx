import Link from "next/link";
import { Logo } from "@/components/shell/logo";

export default function ClipNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 font-display text-[36px] leading-tight text-ink">This clip isn&apos;t available</h1>
      <p className="mt-2 text-[14px] text-muted">The person who shared it may have deleted it, or the link is incomplete.</p>
      <Link href="/" className="mt-6 text-[14px] font-medium text-ink underline underline-offset-4">
        Go to Parley
      </Link>
    </main>
  );
}
