"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import {
  buildTowerBlocks,
  PHYSICS_TOWER_LAYERS,
  type TowerBlockSpec,
} from "./towerLayout";
import { createWoodBlockTexture } from "./woodBlockTexture";
import {
  computeBlocksDestiny,
  saveTowerLabState,
  type RelocatedBlock,
} from "./towerLabPersistence";

// ─── Constants ────────────────────────────────────────────────────────────────
/** Lower than real gravity → less downward force → stabler tall stacks. */
const GRAVITY = -4;
const SOLVER_ITERATIONS = 80;
const BLOCK_MASS = 1.0;
const BLOCK_LINEAR_DAMPING = 0.6;
const BLOCK_ANGULAR_DAMPING = 0.95;
const CONTACT_STIFFNESS = 5e6;
/**
 * High relaxation = contacts resolve over many timesteps = dramatically more
 * stable for tall stacks.  10–15 is ideal for Jenga-style towers.
 */
const CONTACT_RELAXATION = 20;
const BLOCK_FRICTION = 0.5;
const GROUND_FRICTION = 0.9;
const RESTITUTION = 0.0;
/**
 * Direct-velocity drag gain.  Each frame we set velocity = gain × (pointer_target − body_pos).
 * This bypasses cannon-es's friction solver completely — no spring vs friction arms-race.
 */
const DRAG_VELOCITY_GAIN = 14;
/** Maximum speed (units/s) a dragged block can travel — prevents yanking. */
const DRAG_MAX_SPEED = 2.2;
const ORBIT_TARGET: [number, number, number] = [0, 2.65, 0];
const DRAG_THRESHOLD_PX = 5;
const FIXED_STEP = 1 / 60;
const MAX_SUB_STEPS = 5;

// Must match towerLayout.ts
const LAYOUT_H = 0.45;
const LAYOUT_SHORT = 0.75;

// Auto-stack threshold is computed per-block from its geometry (see DragState.stackThreshold).

// ─── Snapshot entry (position + quaternion) ───────────────────────────────────
type SnapEntry = {
  pos: [number, number, number];
  quat: [number, number, number, number];
};

// ─── Interaction types ────────────────────────────────────────────────────────
type DragState = {
  specId: string;
  body: CANNON.Body;
  slideAxis: THREE.Vector3;
  initialBodyPos: { x: number; y: number; z: number };
  initialPickX: number;
  initialPickZ: number;
  pointerId: number;
  /** Pointer must travel this many units along slideAxis before auto-stacking. */
  stackThreshold: number;
};

type PendingDrag = {
  specId: string;
  body: CANNON.Body;
  pickX: number;
  pickZ: number;
  clientX: number;
  clientY: number;
  pointerId: number;
};


// ─── Wood materials ───────────────────────────────────────────────────────────
function useWoodMaterials() {
  const map = useMemo(() => createWoodBlockTexture(), []);
  const { normal, hover } = useMemo(() => {
    const base = { map, metalness: 0.08, roughness: 0.82, emissive: new THREE.Color("#140c08") };
    return {
      normal: new THREE.MeshStandardMaterial({ ...base, emissiveIntensity: 0.05 }),
      hover:  new THREE.MeshStandardMaterial({ ...base, emissiveIntensity: 0.14 }),
    };
  }, [map]);
  useEffect(() => () => { map.dispose(); normal.dispose(); hover.dispose(); }, [map, normal, hover]);
  return { normal, hover };
}

