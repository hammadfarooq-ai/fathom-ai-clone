import { VideoOff } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export default function MeetingNotFound() {
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={<VideoOff />}
        title="Meeting not found"
        description="This meeting may have been deleted, or the link is incorrect. Check with the person who shared it."
        action={
          <Link href="/meetings" className={buttonClass("primary")}>
            Back to meetings
          </Link>
        }
      />
    </Card>
  );
}
