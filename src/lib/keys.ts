/** SWR cache keys shared by server pages (fallback data) and client hooks. */
export function meetingsKey(params: { q?: string; type?: string; scope?: string } = {}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.type) sp.set("type", params.type);
  if (params.scope && params.scope !== "all") sp.set("scope", params.scope);
  const qs = sp.toString();
  return `/api/meetings${qs ? `?${qs}` : ""}`;
}
