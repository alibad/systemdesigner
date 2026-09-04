"use client";

import { useState } from "react";
import { ArrowRight, Minus, Plus, RotateCcw, Play, Zap } from "lucide-react";
import SystemScene from "./SystemScene";
import {
  applyCacheAction,
  capacitySummary,
  initialCacheLab,
  type LearningLabKind,
} from "@/lib/learning-lab";

const hops = [
  {
    active: "browser",
    text: "Your browser is ready to ask for the destination of a short link.",
  },
  {
    active: "service",
    text: "The browser sends a request. The service receives the short-link key.",
  },
  {
    active: "database",
    text: "The service asks the database for the destination saved under that key.",
  },
  {
    active: "service",
    text: "The database returns the destination to the service.",
  },
  {
    active: "browser",
    text: "The service sends a redirect. Your browser opens the destination.",
  },
] as const;

export default function LearningLab({ kind }: { kind: LearningLabKind }) {
  return (
    <section aria-label="Interactive example" className="learning-lab">
      <p className="learning-eyebrow flex items-center gap-2">
        <Play className="h-3.5 w-3.5" /> Try the idea
      </p>
      {kind === "request" ? (
        <RequestLab />
      ) : kind === "capacity" ? (
        <CapacityLab />
      ) : (
        <CacheLab />
      )}
    </section>
  );
}

function RequestLab() {
  const [hop, setHop] = useState(0);
  return (
    <>
      <SystemScene active={hops[hop].active} reverse={hop >= 3} />
      <p role="status" className="lab-status" key={hop}>
        {hops[hop].text}
      </p>
      <button
        className="lab-action"
        onClick={() => setHop((hop + 1) % hops.length)}
      >
        {hop === 0
          ? "Send a request"
          : hop === 4
            ? "Replay request"
            : "Next hop"}
        {hop === 4 ? (
          <RotateCcw className="h-4 w-4" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">
        {hop + 1} of {hops.length} moments · Explore at your pace
      </p>
    </>
  );
}

function CapacityLab() {
  const [servers, setServers] = useState(1);
  const [failed, setFailed] = useState(false);
  const result = capacitySummary(servers, 100, 250, failed ? 1 : 0);
  return (
    <>
      <SystemScene
        nodes={["browser", "service"]}
        active="service"
        captions={{
          browser: "250 requests/s",
          service: `${result.surviving} × 100 requests/s`,
        }}
      />
      <div
        className="my-4 flex items-center justify-center gap-5"
        role="group"
        aria-label="Adjust servers"
      >
        <button
          aria-label="Remove one server"
          className="lab-stepper"
          disabled={servers === 1}
          onClick={() => setServers(servers - 1)}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-24 text-center text-lg font-bold">
          {servers} {servers === 1 ? "server" : "servers"}
        </span>
        <button
          aria-label="Add one server"
          className="lab-stepper"
          disabled={servers === 6}
          onClick={() => setServers(servers + 1)}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div
        role="meter"
        aria-label="Traffic served"
        aria-valuemin={0}
        aria-valuemax={250}
        aria-valuenow={result.served}
        className="lab-meter"
      >
        <span
          className={result.waiting ? "bg-amber-400" : "bg-emerald-500"}
          style={{ width: `${(result.served / 250) * 100}%` }}
        />
      </div>
      <p role="status" className="lab-status">
        {result.waiting
          ? `${result.served} requests/s served. ${result.waiting} requests/s cannot be handled yet.`
          : `All 250 requests/s fit. ${result.capacity - 250} requests/s of spare capacity.`}
      </p>
      <button
        aria-pressed={failed}
        onClick={() => setFailed(!failed)}
        className="lab-action"
      >
        <Zap className="h-4 w-4" />
        {failed ? "Restore the failed server" : "Take one server offline"}
      </button>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        This model shares traffic evenly. Try adding enough capacity to survive
        a failure.
      </p>
    </>
  );
}

function CacheLab() {
  const [state, setState] = useState(initialCacheLab);
  const [lastAction, setLastAction] = useState<string>();
  function act(action: "read" | "update" | "invalidate") {
    setState((state) => applyCacheAction(state, action));
    setLastAction(action);
  }
  const stale = state.returned !== null && state.returned !== state.database;
  const message =
    lastAction === "update"
      ? state.cache === null
        ? "The database changed. The cache is empty, so the next read will fetch the new destination."
        : "The database changed. The cached copy did not. Try reading the link again."
      : lastAction === "invalidate"
        ? "The old cached copy is gone. The next read will fetch the current destination."
        : state.source === "cache"
          ? stale
            ? `Cache hit: version ${state.returned} is stale. The database has version ${state.database}.`
            : `Cache hit: version ${state.returned} came straight from the cache. No database read.`
          : state.source === "database"
            ? `Cache miss: version ${state.returned} came from the database and is now cached.`
            : "The cache is empty. Read the link twice and watch what changes.";
  return (
    <>
      <SystemScene
        nodes={["service", "cache", "database"]}
        active={state.source || "cache"}
        captions={{
          cache: state.cache === null ? "Empty" : `Version ${state.cache}`,
          database: `Version ${state.database}`,
        }}
      />
      <p
        role="status"
        className={`lab-status ${stale ? "text-amber-800 dark:text-amber-300" : ""}`}
      >
        {message}
      </p>
      <button className="lab-action" onClick={() => act("read")}>
        Read the link <ArrowRight className="h-4 w-4" />
      </button>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button className="lab-secondary" onClick={() => act("update")}>
          Update destination
        </button>
        <button
          className="lab-secondary"
          disabled={state.cache === null}
          onClick={() => act("invalidate")}
        >
          Clear cached copy
        </button>
      </div>
      <p className="mt-3 text-center text-xs font-medium text-slate-500">
        {state.reads} {state.reads === 1 ? "read" : "reads"} ·{" "}
        {state.databaseReads} database{" "}
        {state.databaseReads === 1 ? "read" : "reads"}
      </p>
    </>
  );
}
