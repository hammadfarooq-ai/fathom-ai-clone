import { PeopleProvider } from "@/components/people";
import { Shell } from "@/components/shell/shell";
import { listPeople } from "@/server/meetings";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const people = await listPeople();
  return (
    <PeopleProvider people={people}>
      <Shell>{children}</Shell>
    </PeopleProvider>
  );
}
