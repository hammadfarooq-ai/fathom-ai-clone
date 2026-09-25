import type { Meeting, Person } from "@/types";

/** Stand-in for a person id that isn't in the directory (e.g. a deleted guest). */
export function unknownPerson(id: string): Person {
  return { id, name: id, email: "", role: "", company: "", color: "#8a8378", external: true };
}

/** Look up someone referenced by a meeting. Meetings carry their own people map. */
export function personOf(meeting: Pick<Meeting, "people">, id: string): Person {
  return meeting.people[id] ?? unknownPerson(id);
}

export function firstNameOf(meeting: Pick<Meeting, "people">, id: string): string {
  return personOf(meeting, id).name.split(" ")[0];
}
