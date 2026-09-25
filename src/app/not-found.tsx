import Link from "next/link";
import { Logo } from "@/components/shell/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 font-display text-[40px] leading-tight text-ink">Nothing on the record here</h1>
      <p className="mt-2 text-[14px] text-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 text-[14px] font-medium text-ink underline underline-offset-4">
        Back to today
      </Link>
    </main>
  );
}
