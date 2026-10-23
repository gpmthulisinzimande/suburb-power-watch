import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Zap, Droplets, Bell, MapPin, Plus, ThumbsUp, Lightbulb, Home, Users, X, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { getOutageAdvice } from "@/lib/ai.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Khanya — Load-shedding & Water Alerts for Joburg" },
      { name: "description", content: "Know before the lights or taps go off. Schedules, live community reports and alerts for your neighbourhood." },
      { property: "og:title", content: "Khanya — Power & Water Alerts" },
      { property: "og:description", content: "Community-powered load-shedding and water outage alerts for Johannesburg neighbourhoods." },
    ],
  }),
  component: Index,
});

type Kind = "power" | "water";
type Report = { id: string; kind: Kind; area: string; note: string; time: number; confirms: number; summary?: string; steps?: string[] };

const AREAS = ["Soweto", "Alexandra", "Sandton", "Randburg", "Tembisa", "Diepsloot", "Midrand", "Braamfontein"];

// Demo schedule: slot hours per area (illustrative, not official)
const SCHEDULE: Record<string, number[]> = {
  Soweto: [6, 14, 22], Alexandra: [8, 16], Sandton: [10, 18], Randburg: [4, 12, 20],
  Tembisa: [6, 18], Diepsloot: [2, 10, 18], Midrand: [12, 20], Braamfontein: [0, 8, 16],
};

const SEED: Report[] = [
  { id: "1", kind: "water", area: "Soweto", note: "No water in Orlando East since 5am", time: Date.now() - 50 * 60000, confirms: 23 },
  { id: "2", kind: "power", area: "Alexandra", note: "Transformer blew on 7th Ave", time: Date.now() - 20 * 60000, confirms: 41 },
  { id: "3", kind: "water", area: "Tembisa", note: "Low pressure, Joburg Water truck at the clinic", time: Date.now() - 2 * 3600000, confirms: 9 },
  { id: "4", kind: "power", area: "Randburg", note: "Power back on in Ferndale", time: Date.now() - 3 * 3600000, confirms: 5 },
];

const TIPS = [
  "Fill bottles and a bucket the night before a planned water cut.",
  "Switch off geysers and big appliances before power returns to avoid surges.",
  "Keep a power bank charged — Khanya alerts you 30 min before your slot.",
  "Report outages: more confirms = faster response from the municipality.",
];

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

