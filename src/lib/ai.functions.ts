import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateOutageAdvice, type OutageAdvice } from "./ai.server";

const inputSchema = z.object({
  kind: z.enum(["power", "water"]),
  area: z.string().min(1).max(60),
  note: z.string().min(5).max(500),
});

export type AdviceResult =
  | ({ ok: true } & OutageAdvice)
  | { ok: false; error: string };

export const getOutageAdvice = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<AdviceResult> => {
    try {
      const advice = await generateOutageAdvice(data);
      return { ok: true, ...advice };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      console.error("Outage advice failed:", error);
      return {
        ok: false,
        error:
          "AI advice is unavailable right now. Your report can still be shared — try again in a minute.",
      };
    }
  });
