import { Compass } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <Logo />
      <Card className="w-full max-w-md">
        <EmptyState
          icon={<Compass />}
          title="Page not found"
          description="The page you're looking for doesn't exist or has moved."
          action={
            <Link href="/" className={buttonClass("primary")}>
              Back to overview
            </Link>
          }
        />
      </Card>
    </div>
  );
}
