import type { LevelConfig } from "./types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function looksLikeLevelConfig(value: unknown): value is LevelConfig {
  const x = value as {
    id?: unknown;
    name?: unknown;
    start_gold?: unknown;
    lives?: unknown;
    map?: {
      width?: unknown;
      height?: unknown;
      path?: Array<{ x?: unknown; y?: unknown }>;
    };
    enemy_types?: unknown[];
    tower_types?: unknown[];
    waves?: unknown[];
  };

  return (
    Boolean(x) &&
    isFiniteNumber(x.id) &&
    typeof x.name === "string" &&
    isFiniteNumber(x.start_gold) &&
    isFiniteNumber(x.lives) &&
    Boolean(x.map) &&
    isFiniteNumber(x.map?.width) &&
    isFiniteNumber(x.map?.height) &&
    Array.isArray(x.map?.path) &&
    (x.map?.path.length ?? 0) >= 2 &&
    x.map!.path.every((p) => isFiniteNumber(p.x) && isFiniteNumber(p.y)) &&
    Array.isArray(x.enemy_types) &&
    Array.isArray(x.tower_types) &&
    Array.isArray(x.waves)
  );
}

export async function loadLevel(levelId: number): Promise<LevelConfig> {
  const url = `/api/v1/levels/${levelId}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data: unknown = await res.json();
  if (!looksLikeLevelConfig(data)) {
    throw new Error("Bad level shape");
  }

  return data;
}
