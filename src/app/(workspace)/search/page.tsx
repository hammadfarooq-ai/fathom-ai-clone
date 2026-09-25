import type { Metadata } from "next";
import { SWRConfig } from "swr";
import { SearchView } from "@/components/search/search-view";
import { searchWorkspace } from "@/server/text-search";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const fallback = q ? { [`/api/search?q=${encodeURIComponent(q)}`]: await searchWorkspace(q) } : {};
  return (
    <SWRConfig value={{ fallback }}>
      <SearchView initialQuery={q} />
    </SWRConfig>
  );
}
