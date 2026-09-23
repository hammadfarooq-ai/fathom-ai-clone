import { seededMeetings, findMeeting } from "@/data";
import { askMeeting, askAcrossMeetings } from "@/lib/ask";
import { searchMeetings } from "@/lib/search";
import { buildSummary } from "@/lib/templates";

const q4 = findMeeting("q4-product-strategy")!;
for (const q of ["What did we decide about enterprise pricing?", "When is the enterprise launch?", "What are the biggest risks for October?", "What are the next steps?", "summarize", "What did we decide?", "who is writing the SSO spec?", "bananas"]) {
  const a = askMeeting(q4, q);
  console.log("Q:", q, "\nA:", a.answer, "\nS:", a.sources.map(s => `${s.start} ${s.label}`).join(" | "), "\n");
}
for (const m of seededMeetings) for (const q of m.suggestedQuestions) {
  const a = askMeeting(m, q);
  console.log(`[${m.id}] Q: ${q}\nA: ${a.answer}\nS: ${a.sources.map(s => s.label).join(" | ")}\n`);
}
const x = askAcrossMeetings(seededMeetings, "What did customers say about SSO?");
console.log("ACROSS:", x.answer); x.meetings!.forEach(m => console.log(" -", m.title, "|", m.insight, "|", m.excerpt.slice(0,80)));
const y = askAcrossMeetings(seededMeetings, "discount policy");
console.log("ACROSS2:", y.answer);
console.log("SEARCH pricing:", searchMeetings(seededMeetings, "pricing").map(r => `${r.meeting.id}:${r.matches.length}`).join(", "));
for (const t of ["sales","research","one-on-one","interview","product","general"] as const) {
  console.log("TEMPLATE", t, buildSummary(q4, t).map(s => `${s.title}(${s.items.length})`).join(", "));
}
