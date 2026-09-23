import type { Person } from "@/types";

export const CURRENT_USER_ID = "hammad";
export const COMPANY = "Northstack";

const list: Person[] = [
  // Northstack (internal)
  { id: "hammad", name: "Hammad Farooq", email: "hammad@northstack.io", role: "Head of Product", company: COMPANY, color: "#0f766e", external: false },
  { id: "sarah", name: "Sarah Chen", email: "sarah@northstack.io", role: "Head of Growth & Pricing", company: COMPANY, color: "#7c3aed", external: false },
  { id: "marcus", name: "Marcus Johnson", email: "marcus@northstack.io", role: "Engineering Manager", company: COMPANY, color: "#2563eb", external: false },
  { id: "priya", name: "Priya Raman", email: "priya@northstack.io", role: "Staff Engineer, Identity", company: COMPANY, color: "#db2777", external: false },
  { id: "diego", name: "Diego Alvarez", email: "diego@northstack.io", role: "Enterprise Account Executive", company: COMPANY, color: "#ea580c", external: false },
  { id: "emily", name: "Emily Novak", email: "emily@northstack.io", role: "Customer Success Lead", company: COMPANY, color: "#059669", external: false },
  { id: "tom", name: "Tom Becker", email: "tom@northstack.io", role: "Marketing Lead", company: COMPANY, color: "#ca8a04", external: false },
  { id: "aisha", name: "Aisha Bello", email: "aisha@northstack.io", role: "Senior Product Designer", company: COMPANY, color: "#9333ea", external: false },
  { id: "olivia", name: "Olivia Grant", email: "olivia@northstack.io", role: "CEO & Co-founder", company: COMPANY, color: "#0891b2", external: false },
  { id: "ben", name: "Ben Carter", email: "ben@northstack.io", role: "Software Engineer, Platform", company: COMPANY, color: "#4f46e5", external: false },

  // External
  { id: "jordan", name: "Jordan Mills", email: "jordan.mills@acmecorp.com", role: "Director of Operations", company: "Acme Corp", color: "#b45309", external: true },
  { id: "lena", name: "Lena Fischer", email: "lena.fischer@acmecorp.com", role: "IT Security Manager", company: "Acme Corp", color: "#be123c", external: true },
  { id: "rachel", name: "Rachel Kim", email: "rkim@brightlinehealth.com", role: "Head of Data", company: "Brightline Health", color: "#0d9488", external: true },
  { id: "david", name: "David Okafor", email: "david@foundry.vc", role: "Partner", company: "Foundry Ventures", color: "#475569", external: true },
  { id: "sam", name: "Sam Patel", email: "sam.patel@helixlogistics.com", role: "Platform Lead", company: "Helix Logistics", color: "#16a34a", external: true },
  { id: "grace", name: "Grace Liu", email: "grace.liu@helixlogistics.com", role: "Systems Administrator", company: "Helix Logistics", color: "#c026d3", external: true },
  { id: "nina", name: "Nina Kowalski", email: "nina.kowalski@gmail.com", role: "Candidate, Senior Frontend Engineer", company: "Candidate", color: "#e11d48", external: true },
  { id: "kofi", name: "Kofi Mensah", email: "kofi@stackline.dev", role: "Head of Partnerships", company: "Stackline", color: "#0284c7", external: true },
  { id: "maya", name: "Maya Torres", email: "maya@orbitlabs.co", role: "VP Operations", company: "Orbit Labs", color: "#65a30d", external: true },
];

export const people: Record<string, Person> = Object.fromEntries(list.map((p) => [p.id, p]));

export function getPerson(id: string): Person {
  return (
    people[id] ?? {
      id,
      name: id,
      email: "",
      role: "",
      company: "",
      color: "#78716c",
      external: true,
    }
  );
}

export function firstName(id: string): string {
  return getPerson(id).name.split(" ")[0];
}
