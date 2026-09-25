import Link from "next/link";
import { Empty } from "@/components/ui/primitives";

export default function MeetingNotFound() {
  return (
    <Empty title="That meeting isn't here" className="pt-24">
      It may have been deleted, or the link is mistyped.{" "}
      <Link href="/library" className="underline">
        Back to the library
      </Link>
      .
    </Empty>
  );
}
