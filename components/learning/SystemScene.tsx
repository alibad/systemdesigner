import Image from "next/image";
import { ArrowRight, ArrowLeft, MemoryStick } from "lucide-react";

export type SystemNode = "browser" | "service" | "database" | "cache";
const labels: Record<SystemNode, string> = {
  browser: "Browser",
  service: "Service",
  database: "Database",
  cache: "Cache",
};

export default function SystemScene({
  active,
  nodes = ["browser", "service", "database"],
  reverse = false,
  compact = false,
  captions,
  label = nodes.map((node) => labels[node]).join(", "),
}: {
  active?: SystemNode;
  nodes?: SystemNode[];
  reverse?: boolean;
  compact?: boolean;
  captions?: Partial<Record<SystemNode, string>>;
  label?: string;
}) {
  const Arrow = reverse ? ArrowLeft : ArrowRight;
  return (
    <figure
      className={`system-scene ${compact ? "system-scene-compact" : ""}`}
      aria-label={label}
    >
      <div className="flex items-start justify-center">
        {nodes.map((node, index) => (
          <div key={node} className="contents">
            {index > 0 && (
              <Arrow
                aria-hidden
                className={`scene-arrow ${active === node || (reverse && active === nodes[index - 1]) ? "text-sky-500" : "text-slate-300"}`}
              />
            )}
            <div
              className={`scene-node ${active === node ? "scene-node-active" : ""}`}
            >
              <div className="scene-picture">
                {node === "cache" ? (
                  <MemoryStick
                    aria-hidden
                    className="h-12 w-12 text-sky-600"
                    strokeWidth={1.4}
                  />
                ) : (
                  <Image
                    src={`/learning/${node}.png`}
                    width={128}
                    height={128}
                    alt=""
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <span className="block text-center text-sm font-semibold">
                {labels[node]}
              </span>
              {captions?.[node] && (
                <span className="mt-1 block text-center text-xs leading-4 text-slate-500 dark:text-slate-400">
                  {captions[node]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}
