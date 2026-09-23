"use client";

import { useCallback, useRef, useState } from "react";
import type { AskAnswer } from "@/types";

export interface AskTurn {
  id: number;
  question: string;
  status: "loading" | "done";
  answer?: AskAnswer;
}

/**
 * Sends a question to /api/ask. If the request fails for any reason the
 * provided local function computes the answer in the browser instead.
 */
export function useAsk(payload: { meetingId?: string; includeIds?: string[] }, local: (q: string) => AskAnswer) {
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const nextId = useRef(1);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q) return;
      const id = nextId.current++;
      setTurns((t) => [...t, { id, question: q, status: "loading" }]);
      const started = performance.now();
      let answer: AskAnswer;
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, ...payload }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        answer = (await res.json()) as AskAnswer;
      } catch {
        answer = local(q);
      }
      // Keep a short, consistent "thinking" beat so instant answers don't flash.
      const elapsed = performance.now() - started;
      if (elapsed < 650) await new Promise((r) => setTimeout(r, 650 - elapsed));
      setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, status: "done", answer } : turn)));
    },
    [payload, local],
  );

  const reset = useCallback(() => setTurns([]), []);
  return { turns, ask, reset, busy: turns.some((t) => t.status === "loading") };
}
