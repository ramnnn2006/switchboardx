"use client";
import { useState, useEffect } from "react";
import { plan } from "../lib/planner";
export default function Planner({
  task,
  budget = 4000,
  onReport,
}: {
  task: string;
  budget?: number;
  onReport: () => void;
}) {
  const [held, setHeld] = useState<string[]>([]),
    [excluded, setExcluded] = useState<string[]>([]),
    [stage, setStage] = useState(0),
    [result, setResult] = useState(() => plan(task)),
    [marked, setMarked] = useState<Record<string, boolean>>({}),
    [showSchema, setShowSchema] = useState(false),
    [query, setQuery] = useState(true),
    [view, setView] = useState("Plan");
  useEffect(() => {
    setStage(0);
    setMarked({});
    const timers = Array.from({ length: 7 }, (_, i) =>
      setTimeout(() => setStage(i + 1), 70 * (i + 1)),
    );
    setResult(plan(task, held, excluded));
    return () => timers.forEach(clearTimeout);
  }, [task, held, excluded]);
  const stages = [
    "intent map",
    "anchor capability",
    "ground entities",
    "solve with algo.MSpaths",
    "rank paths",
    "trifecta guard",
    "emit schemas",
  ];
  function add(value: string, target: string) {
    if (target === "held")
      setHeld((x) => (x.includes(value) ? x : [...x, value]));
    else setExcluded((x) => (x.includes(value) ? x : [...x, value]));
  }
  function drag(e: React.DragEvent, value: string) {
    e.dataTransfer.setData("text/plain", value);
  }
  function report() {
    const runs = JSON.parse(localStorage.getItem("sb-local-runs") || "[]");
    runs.unshift({
      task,
      at: new Date().toISOString(),
      ok: Object.values(marked).every(Boolean),
      steps: result.steps.map((s) => ({
        tool: s.id.slice(2),
        ok: marked[s.id] ?? true,
      })),
    });
    localStorage.setItem("sb-local-runs", JSON.stringify(runs));
    onReport();
  }
  return (
    <section className="local-planner" aria-label="Local task planner">
      <aside>
        <div
          className="local-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            add(e.dataTransfer.getData("text/plain"), "held");
          }}
        >
          <div className="local-label">Already known</div>
          <span className="local-chip">session</span>
          <span className="local-chip">text.query</span>
          <span className="local-chip">github.repo · acme/api</span>
          {held.map((v) => (
            <button
              key={v}
              className="local-chip"
              onClick={() => setHeld((x) => x.filter((y) => y !== v))}
            >
              {v} ×
            </button>
          ))}
        </div>
        <p className="local-label" style={{ marginTop: 24 }}>
          Stickers
        </p>
        <p style={{ fontSize: 12, opacity: 0.65 }}>
          Drag a value onto Already known, or a tool onto Exclude. With a
          keyboard, press Space, move with the arrows, and drop with Enter.
        </p>
        {[
          "github.branch",
          "github.file_path",
          "email.address",
          "gcal.calendar_id",
          "github/list_branches",
          "github/create_branch",
          "google-calendar/list-calendars",
        ].map((v, i) => (
          <button
            key={v}
            className="local-note"
            draggable
            onDragStart={(e) => drag(e, v)}
            onClick={() => add(v, v.includes("/") ? "excluded" : "held")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                add(v, v.includes("/") ? "excluded" : "held");
              }
            }}
          >
            {v}
            <br />
            <small>
              {
                [
                  "fix/flaky-login",
                  "tests/login.spec.ts",
                  "team@example.com",
                  "primary",
                ][i]
              }
            </small>
          </button>
        ))}
        <div
          className="local-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            add(e.dataTransfer.getData("text/plain"), "excluded");
          }}
        >
          <span className="local-label">Exclude</span>
          {excluded.map((v) => (
            <button
              key={v}
              className="local-note"
              onClick={() => setExcluded((x) => x.filter((y) => y !== v))}
            >
              {v} ×
            </button>
          ))}
        </div>
      </aside>
      <div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {["Plan", "Whole graph"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{ fontWeight: view === v ? 700 : 400 }}
            >
              {v}
            </button>
          ))}
          <span className="local-label" style={{ marginLeft: "auto" }}>
            local · reconstructed planner
          </span>
        </div>
        <h1 className="local-plan-title" style={{ marginTop: 28 }}>
          {stage < 7
            ? "Planning…"
            : result.guard === "blocked"
              ? "Unsafe chain blocked."
              : result.supported
                ? "Only the tools it calls."
                : "No complete local plan."}
        </h1>
        {view === "Whole graph" ? (
          <iframe
            title="Whole graph"
            src="/explore?embed=1"
            style={{ width: "100%", height: 620, border: 0 }}
          />
        ) : (
          <>
            <div className="local-label">
              held · session &nbsp; held · text.query
            </div>
            {result.steps.map((s, i) => (
              <div
                className="local-step"
                key={s.id}
                style={{ opacity: stage > i ? 1 : 0.3 }}
              >
                <small>
                  {s.order} &nbsp; {s.server}
                </small>
                <h2 style={{ fontSize: 22, margin: "8px 0" }}>{s.label}</h2>
                <small>
                  {s.consumes?.join(" · ")} → {s.yields?.join(", ")}
                </small>
                {s.risk?.map((r) => (
                  <span
                    className="local-chip"
                    key={r}
                    style={{ background: "#f6e68f" }}
                  >
                    {r}
                  </span>
                ))}
                <div className="local-run-step">
                  <button
                    aria-label={s.label + " worked"}
                    onClick={() => setMarked((x) => ({ ...x, [s.id]: true }))}
                    style={{
                      background: marked[s.id] === true ? "#d9f94a" : "",
                    }}
                  >
                    ✓
                  </button>
                  <button
                    aria-label={s.label + " failed"}
                    onClick={() => setMarked((x) => ({ ...x, [s.id]: false }))}
                    style={{
                      background: marked[s.id] === false ? "#ff5a36" : "",
                    }}
                  >
                    ×
                  </button>
                </div>
                {showSchema && (
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>
                    {JSON.stringify(
                      {
                        tool: s.id.slice(2),
                        consumes: s.consumes,
                        yields: s.yields,
                      },
                      null,
                      2,
                    )}
                  </pre>
                )}
              </div>
            ))}
            {!result.supported && (
              <p role="alert">
                {result.missing?.length
                  ? "An excluded prerequisite leaves this plan incomplete."
                  : "This local planner does not recognize that task yet. Try a supplied example. No server request was made."}
              </p>
            )}
            {result.guard === "blocked" && (
              <div
                role="alert"
                className="local-stage"
                style={{ borderColor: "#ff5a36" }}
              >
                Private data + untrusted input + an outbound tool. The edge into
                the way out is cut. Nothing is read or sent.
              </div>
            )}
            <button
              onClick={() => setShowSchema(!showSchema)}
              className="local-chip"
            >
              {showSchema ? "Hide" : "Show"} schemas
            </button>
            <p style={{ fontSize: 13, marginTop: 20 }}>
              Did it work? Mark each step. Reports show up in Runs and count
              which tool pairs worked.
            </p>
            <button className="local-chip" onClick={report}>
              Report run
            </button>
          </>
        )}
      </div>
      <aside>
        <div className="local-stage">
          <div className="local-label">How it planned</div>
          {stages.map((s, i) => (
            <p
              key={s}
              style={{
                margin: "12px 0",
                opacity: stage > i ? 1 : 0.3,
                fontSize: 13,
              }}
            >
              {stage > i ? "✓" : "○"} {s}
            </p>
          ))}
        </div>
        <div className="local-stage">
          <span className="local-label">Goal</span>
          <p>{result.capability}</p>
          <span className="local-label">Guard</span>
          <p>
            {result.guard === "blocked"
              ? "Blocked risky chain"
              : "No risky chain"}
          </p>
          <strong
            style={{
              fontSize: 52,
              color: result.tokens > budget ? "#ff5a36" : "#526e2d",
            }}
          >
            {result.tokens.toLocaleString()}
          </strong>
          <p style={{ fontSize: 12 }}>vs 110,238 to preload every schema</p>
          {result.tokens > budget && (
            <p role="alert">
              Over the token budget. Increase the budget or exclude a tool.
            </p>
          )}
        </div>
        <button className="local-chip" onClick={() => setQuery(!query)}>
          Cypher query {query ? "−" : "+"}
        </button>
        {query && (
          <pre
            style={{
              fontSize: 10,
              whiteSpace: "pre-wrap",
              padding: 16,
              background: "#141c12",
              color: "#d9f94a",
              borderRadius: 10,
            }}
          >{`CALL algo.MSpaths({sourceLabel: 'Type', sourceProperty: 'name', sourceValues: ['session', 'text.query', 'github.repo'], targetLabel: 'Type', relTypes: ['FEEDS', 'YIELDS'], relDirection: 'outgoing', maxLen: 8, pathCount: 3}) YIELD path, pathWeight RETURN path, pathWeight\n\n// Shown for parity. Execution here is the local planner, not HydraDB.`}</pre>
        )}
      </aside>
    </section>
  );
}