// ─── Block mesh ───────────────────────────────────────────────────────────────
function BlockMesh({
  spec, matNormal, matHover, hoveredId, selectedId, registerGroup, registerPickMesh,
}: {
  spec: TowerBlockSpec;
  matNormal: THREE.MeshStandardMaterial;
  matHover:  THREE.MeshStandardMaterial;
  hoveredId: string | null;
  selectedId: string | null;
  registerGroup:    (id: string, g: THREE.Group | null) => void;
  registerPickMesh: (id: string, m: THREE.Mesh  | null) => void;
}) {
  const groupRef    = useRef<THREE.Group>(null);
  const pickMeshRef = useRef<THREE.Mesh>(null);

  const edgesGeo = useMemo(() => {
    const box  = new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
    const edge = new THREE.EdgesGeometry(box);
    box.dispose();
    return edge;
  }, [spec.size[0], spec.size[1], spec.size[2]]);
  useEffect(() => () => edgesGeo.dispose(), [edgesGeo]);

  useLayoutEffect(() => {
    const g = groupRef.current;
    if (g) registerGroup(spec.id, g);
    return () => registerGroup(spec.id, null);
  }, [spec.id, registerGroup]);

  useLayoutEffect(() => {
    const m = pickMeshRef.current;
    if (m) registerPickMesh(spec.id, m);
    return () => registerPickMesh(spec.id, null);
  }, [spec.id, registerPickMesh]);

  const isHover    = hoveredId  === spec.id;
  const isSelected = selectedId === spec.id;

  return (
    <group ref={groupRef} position={spec.pos}>
      <mesh ref={pickMeshRef} userData={{ blockId: spec.id }}
        castShadow receiveShadow material={isHover ? matHover : matNormal}>
        <boxGeometry args={spec.size} />
      </mesh>
      {isSelected && (
        <mesh raycast={() => null} renderOrder={4}>
          <boxGeometry args={[spec.size[0]*1.008, spec.size[1]*1.008, spec.size[2]*1.008]} />
          <meshBasicMaterial color="#cc1515" transparent opacity={0.28}
            depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <lineSegments geometry={edgesGeo} raycast={() => null} renderOrder={3}>
        <lineBasicMaterial color="#ff2a35" transparent
          opacity={isSelected ? 0.92 : isHover ? 0.72 : 0.58} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

// ─── Public types ─────────────────────────────────────────────────────────────
export type PhysicsTowerStatus = {
  mode: "idle" | "selected" | "dragging" | "gameover";
  blocks: number;
  selectedId: string | null;
  /** Increments each time a block is successfully pulled and placed on top. */
  pullCount: number;
};

type Props = {
  resetNonce: number;
  removedBlockIds: string[];
  relocatedBlocks: RelocatedBlock[];
  onStatus?: (s: PhysicsTowerStatus) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Returns the canonical X, Z position and rotation for the next auto-stack slot.
 * Y is intentionally excluded — the caller computes it from actual physics bodies
 * so the block lands cleanly even if the tower has shifted.
 *
 * Slots fill 0 → 1 → 2 before advancing to the next layer index, guaranteeing
 * a complete row of 3 before a new layer starts.
 */
function computeStackSlot(
  topCount: number,
  srcSpec: TowerBlockSpec,
): { x: number; z: number; quat: THREE.Quaternion } {
  const index   = PHYSICS_TOWER_LAYERS + Math.floor(topCount / 3);
  const slot    = topCount % 3;
  const alongX  = index % 2 === 0;
  const x = alongX ? (slot - 1) * LAYOUT_SHORT : 0;
  const z = alongX ? 0 : (slot - 1) * LAYOUT_SHORT;
  const srcAlongX = srcSpec.level % 2 === 0;
  const quat = new THREE.Quaternion();
  if (srcAlongX !== alongX) {
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  }
  return { x, z, quat };
}

// ─── Main scene ───────────────────────────────────────────────────────────────
export function PhysicsTowerScene({
  resetNonce,
  removedBlockIds,
  relocatedBlocks,
  onStatus,
}: Props) {
  const removedKey  = useMemo(() => [...removedBlockIds].sort().join(","),  [removedBlockIds]);
  const relocKey    = useMemo(() => relocatedBlocks.map((b) => b.specId).sort().join(","), [relocatedBlocks]);
  const removedSet  = useMemo(() => new Set(removedBlockIds), [removedKey]);
  const relocMap    = useMemo(() => {
    const m = new Map<string, RelocatedBlock>();
    for (const b of relocatedBlocks) m.set(b.specId, b);
    return m;
  }, [relocKey]);

  // Base block specs (only those not fully removed from play)
  const blocks = useMemo(
    () => buildTowerBlocks(PHYSICS_TOWER_LAYERS).filter((s) => !removedSet.has(s.id)),
    [removedSet]
  );

  const { normal: matNormal, hover: matHover } = useWoodMaterials();
  const { camera, gl, raycaster } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Physics
  const worldRef  = useRef<CANNON.World | null>(null);
  const bodiesRef = useRef<Map<string, CANNON.Body>>(new Map());

  // Three.js mesh refs
  const groupsRef     = useRef<Map<string, THREE.Group>>(new Map());
  const pickMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const snapshotRef   = useRef<Map<string, SnapEntry>>(new Map());
  const removedIdsRef = useRef(removedBlockIds);
  removedIdsRef.current = removedBlockIds;

  // Interaction
  const dragRef        = useRef<DragState | null>(null);
  const pendingDragRef = useRef<PendingDrag | null>(null);
  const selectedIdRef  = useRef<string | null>(null);
  const mouseNDCRef    = useRef(new THREE.Vector2());
  const blocksRef      = useRef(blocks);
  blocksRef.current    = blocks;

  // React state
  // Reliable slot counter: incremented on each auto-stack, never derived from
  // physics positions (which can be wrong when the tower has gaps or blocks drift).
  const autoStackCountRef = useRef(relocatedBlocks.length);

  // Game-over detection: count consecutive frames where the tallest on-table block
  // is below the threshold, then declare the tower fallen.
  const gameOverRef      = useRef(false);
  const gameOverCountRef = useRef(0);

  // ── Freeze / unfreeze other bodies ────────────────────────────────────────
  // Assign each render so closures always see current bodiesRef contents.
  const freezeOtherBodiesRef = useRef((_keepId: string) => {});
  freezeOtherBodiesRef.current = (keepId: string) => {
    bodiesRef.current.forEach((body, id) => {
      if (id === keepId) return;
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.type = CANNON.Body.STATIC;
    });
  };

  const unfreezeAllBodiesRef = useRef(() => {});
  unfreezeAllBodiesRef.current = () => {
    bodiesRef.current.forEach((body) => {
      body.type = CANNON.Body.DYNAMIC;
      body.linearDamping  = BLOCK_LINEAR_DAMPING;
      body.angularDamping = BLOCK_ANGULAR_DAMPING;
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.wakeUp();
    });
  };

  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uiMode,     setUiMode]     = useState<"idle" | "selected" | "dragging" | "gameover">("idle");
  const [pullCount,  setPullCount]  = useState(0);

  // ── Build cannon world ────────────────────────────────────────────────────
  useEffect(() => {
    bodiesRef.current.clear();
    snapshotRef.current.clear();

    const world = new CANNON.World();
    world.gravity.set(0, GRAVITY, 0);
    (world.solver as CANNON.GSSolver).iterations = SOLVER_ITERATIONS;
    world.allowSleep = false;

    // Also set world defaults for any contacts that miss a specific material pair
    world.defaultContactMaterial.contactEquationStiffness  = CONTACT_STIFFNESS;
    world.defaultContactMaterial.contactEquationRelaxation = CONTACT_RELAXATION;
    world.defaultContactMaterial.friction = BLOCK_FRICTION;

    const blockMat  = new CANNON.Material("block");
    const groundMat = new CANNON.Material("ground");

    world.addContactMaterial(new CANNON.ContactMaterial(blockMat, blockMat, {
      friction: BLOCK_FRICTION,
      restitution: RESTITUTION,
      contactEquationStiffness:  CONTACT_STIFFNESS,
      contactEquationRelaxation: CONTACT_RELAXATION,
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(groundMat, blockMat, {
      friction: GROUND_FRICTION,
      restitution: RESTITUTION,
      contactEquationStiffness:  CONTACT_STIFFNESS,
      contactEquationRelaxation: CONTACT_RELAXATION,
    }));

    const ground = new CANNON.Body({ mass: 0, material: groundMat });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(ground);

    for (const spec of blocks) {
      const [hx, hy, hz] = [spec.size[0] / 2, spec.size[1] / 2, spec.size[2] / 2];
      const body = new CANNON.Body({
        mass: BLOCK_MASS,
        material: blockMat,
        linearDamping:  BLOCK_LINEAR_DAMPING,
        angularDamping: BLOCK_ANGULAR_DAMPING,
      });
      body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));

      const rel = relocMap.get(spec.id);
      if (rel) {
        // Spawn at the saved relocated position + orientation
        body.position.set(rel.pos[0], rel.pos[1], rel.pos[2]);
        body.quaternion.set(rel.quat[0], rel.quat[1], rel.quat[2], rel.quat[3]);
      } else {
        body.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      }

      world.addBody(body);
      bodiesRef.current.set(spec.id, body);
    }

    // Pre-warm: simulate until blocks settle so the first rendered frame isn't an explosion.
    // High CONTACT_STIFFNESS causes violent correction impulses on the very first step when
    // block faces are nearly touching — running headless steps resolves those forces before
    // any mesh is visible.
    world.allowSleep = true;
    // sleepSpeedLimit / sleepTimeLimit exist at runtime but are missing from the cannon-es type defs
    (world as unknown as Record<string, unknown>).sleepSpeedLimit = 0.1;
    (world as unknown as Record<string, unknown>).sleepTimeLimit  = 0.3;
    for (let i = 0; i < 150; i++) {
      world.step(1 / 60);
    }
    world.allowSleep = false;
    // Zero residual velocity from warmup drift and wake every block body.
    bodiesRef.current.forEach((warmupBody) => {
      warmupBody.wakeUp();
      warmupBody.velocity.set(0, 0, 0);
      warmupBody.angularVelocity.set(0, 0, 0);
    });
    // Snap all original tower blocks to canonical positions after warmup drift.
    // Skip blocks that have been auto-stacked above the tower (their Y is well above canonical).
    const warmupSpecs = buildTowerBlocks(PHYSICS_TOWER_LAYERS);
    for (const spec of warmupSpecs) {
      const b = bodiesRef.current.get(spec.id);
      if (!b) continue;
      if (b.position.y > spec.pos[1] + LAYOUT_H * 3) continue; // already relocated — leave alone
      b.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      b.quaternion.set(0, 0, 0, 1);
      b.velocity.set(0, 0, 0);
      b.angularVelocity.set(0, 0, 0);
    }

    worldRef.current = world;
    return () => { worldRef.current = null; bodiesRef.current.clear(); };
  }, [resetNonce, removedKey, relocKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Snap all original tower blocks to canonical positions ─────────────────
  // Called after every auto-stack and on world build/re-entry.
  // Skips blocks that have been pulled and relocated above the tower top.
  const snapTower = useCallback(() => {
    const allSpecs = buildTowerBlocks(PHYSICS_TOWER_LAYERS);
    for (const spec of allSpecs) {
      const body = bodiesRef.current.get(spec.id);
      if (!body) continue;
      // Skip blocks that have been auto-stacked above the original tower —
      // their Y is well above their canonical position.
      if (body.position.y > spec.pos[1] + LAYOUT_H * 3) continue;
      body.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      body.quaternion.set(0, 0, 0, 1);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
    }
  }, []);

  // Snap on each world (re)build so the tower starts straight.
  useEffect(() => {
    if (!worldRef.current) return;
    snapTower();
  }, [resetNonce, removedKey, relocKey, snapTower]);

  // ── Persist on unmount / navigate away ───────────────────────────────────
  useEffect(() => {
    const fullSpecs = buildTowerBlocks(PHYSICS_TOWER_LAYERS);
    return () => {
      const { removedIds, relocated } = computeBlocksDestiny(snapshotRef.current, fullSpecs);
      // Merge with blocks already removed in previous sessions
      const allRemoved = Array.from(new Set([...removedIdsRef.current, ...removedIds]));
      saveTowerLabState(allRemoved, relocated);
    };
  }, []);

  // ── Controls helpers ──────────────────────────────────────────────────────
  const setControlsLocked = useCallback((locked: boolean) => {
    const c = controlsRef.current;
    if (!c) return;
    c.enabled = !locked;
    if (!locked) { c.enableRotate = true; c.enableZoom = true; }
  }, []);

  const ndcFromEvent = useCallback((e: PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1,
    );
  }, [gl.domElement]);

  // Stable pick helper — reassigned each render so refs are always current
  const pickRef = useRef((_ndc: THREE.Vector2): THREE.Intersection | null => null);
  pickRef.current = (ndc: THREE.Vector2) => {
    raycaster.setFromCamera(ndc, camera);
    const meshes = Array.from(pickMeshesRef.current.values());
    for (const m of meshes) m.updateMatrixWorld(true);
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    hits.sort((a, b) => a.distance - b.distance);
    return hits[0] ?? null;
  };

  // ── End drag (block released before threshold) ────────────────────────────
  const endDrag = useCallback(() => {
    pendingDragRef.current = null;
    const d = dragRef.current;
    if (!d) return; // already cleared by auto-stack in useFrame

    try { gl.domElement.releasePointerCapture(d.pointerId); } catch { /* ignore */ }
    d.body.velocity.set(0, 0, 0);
    d.body.angularVelocity.set(0, 0, 0);
    d.body.linearDamping  = BLOCK_LINEAR_DAMPING;
    d.body.angularDamping = BLOCK_ANGULAR_DAMPING;
    unfreezeAllBodiesRef.current();
    dragRef.current = null;
    setControlsLocked(false);
    selectedIdRef.current = null;
    setSelectedId(null);
    setUiMode("idle");
  }, [gl.domElement, setControlsLocked]);

  // ── Begin grab ────────────────────────────────────────────────────────────
  const beginGrabRef = useRef(
    (_sid: string, _body: CANNON.Body, _px: number, _pz: number, _pid: number) => {}
  );
  beginGrabRef.current = (specId, body, pickX, pickZ, pointerId) => {
    const world = worldRef.current;
    const spec  = blocksRef.current.find((s) => s.id === specId);
    if (!world || !spec) return;

    // Zero out velocity so the block doesn't lurch when grabbed
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.angularDamping = 0.99; // strongly resist rotation while dragging

    const blockExtentAlongSlide =
      Math.abs(spec.slide[0]) * spec.size[0] + Math.abs(spec.slide[2]) * spec.size[2];
    const stackThreshold = blockExtentAlongSlide + 0.3;

    dragRef.current = {
      specId, body,
      slideAxis:      new THREE.Vector3(...spec.slide).normalize(),
      initialBodyPos: { x: body.position.x, y: body.position.y, z: body.position.z },
      initialPickX:   pickX,
      initialPickZ:   pickZ,
      pointerId,
      stackThreshold,
    };
    setUiMode("dragging");
    try { gl.domElement.setPointerCapture(pointerId); } catch { /* ignore */ }
  };

  // ── Block pointer-down ────────────────────────────────────────────────────
  const onBlockPointerDownRef = useRef(
    (_sid: string, _b: CANNON.Body, _px: number, _pz: number,
     _cx: number, _cy: number, _pid: number) => {}
  );
  onBlockPointerDownRef.current = (specId, body, pickX, pickZ, clientX, clientY, pointerId) => {
    // If a different block is already selected, lock interaction to that block only
    if (selectedIdRef.current !== null && selectedIdRef.current !== specId) return;
    if (selectedIdRef.current !== specId) {
      selectedIdRef.current = specId;
      setSelectedId(specId);
      setHoveredId(null);
      pendingDragRef.current = null;
      setUiMode("selected");
      setControlsLocked(true);
      freezeOtherBodiesRef.current(specId);
      return;
    }
    pendingDragRef.current = { specId, body, pickX, pickZ, clientX, clientY, pointerId };
  };

  // ── Pointer-down ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary || dragRef.current || gameOverRef.current) return;
      const ndc = ndcFromEvent(e);
      const hit = pickRef.current(ndc);

      if (!hit) {
        if (selectedIdRef.current !== null) {
          e.stopImmediatePropagation();
          pendingDragRef.current = null;
          unfreezeAllBodiesRef.current();
          selectedIdRef.current = null;
          setSelectedId(null);
          setUiMode("idle");
          setControlsLocked(false);
        }
        return;
      }

      const bid  = (hit.object as THREE.Mesh).userData?.blockId as string | undefined;
      if (!bid) return;
      const body = bodiesRef.current.get(bid);
      if (!body) return;

      // Block is in the top 3 layers — cannot be pulled (Jenga rule).
      // Use the reliable counter rather than body positions.
      const currentTopIndex = PHYSICS_TOWER_LAYERS + Math.floor(autoStackCountRef.current / 3);
      const protectedAboveY = (currentTopIndex - 3) * LAYOUT_H;
      if (body.position.y > protectedAboveY) return;

      e.stopImmediatePropagation();
      onBlockPointerDownRef.current(bid, body, hit.point.x, hit.point.z,
        e.clientX, e.clientY, e.pointerId);
    };

    el.addEventListener("pointerdown", onDown, { capture: true });
    return () => el.removeEventListener("pointerdown", onDown, { capture: true });
  }, [gl.domElement, ndcFromEvent, setControlsLocked]);

  // ── Pointer-move / up / leave ─────────────────────────────────────────────
  useEffect(() => {
    const el = gl.domElement;

    const onMove = (e: PointerEvent) => {
      const ndc = ndcFromEvent(e);
      mouseNDCRef.current.copy(ndc);

      if (!dragRef.current && !selectedIdRef.current) {
        const hit = pickRef.current(ndc);
        const hid = (hit?.object as THREE.Mesh | undefined)?.userData?.blockId;
        setHoveredId(typeof hid === "string" ? hid : null);
      }

      const p = pendingDragRef.current;
      if (p) {
        const dx = e.clientX - p.clientX;
        const dy = e.clientY - p.clientY;
        if (dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          pendingDragRef.current = null;
          beginGrabRef.current(p.specId, p.body, p.pickX, p.pickZ, p.pointerId);
        }
      }
    };

    const onUp    = () => { if (dragRef.current) endDrag(); else pendingDragRef.current = null; };
    const onLeave = () => setHoveredId(null);

    el.addEventListener("pointermove",  onMove);
    el.addEventListener("pointerup",    onUp);
    el.addEventListener("pointercancel",onUp);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove",  onMove);
      el.removeEventListener("pointerup",    onUp);
      el.removeEventListener("pointercancel",onUp);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [gl.domElement, ndcFromEvent, endDrag]);

  // ── Reset on nonce change ─────────────────────────────────────────────────
  useLayoutEffect(() => {
    dragRef.current          = null;
    pendingDragRef.current   = null;
    selectedIdRef.current    = null;
    autoStackCountRef.current = relocatedBlocks.length;
    gameOverRef.current      = false;
    gameOverCountRef.current = 0;
    setUiMode("idle");
    setHoveredId(null);
    setSelectedId(null);
    setPullCount(0);
    setControlsLocked(false);
    const snap = () => {
      const c = controlsRef.current;
      if (!c) return;
      c.enabled = true;
      c.target.set(...ORBIT_TARGET);
      c.object.position.set(5.5, 4.5, 7.8);
      c.update();
    };
    snap();
    const id = requestAnimationFrame(snap);
    return () => cancelAnimationFrame(id);
  }, [resetNonce, removedKey, relocKey, setControlsLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onStatus?.({ mode: uiMode, blocks: blocks.length, selectedId, pullCount });
  }, [uiMode, blocks.length, selectedId, pullCount, onStatus]);

  useEffect(() => { gl.domElement.style.touchAction = "none"; }, [gl.domElement]);

  // ── Register callbacks ────────────────────────────────────────────────────
  const registerGroup = useCallback((id: string, g: THREE.Group | null) => {
    if (g) groupsRef.current.set(id, g);
    else   groupsRef.current.delete(id);
  }, []);

  const registerPickMesh = useCallback((id: string, m: THREE.Mesh | null) => {
    if (m) pickMeshesRef.current.set(id, m);
    else   pickMeshesRef.current.delete(id);
  }, []);

  // ── Physics + mesh sync loop ──────────────────────────────────────────────
  useFrame((_, delta) => {
    const world = worldRef.current;
    if (!world) return;

    const drag = dragRef.current;
    if (drag) {
      // Move pointer body along slide axis to follow mouse
      raycaster.setFromCamera(mouseNDCRef.current, camera);
      const hPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -drag.initialBodyPos.y);
      const hit    = new THREE.Vector3();
      let bodyProjected = 0;

      if (raycaster.ray.intersectPlane(hPlane, hit)) {
        const projected =
          (hit.x - drag.initialPickX) * drag.slideAxis.x +
          (hit.z - drag.initialPickZ) * drag.slideAxis.z;

        // Direct-velocity control: set velocity = gain × error_along_slide.
        // This bypasses the friction solver entirely — no spring vs friction arms-race.
        bodyProjected =
          (drag.body.position.x - drag.initialBodyPos.x) * drag.slideAxis.x +
          (drag.body.position.z - drag.initialBodyPos.z) * drag.slideAxis.z;
        const err   = projected - bodyProjected;
        const speed = Math.min(Math.abs(err * DRAG_VELOCITY_GAIN), DRAG_MAX_SPEED) * Math.sign(err);
        drag.body.velocity.x = drag.slideAxis.x * speed;
        drag.body.velocity.z = drag.slideAxis.z * speed;
        drag.body.velocity.y *= 0.8; // damp vertical bounce
        drag.body.angularVelocity.scale(0.5, drag.body.angularVelocity);
      }

      // ── Auto-stack: block itself has physically cleared the tower ──
      // Check bodyProjected (how far the block moved), NOT the pointer position.
      // With the speed cap the pointer can race ahead while the block is still inside.
      if (Math.abs(bodyProjected) >= drag.stackThreshold) {
        const spec = blocksRef.current.find((s) => s.id === drag.specId);
        if (spec) {
          const { x, z, quat } = computeStackSlot(autoStackCountRef.current, spec);

          // Spawn Y: just above the highest block currently on the table
          // so the block settles correctly even when the tower has shifted.
          let towerTopSurface = PHYSICS_TOWER_LAYERS * LAYOUT_H;
          bodiesRef.current.forEach((body, id) => {
            if (id !== drag.specId &&
                body.position.y > 0.3 &&
                Math.hypot(body.position.x, body.position.z) < 2.4) {
              const surf = body.position.y + LAYOUT_H / 2;
              if (surf > towerTopSurface) towerTopSurface = surf;
            }
          });
          const spawnY = towerTopSurface + LAYOUT_H / 2 + 0.25;

          drag.body.position.set(x, spawnY, z);
          drag.body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
          drag.body.velocity.set(0, 0, 0);
          drag.body.angularVelocity.set(0, 0, 0);
          drag.body.linearDamping  = BLOCK_LINEAR_DAMPING;
          drag.body.angularDamping = BLOCK_ANGULAR_DAMPING;

          autoStackCountRef.current += 1;
          // Reset game-over counter — successful pull means the tower is still standing.
          gameOverCountRef.current = 0;
          setPullCount((n) => n + 1);

          // Unfreeze all bodies so the tower physics resumes after the pull.
          unfreezeAllBodiesRef.current();
          // Snap the protected top-3 original layers straight after each auto-stack.
          snapTower();
        }

        try { gl.domElement.releasePointerCapture(drag.pointerId); } catch { /* ignore */ }
        dragRef.current = null;
        setControlsLocked(false);
        selectedIdRef.current = null;
        setSelectedId(null);
        setUiMode("idle");
      }
    }

    world.step(FIXED_STEP, delta, MAX_SUB_STEPS);

    // Sync cannon body transforms → Three.js groups, capture snapshot
    bodiesRef.current.forEach((body, id) => {
      const group = groupsRef.current.get(id);
      if (!group) return;
      const { x: px, y: py, z: pz }       = body.position;
      const { x: qx, y: qy, z: qz, w: qw } = body.quaternion;
      group.position.set(px, py, pz);
      group.quaternion.set(qx, qy, qz, qw);
      snapshotRef.current.set(id, {
        pos:  [px, py, pz],
        quat: [qx, qy, qz, qw],
      });
    });

    // ── Game-over detection ───────────────────────────────────────────────────
    if (!gameOverRef.current && bodiesRef.current.size >= 3) {
      // Instant loss: any block OTHER than the one being dragged falls off the table.
      // This catches accidental nudges that send a block off the edge.
      bodiesRef.current.forEach((body, id) => {
        if (gameOverRef.current) return;
        if (drag && id === drag.specId) return; // ignore the block the player is holding
        const { x, y, z } = body.position;
        if (y < -0.42 || Math.hypot(x, z) > 2.9) {
          gameOverRef.current = true;
          gameOverCountRef.current = 0;
          setUiMode("gameover");
        }
      });

      // Sustained loss: tower has fully or partially collapsed — tallest on-table
      // block stays below 1.5 units for ~45 consecutive frames (~0.75 s).
      // Don't count while a block is being dragged — sagging blocks during a pull are expected.
      if (!gameOverRef.current && !drag) {
        let maxTableY = 0;
        bodiesRef.current.forEach((body) => {
          const { x, y, z } = body.position;
          if (y > 0 && Math.hypot(x, z) < 6) {
            if (y > maxTableY) maxTableY = y;
          }
        });

        if (maxTableY > 0 && maxTableY < 1.5) {
          gameOverCountRef.current += 1;
          if (gameOverCountRef.current >= 45) {
            gameOverRef.current = true;
            gameOverCountRef.current = 0;
            setUiMode("gameover");
          }
        } else {
          gameOverCountRef.current = 0;
        }
      }
    }
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[5, 12, 8]} intensity={1.2} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-far={50} shadow-camera-left={-8} shadow-camera-right={8}
        shadow-camera-top={9} shadow-camera-bottom={-4} color="#fff5e8" />
      <directionalLight position={[-5, 5, -3]} intensity={0.28} color="#5c3d28" />
      <pointLight position={[2, 6, 4]} intensity={0.25} color="#ffd4a8" distance={20} decay={2} />

      <OrbitControls ref={controlsRef} makeDefault target={ORBIT_TARGET}
        enablePan={false} enableDamping dampingFactor={0.08}
        minDistance={3.2} maxDistance={18}
        minPolarAngle={0.42} maxPolarAngle={Math.PI / 2 - 0.14}
        rotateSpeed={0.85} zoomSpeed={0.9}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }} />

      {/* Table surface — slightly smaller so the glowing edge is obviously reachable */}
      <mesh position={[0, -0.07, 0]} receiveShadow>
        <boxGeometry args={[5.6, 0.14, 5.6]} />
        <meshStandardMaterial color="#1a1512" roughness={0.92} metalness={0.05}
          emissive="#200808" emissiveIntensity={0.06} />
      </mesh>

      {/* Glowing border strips around the table top — visual cue: pull the block past this edge */}
      {/* Along +Z and -Z edges */}
      <mesh position={[0, 0.01, 2.76]} renderOrder={2}>
        <boxGeometry args={[5.6, 0.05, 0.08]} />
        <meshStandardMaterial color="#cc1515" emissive="#ff2020" emissiveIntensity={1.2}
          toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.01, -2.76]} renderOrder={2}>
        <boxGeometry args={[5.6, 0.05, 0.08]} />
        <meshStandardMaterial color="#cc1515" emissive="#ff2020" emissiveIntensity={1.2}
          toneMapped={false} />
      </mesh>
      {/* Along +X and -X edges */}
      <mesh position={[2.76, 0.01, 0]} renderOrder={2}>
        <boxGeometry args={[0.08, 0.05, 5.6]} />
        <meshStandardMaterial color="#cc1515" emissive="#ff2020" emissiveIntensity={1.2}
          toneMapped={false} />
      </mesh>
      <mesh position={[-2.76, 0.01, 0]} renderOrder={2}>
        <boxGeometry args={[0.08, 0.05, 5.6]} />
        <meshStandardMaterial color="#cc1515" emissive="#ff2020" emissiveIntensity={1.2}
          toneMapped={false} />
      </mesh>

      {blocks.map((spec) => (
        <BlockMesh key={spec.id} spec={spec}
          matNormal={matNormal} matHover={matHover}
          hoveredId={hoveredId} selectedId={selectedId}
          registerGroup={registerGroup} registerPickMesh={registerPickMesh} />
      ))}
    </>
  );
}
