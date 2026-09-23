import type { Metadata } from "next";
import { SearchView } from "@/components/search/search-view";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const mode = (Array.isArray(sp.mode) ? sp.mode[0] : sp.mode) === "ask" ? "ask" : "search";
  // Keyed so navigating to a new ?q= (e.g. from the command palette) resets the view.
  return <SearchView key={`${mode}:${q}`} initialQuery={q} initialMode={mode} />;
}
