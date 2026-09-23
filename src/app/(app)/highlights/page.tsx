import type { Metadata } from "next";
import { HighlightsView } from "@/components/highlights/highlights-view";

export const metadata: Metadata = { title: "Highlights" };

export default function HighlightsPage() {
  return <HighlightsView />;
}
