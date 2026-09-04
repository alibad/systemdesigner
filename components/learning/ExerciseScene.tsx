import { capacitySummary } from "@/lib/learning-lab";
import type { ExerciseScene as Scene } from "@/lib/skill-exercise-schema";
import SystemScene from "./SystemScene";

export default function ExerciseScene({
  scene,
  order,
  value,
  outcome,
}: {
  scene: Scene;
  order: string[];
  value: string;
  outcome: boolean | null;
}) {
  if (scene.kind === "flow")
    return (
      <SystemScene
        compact
        active={scene.actions[order.at(-1) || ""]}
        nodes={scene.nodes}
        reverse={scene.reverse}
        label="Your request route"
      />
    );
  if (scene.kind === "capacity") {
    const entered = Number(value);
    const valid =
      value.trim() !== "" &&
      Number.isFinite(entered) &&
      entered >= 0 &&
      Number.isInteger(entered);
    const result = capacitySummary(
      valid ? Math.min(entered, 10000) : 0,
      scene.perServer,
      scene.traffic,
      scene.failures,
    );
    return (
      <div className="exercise-scene">
        <SystemScene
          nodes={["browser", "service"]}
          active="service"
          captions={{
            browser: `${scene.traffic} requests/s`,
            service: `${scene.perServer} per server`,
          }}
        />
        <div className="lab-meter">
          <span
            className={result.waiting ? "bg-amber-400" : "bg-emerald-500"}
            style={{ width: `${(result.served / scene.traffic) * 100}%` }}
          />
        </div>
        <p
          className="mt-2 text-center text-xs leading-5 text-slate-600 dark:text-slate-300"
          aria-live="polite"
        >
          {valid
            ? `${result.surviving} surviving servers · ${result.capacity} requests/s capacity${result.waiting ? ` · ${result.waiting} requests/s unserved` : " · All traffic fits"}`
            : `Your server count will preview the capacity${scene.failures ? " after one failure" : ""}.`}
        </p>
      </div>
    );
  }
  if (scene.kind === "cache")
    return (
      <div className="exercise-scene">
        <SystemScene
          nodes={["service", "cache", "database"]}
          active={outcome === null ? "cache" : "database"}
          captions={{
            service: `${scene.traffic} reads/s`,
            cache: `${scene.hitRate}% hit rate`,
            database:
              outcome === null
                ? "Cache misses"
                : `${Math.round((scene.traffic * (100 - scene.hitRate)) / 100)} reads/s`,
          }}
        />
      </div>
    );
  if (scene.kind === "bottleneck")
    return (
      <div className="exercise-scene">
        <SystemScene
          nodes={["service", "database"]}
          active="database"
          captions={{
            service: `${scene.appCapacity * (outcome === null ? 1 : 2)} requests/s`,
            database: `${scene.databaseCapacity} reads/s`,
          }}
        />
        <p className="text-center text-xs text-slate-500">
          Every request still needs the same database.
        </p>
      </div>
    );
  if (scene.kind === "durability")
    return (
      <div className="exercise-scene">
        <SystemScene
          nodes={["service", "database"]}
          active={outcome === true ? "database" : "service"}
          captions={{
            service:
              outcome === null
                ? "Temporary memory"
                : "Restarted · memory cleared",
            database:
              outcome === true ? "Saved data survives" : "Durable storage",
          }}
        />
      </div>
    );
  return (
    <div className="exercise-scene">
      <SystemScene
        nodes={["cache", "database"]}
        active={outcome === true ? "database" : "cache"}
        captions={{
          cache:
            outcome === true ? "Old copy removed" : `Cached ${scene.cached}`,
          database: `Current ${scene.stored}`,
        }}
      />
      <p className="text-center text-xs text-slate-500">
        {outcome === true
          ? "The next read can fetch the current value."
          : "The copies disagree. Which one should change?"}
      </p>
    </div>
  );
}
