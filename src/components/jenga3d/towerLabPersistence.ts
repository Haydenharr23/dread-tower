import type { TowerBlockSpec } from "./towerLayout";

const STORAGE_KEY = "dread-tower-lab-v2";
// v1 key kept so we can ignore stale data from the old schema
const STORAGE_KEY_V1 = "dread-tower-lab-v1";

export type RelocatedBlock = {
  specId: string;
  pos: [number, number, number];
  quat: [number, number, number, number]; // x, y, z, w
};

export type TowerLabPersisted = {
  version: 2;
  /** Blocks that fell off the table — don't spawn next session. */
  removedIds: string[];
  /** Blocks pulled to the top — spawn at saved position next session. */
  relocated: RelocatedBlock[];
};

export function loadTowerLabState(): TowerLabPersisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as TowerLabPersisted;
    if (j?.version !== 2 || !Array.isArray(j.removedIds) || !Array.isArray(j.relocated))
      return null;
    return j;
  } catch {
    return null;
  }
}

export function saveTowerLabState(
  removedIds: string[],
  relocated: RelocatedBlock[]
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: TowerLabPersisted = {
      version: 2,
      removedIds: Array.from(new Set(removedIds)).sort(),
      relocated,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    // Wipe stale v1 data so it doesn't interfere
    sessionStorage.removeItem(STORAGE_KEY_V1);
  } catch {
    /* private mode, quota, etc. */
  }
}

export function clearTowerLabState(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY_V1);
  } catch {
    /* ignore */
  }
}

type Snapshot = Map<string, { pos: [number, number, number]; quat: [number, number, number, number] }>;

/**
 * Given the last-known positions of all blocks, split them into:
 *  - removedIds  — fell off the table (y < -0.42 or radius > 3.55)
 *  - relocated   — moved significantly from their canonical grid position but
 *                  still in-bounds (e.g. pulled out and stacked on top)
 *
 * Blocks that barely moved stay in neither list; they spawn at canonical pos.
 */
export function computeBlocksDestiny(
  snapshot: Snapshot,
  specs: TowerBlockSpec[]
): { removedIds: string[]; relocated: RelocatedBlock[] } {
  const removedIds: string[] = [];
  const relocated: RelocatedBlock[] = [];

  const MIN_Y = -0.42;
  const MAX_R = 2.9;

  // Highest canonical block top surface = top of the original tower.
  // Only blocks that settled ABOVE this line are saved as relocated (auto-stacked on top).
  // Everything else reloads at its canonical position so the tower looks straight.
  const towerTopY = specs.length > 0
    ? Math.max(...specs.map((s) => s.pos[1])) + 0.23 // + half block height
    : 5.4;

  for (const spec of specs) {
    const entry = snapshot.get(spec.id);
    if (!entry) continue;
    const [x, y, z] = entry.pos;

    if (y < MIN_Y || Math.hypot(x, z) > MAX_R) {
      removedIds.push(spec.id);
      continue;
    }

    if (y > towerTopY) {
      relocated.push({ specId: spec.id, pos: entry.pos, quat: entry.quat });
    }
  }

  return { removedIds, relocated };
}
