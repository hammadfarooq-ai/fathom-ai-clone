import { Scissors } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export default function ClipNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <Logo />
      <Card className="w-full max-w-md">
        <EmptyState
          icon={<Scissors />}
          title="This clip isn't available"
          description="The link may be incomplete, or the clip was removed by the person who shared it."
          action={
            <Link href="/" className={buttonClass("primary")}>
              Go to Parley
            </Link>
          }
        />
      </Card>
    </div>
  );
}
