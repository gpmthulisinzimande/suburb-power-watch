// Server-only AI Gateway helpers for Khanya.
// Files matching *.server.* are blocked from client bundles.

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      try {
        const response = await fetch(input, { ...init, headers });
        runId = response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || runId;
        return response;
      } catch (error) {
        throw error;
      }
    },
    getRunId: () => runId,
  };
}

export type OutageAdvice = { summary: string; steps: string[] };

const INSTRUCTIONS = [
  "You are Khanya, a practical assistant that helps Johannesburg residents deal with power (load-shedding) and water outages.",
  "The resident describes an outage in their own words. Reply in EXACTLY this format, with no extra text before or after:",
  "SUMMARY: <one short sentence describing what is happening and how severe it sounds>",
  "STEPS:",
  "1. <short practical next step>",
  "2. <short practical next step>",
  "3. <short practical next step>",
  "Rules: 3 to 4 steps, each under 15 words, focused on what the resident should do right now (safety, water, appliances, neighbours, reporting). Keep it plain and local — mention Joburg services like City Power or Johannesburg Water only when relevant. Never invent official outage schedules or restoration times.",
].join("\n");

export async function generateOutageAdvice(input: {
  kind: "power" | "water";
  area: string;
  note: string;
  signal?: AbortSignal;
}): Promise<OutageAdvice> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText } = await import("ai");
  const { createLovableAiGatewayRunIdFetch } = await import("./run-id-server");

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const model = "openai/gpt-6-astra";
  const result = streamText({
    model: provider.responses(model),
    instructions: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: `Suburb: ${input.area}\nType of outage: ${input.kind === "power" ? "electricity / load-shedding" : "water"}\nWhat the resident says: ${input.note}`,
      },
    ],
    abortSignal: input.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const text = await result.text;

  const summaryMatch = text.match(/SUMMARY:\s*(.+)/i);
  const summary = (summaryMatch?.[1] ?? text.split("\n")[0] ?? "").trim();
  const steps = text
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((line) => {
      const afterSummary = summaryMatch ? text.indexOf(summaryMatch[0]) : 0;
      const idx = text.indexOf(line);
      return idx > afterSummary && line.length > 3 && !/^SUMMARY:/i.test(line);
    })
    .filter((line, i, arr) => arr.indexOf(line) === i)
    .slice(0, 4);

  if (!summary || steps.length === 0) {
    throw new Error("AI returned an unexpected response");
  }
  return { summary, steps };
}
