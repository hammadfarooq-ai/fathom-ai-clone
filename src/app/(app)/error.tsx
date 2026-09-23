"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={<TriangleAlert />}
        title="Something went wrong"
        description="We couldn't load this page. Your meetings and notes are safe — try again in a moment."
        action={
          <div className="flex gap-2">
            <Button onClick={reset}>Try again</Button>
            <Link href="/" className={buttonClass("primary")}>
              Go to overview
            </Link>
          </div>
        }
      />
    </Card>
  );
}
