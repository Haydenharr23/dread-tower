export type TowerBlockSpec = {
  id: string;
  level: number;
  pos: [number, number, number];
  size: [number, number, number];
  /** Unit direction the block slides when pulled (horizontal). */
  slide: [number, number, number];
};

export const DEFAULT_TOWER_LAYERS = 16;
/** Slightly shorter stack for Rapier stability (fewer sleeping islands). */
export const PHYSICS_TOWER_LAYERS = 12;

export const PHYSICS_BLOCK_COUNT = PHYSICS_TOWER_LAYERS * 3;

const H = 0.45;
const SHORT = 0.75;
const LONG = 2.28;

export function buildTowerBlocks(layerCount: number = DEFAULT_TOWER_LAYERS): TowerBlockSpec[] {
  const out: TowerBlockSpec[] = [];
  for (let level = 0; level < layerCount; level++) {
    const y = level * H + H / 2;
    const alongX = level % 2 === 0;
    for (let i = 0; i < 3; i++) {
      const id = `L${level}-S${i}`;
      if (alongX) {
        const x = (i - 1) * SHORT;
        const slide: [number, number, number] =
          i === 0 ? [-1, 0, 0] : i === 2 ? [1, 0, 0] : [0, 0, 1];
        out.push({
          id,
          level,
          pos: [x, y, 0],
          size: [SHORT * 0.99, H * 0.99, LONG * 0.99],
          slide,
        });
      } else {
        const z = (i - 1) * SHORT;
        const slide: [number, number, number] =
          i === 0 ? [0, 0, -1] : i === 2 ? [0, 0, 1] : [1, 0, 0];
        out.push({
          id,
          level,
          pos: [0, y, z],
          size: [LONG * 0.99, H * 0.99, SHORT * 0.99],
          slide,
        });
      }
    }
  }
  return out;
}
