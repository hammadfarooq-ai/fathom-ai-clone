"use client";

import { Button } from "@/components/ui/primitives";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-6 pt-24 text-center">
      <h1 className="font-display text-[36px] leading-tight text-ink">Something went wrong</h1>
      <p className="mt-2 text-[14px] text-muted">
        {error.message.includes("DATABASE_URL") ? "The database isn't configured. Set DATABASE_URL and run npm run db:setup." : "The page couldn't load its data. Try again in a moment."}
      </p>
      <Button className="mt-6" variant="primary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