function Index() {
  const [tab, setTab] = useState<"home" | "feed" | "tips">("home");
  const [area, setArea] = useState("Soweto");
  const [reports, setReports] = useState<Report[]>(SEED);
  const [alerts, setAlerts] = useState(true);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<string[]>([]);

  useEffect(() => {
    const s = localStorage.getItem("khanya");
    if (s) { const d = JSON.parse(s); setArea(d.area ?? "Soweto"); setReports(d.reports ?? SEED); setAlerts(d.alerts ?? true); setConfirmed(d.confirmed ?? []); }
  }, []);
  useEffect(() => { localStorage.setItem("khanya", JSON.stringify({ area, reports, alerts, confirmed })); }, [area, reports, alerts, confirmed]);

  const now = new Date();
  const hour = now.getHours();
  const slots = SCHEDULE[area] ?? [];
  const current = slots.find((s) => hour >= s && hour < s + 2);
  const next = slots.find((s) => s > hour) ?? slots[0] ?? 0;
  const hoursToNext = ((next - hour + 24) % 24) || 24;
  const areaReports = reports.filter((r) => r.area === area);
  const waterIssue = areaReports.some((r) => r.kind === "water");

  const sorted = useMemo(() => [...reports].sort((a, b) => b.time - a.time), [reports]);

  const confirm = (id: string) => {
    if (confirmed.includes(id)) return;
    setConfirmed([...confirmed, id]);
    setReports(reports.map((r) => (r.id === id ? { ...r, confirms: r.confirms + 1 } : r)));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <header className="hero-glow px-5 pb-6 pt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="glow grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Zap size={20} /></div>
              <span className="font-display text-xl font-bold">Khanya</span>
            </div>
            <button onClick={() => setAlerts(!alerts)} aria-label="Toggle alerts"
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${alerts ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              <Bell size={14} /> {alerts ? "Alerts on" : "Alerts off"}
            </button>
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={16} />
            <select value={area} onChange={(e) => setArea(e.target.value)} className="bg-transparent font-medium text-foreground outline-none">
              {AREAS.map((a) => <option key={a} className="bg-card">{a}</option>)}
            </select>
          </label>
        </header>

        <main className="flex-1 space-y-4 px-5 pb-28">
          {tab === "home" && (
            <>
              <section className={`rounded-2xl p-5 ${current !== undefined ? "bg-destructive text-destructive-foreground" : "bg-card"}`}>
                <p className="text-xs uppercase tracking-widest opacity-80">Electricity</p>
                <h1 className="mt-1 text-3xl font-bold">
                  {current !== undefined ? "Load-shedding now" : "Power is on"}
                </h1>
                <p className="mt-1 text-sm opacity-80">
                  {current !== undefined ? `Until ${String(current + 2).padStart(2, "0")}:00` : `Next slot in ${hoursToNext}h · ${String(next).padStart(2, "0")}:00–${String((next + 2) % 24).padStart(2, "0")}:00`}
                </p>
                <div className="mt-4 grid grid-cols-12 gap-0.5">
                  {Array.from({ length: 24 }).map((_, h) => {
                    const off = slots.some((s) => h >= s && h < s + 2);
                    return <div key={h} className={`h-6 rounded-sm ${h % 2 ? "" : ""} ${off ? "bg-primary" : "bg-secondary"} ${h === hour ? "ring-2 ring-foreground" : ""}`} title={`${h}:00`} />;
                  }).filter((_, i) => i < 24)}
                </div>
                <p className="mt-2 text-xs opacity-70">Today's schedule · yellow = off</p>
              </section>

              <section className="rounded-2xl bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className={`grid h-11 w-11 place-items-center rounded-xl ${waterIssue ? "bg-water text-water-foreground" : "bg-secondary text-ok"}`}><Droplets size={22} /></div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Water</p>
                    <h2 className="text-xl font-bold">{waterIssue ? "Outage reported" : "No issues reported"}</h2>
                  </div>
                </div>
                {waterIssue && <p className="mt-3 text-sm text-muted-foreground">{areaReports.find((r) => r.kind === "water")?.note}</p>}
              </section>

              <div className="grid grid-cols-2 gap-3">
                <Stat n={reports.length} label="Reports today" />
                <Stat n={reports.reduce((a, r) => a + r.confirms, 0)} label="Neighbours helping" />
              </div>
            </>
          )}

          {tab === "feed" && (
            <>
              <h2 className="text-2xl font-bold">Community reports</h2>
              {sorted.map((r) => (
                <article key={r.id} className="rounded-2xl bg-card p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className={`flex items-center gap-1 font-medium ${r.kind === "power" ? "text-primary" : "text-water"}`}>
                      {r.kind === "power" ? <Zap size={14} /> : <Droplets size={14} />} {r.area}
                    </span>
                    <span>{ago(r.time)}</span>
                  </div>
                  <p className="mt-2">{r.note}</p>
                  {r.summary && (
                    <div className="mt-3 rounded-xl bg-secondary p-3">
                      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-primary"><Sparkles size={12} /> AI summary</p>
                      <p className="mt-1 text-sm">{r.summary}</p>
                      <ul className="mt-2 space-y-1">
                        {r.steps?.map((s, i) => (
                          <li key={s} className="flex gap-2 text-xs text-muted-foreground"><span className="text-primary">{i + 1}.</span><span>{s}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button onClick={() => confirm(r.id)}
                    className={`mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${confirmed.includes(r.id) ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    <ThumbsUp size={14} /> Me too · {r.confirms}
                  </button>
                </article>
              ))}
            </>
          )}

          {tab === "tips" && (
            <>
              <h2 className="text-2xl font-bold">Be ready</h2>
              {TIPS.map((t) => (
                <div key={t} className="flex gap-3 rounded-2xl bg-card p-4">
                  <Lightbulb className="shrink-0 text-primary" size={20} /> <p className="text-sm">{t}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Schedules shown are demo data. Always confirm with Eskom / City Power and Johannesburg Water.</p>
            </>
          )}
        </main>

        <button onClick={() => setOpen(true)} aria-label="Report outage"
          className="glow fixed bottom-24 right-[max(1.25rem,calc(50vw-12.75rem))] grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground">
          <Plus size={26} />
        </button>

        <nav className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-3">
            {([["home", Home, "Status"], ["feed", Users, "Reports"], ["tips", Lightbulb, "Tips"]] as const).map(([k, Icon, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center gap-1 py-3 text-xs ${tab === k ? "text-primary" : "text-muted-foreground"}`}>
                <Icon size={20} /> {l}
              </button>
            ))}
          </div>
        </nav>

        {open && <ReportSheet area={area} onClose={() => setOpen(false)} onSubmit={(r) => { setReports([r, ...reports]); setOpen(false); setTab("feed"); }} />}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="font-display text-3xl font-bold text-primary">{n}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ReportSheet({ area, onClose, onSubmit }: { area: string; onClose: () => void; onSubmit: (r: Report) => void }) {
  const [kind, setKind] = useState<Kind>("power");
  const [note, setNote] = useState("");
  const [where, setWhere] = useState(area);
  const [advice, setAdvice] = useState<{ summary: string; steps: string[] } | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [adviceError, setAdviceError] = useState("");
  const fetchAdvice = useServerFn(getOutageAdvice);

  const askAdvice = async () => {
    setAdviceBusy(true);
    setAdviceError("");
    const res = await fetchAdvice({ data: { kind, area: where, note: note.trim() } });
    if (res.ok) setAdvice({ summary: res.summary, steps: res.steps });
    else setAdviceError(res.error);
    setAdviceBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Report an outage</h3>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["power", "water"] as const).map((k) => (
            <button key={k} onClick={() => { setKind(k); setAdvice(null); setAdviceError(""); }}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 font-medium ${kind === k ? (k === "power" ? "bg-primary text-primary-foreground" : "bg-water text-water-foreground") : "bg-secondary"}`}>
              {k === "power" ? <Zap size={18} /> : <Droplets size={18} />} {k === "power" ? "No power" : "No water"}
            </button>
          ))}
        </div>
        <select value={where} onChange={(e) => setWhere(e.target.value)} className="mt-3 w-full rounded-xl bg-secondary p-3 outline-none">
          {AREAS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's happening? e.g. No water on Vilakazi St"
          className="mt-3 h-24 w-full rounded-xl bg-secondary p-3 outline-none placeholder:text-muted-foreground" />
        {!advice && !adviceBusy && note.trim().length >= 5 && (
          <button onClick={askAdvice}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 py-3 font-medium text-primary">
            <Sparkles size={16} /> Summarize with AI & get next steps
          </button>
        )}
        {adviceBusy && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Sparkles size={14} className="animate-pulse" /> Thinking…</p>}
        {adviceError && <p className="mt-3 text-xs text-destructive">{adviceError}</p>}
        {advice && (
          <div className="mt-3 rounded-xl bg-secondary p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-primary"><Sparkles size={12} /> AI summary</p>
            <p className="mt-1 text-sm">{advice.summary}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">What to do now</p>
            <ul className="mt-1 space-y-1">
              {advice.steps.map((s, i) => (
                <li key={s} className="flex gap-2 text-sm"><span className="text-primary">{i + 1}.</span><span>{s}</span></li>
              ))}
            </ul>
          </div>
        )}
        <button disabled={!note.trim()}
          onClick={() => onSubmit({ id: crypto.randomUUID(), kind, area: where, note: note.trim(), time: Date.now(), confirms: 1, ...(advice ? { summary: advice.summary, steps: advice.steps } : {}) })}
          className="mt-3 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-40">
          Share with neighbours
        </button>
      </div>
    </div>
  );
}
