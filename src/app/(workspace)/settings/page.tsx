import type { Metadata } from "next";
import { SWRConfig } from "swr";
import { SettingsView } from "@/components/settings/settings-view";
import { getSettings } from "@/server/workspace";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <SWRConfig value={{ fallback: { "/api/settings": settings } }}>
      <SettingsView />
    </SWRConfig>
  );
}
