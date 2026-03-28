"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { buildTowerBlocks, type TowerBlockSpec } from "./towerLayout";
import { createDreadStoneTexture } from "./dreadStoneTexture";
import { jengaCollapseChance } from "@/data/freeSoloStories";
import { ForestBackdrop } from "./ForestBackdrop";

type SlideJob = {
  id: string;
  t0: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  pullsBefore: number;
};

type CollapseJob = {
  t0: number;
  entries: { id: string; start: THREE.Vector3; end: THREE.Vector3 }[];
};

function useDreadStoneMaterials() {
  const map = useMemo(() => createDreadStoneTexture(), []);
  const { normal, hover } = useMemo(() => {
    const base = {
      map,
      metalness: 0.2,
      roughness: 0.7,
      emissive: new THREE.Color("#3a0a12"),
    };
    const normal = new THREE.MeshStandardMaterial({
      ...base,
      emissiveIntensity: 0.2,
    });
    const hover = new THREE.MeshStandardMaterial({
      ...base,
      emissiveIntensity: 0.48,
    });
    return { normal, hover };
  }, [map]);

  useEffect(() => {
    return () => {
      map.dispose();
      normal.dispose();
      hover.dispose();
    };
  }, [map, normal, hover]);

  return { map, normal, hover };
}

function JengaBlock({
  spec,
  matNormal,
  matHover,
  removed,
  interactable,
  hoveredId,
  onHover,
  onPick,
  registerBlockRoot,
}: {
  spec: TowerBlockSpec;
  matNormal: THREE.MeshStandardMaterial;
  matHover: THREE.MeshStandardMaterial;
  removed: boolean;
  interactable: boolean;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onPick: (spec: TowerBlockSpec) => void;
  registerBlockRoot: (id: string, group: THREE.Group | null) => void;
}) {
  const edgesGeo = useMemo(() => {
    const box = new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [spec.size[0], spec.size[1], spec.size[2]]);

  useEffect(() => {
    return () => edgesGeo.dispose();
  }, [edgesGeo]);

  if (removed) return null;

  const isHover = hoveredId === spec.id;
  return (
    <group position={spec.pos}>
      <group ref={(g) => registerBlockRoot(spec.id, g)}>
        <mesh
          material={isHover ? matHover : matNormal}
          castShadow
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            if (interactable) onPick(spec);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            if (interactable) onHover(spec.id);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onHover(null);
          }}
        >
          <boxGeometry args={spec.size} />
        </mesh>
        <lineSegments geometry={edgesGeo} raycast={() => null} renderOrder={1}>
          <lineBasicMaterial
            color="#7a1a28"
            transparent
            opacity={isHover ? 0.5 : 0.26}
            depthWrite={false}
          />
        </lineSegments>
      </group>
    </group>
  );
}

export type TowerStatus = {
  completedPulls: number;
  nextCollapseChance: number;
  standing: boolean;
  lastOutcome: "success" | "collapse" | null;
};

type Props = {
  resetNonce: number;
  onStatus?: (s: TowerStatus) => void;
};

export function TowerScene({ resetNonce, onStatus }: Props) {
  const blocks = useMemo(() => buildTowerBlocks(), []);
  const { normal: matNormal, hover: matHover } = useDreadStoneMaterials();
  const wobbleRef = useRef<THREE.Group>(null);
  const blockRootMap = useRef<Map<string, THREE.Group>>(new Map());
  const slideRef = useRef<SlideJob | null>(null);
  const collapseRef = useRef<CollapseJob | null>(null);
  const pullCountRef = useRef(0);

  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [pullCount, setPullCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<"success" | "collapse" | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pullCountRef.current = pullCount;
  }, [pullCount]);

  useEffect(() => {
    blockRootMap.current.clear();
    setRemoved(new Set());
    setPullCount(0);
    setCollapsed(false);
    setLastOutcome(null);
    setHoveredId(null);
    setBusy(false);
    slideRef.current = null;
    collapseRef.current = null;
    pullCountRef.current = 0;
  }, [resetNonce]);

  useEffect(() => {
    onStatus?.({
      completedPulls: pullCount,
      nextCollapseChance: jengaCollapseChance(pullCount),
      standing: !collapsed,
      lastOutcome,
    });
  }, [pullCount, collapsed, lastOutcome, onStatus]);

  const registerBlockRoot = useCallback((id: string, group: THREE.Group | null) => {
    if (group) blockRootMap.current.set(id, group);
    else blockRootMap.current.delete(id);
  }, []);

  const interactable = !collapsed && !busy;

  const handlePick = useCallback(
    (spec: TowerBlockSpec) => {
      if (collapsed || busy) return;
      if (removed.has(spec.id)) return;
      const root = blockRootMap.current.get(spec.id);
      if (!root) return;

      setBusy(true);
      const from = root.position.clone();
      const dir = new THREE.Vector3(...spec.slide).normalize();
      const to = from.clone().add(dir.clone().multiplyScalar(2.85));
      slideRef.current = {
        id: spec.id,
        t0: performance.now(),
        from,
        to,
        pullsBefore: pullCountRef.current,
      };
      setHoveredId(null);
    },
    [collapsed, busy, removed]
  );

  useFrame((state) => {
    const wobble = wobbleRef.current;
    if (wobble && !collapsed) {
      const w = pullCountRef.current * 0.0042;
      const t = state.clock.elapsedTime;
      wobble.rotation.x = Math.sin(t * 1.15) * w;
      wobble.rotation.z = Math.cos(t * 0.88) * w * 0.78;
    }

    const slide = slideRef.current;
    if (slide) {
      const p = Math.min(1, (performance.now() - slide.t0) / 560);
      const root = blockRootMap.current.get(slide.id);
      if (root) {
        const eased = 1 - Math.pow(1 - p, 3);
        root.position.lerpVectors(slide.from, slide.to, eased);
      }
      if (p >= 1) {
        const job = slide;
        slideRef.current = null;
        const success = Math.random() >= jengaCollapseChance(job.pullsBefore);
        setPullCount((c) => {
          const next = c + 1;
          pullCountRef.current = next;
          return next;
        });
        if (success) {
          setRemoved((prev) => new Set(prev).add(job.id));
          setLastOutcome("success");
          setBusy(false);
        } else {
          setLastOutcome("collapse");
          const entries: CollapseJob["entries"] = [];
          blockRootMap.current.forEach((g, id) => {
            const start = g.position.clone();
            const end = start.clone().add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 2.8,
                -4.2 - Math.random() * 2.4,
                (Math.random() - 0.5) * 2.8
              )
            );
            entries.push({ id, start, end });
          });
          collapseRef.current = { t0: performance.now(), entries };
          setCollapsed(true);
          setBusy(false);
        }
      }
      return;
    }

    const collapse = collapseRef.current;
    if (collapse) {
      const p = Math.min(1, (performance.now() - collapse.t0) / 1900);
      const eased = p * p;
      for (const { id, start, end } of collapse.entries) {
        const g = blockRootMap.current.get(id);
        if (g) g.position.lerpVectors(start, end, eased);
      }
      if (p >= 1) collapseRef.current = null;
    }
  });

  const { gl } = useThree();
  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl]);

  return (
    <>
      <color attach="background" args={["#030204"]} />

      <ForestBackdrop />

      <ambientLight intensity={0.22} />
      <directionalLight
        position={[6, 11, 6]}
        intensity={0.75}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={45}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        color="#b9c4d8"
      />
      <pointLight position={[2.5, 2.2, 4]} intensity={0.22} color="#6a1824" distance={14} decay={2} />
      <pointLight position={[-3.5, 4.5, 2]} intensity={0.18} color="#3d0a10" distance={16} decay={2} />

      <OrbitControls
        enablePan
        minDistance={5.5}
        maxDistance={24}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.12}
        target={[0, 3.35, 0]}
        enableDamping
        dampingFactor={0.08}
      />

      <mesh position={[0, -0.07, 0]} receiveShadow raycast={() => null}>
        <boxGeometry args={[7.2, 0.14, 7.2]} />
        <meshStandardMaterial
          color="#14110e"
          roughness={0.94}
          metalness={0.06}
          emissive="#1a0808"
          emissiveIntensity={0.04}
        />
      </mesh>

      <group ref={wobbleRef} position={[0, 0.01, 0]}>
        <group>
          {blocks.map((spec) => (
            <JengaBlock
              key={spec.id}
              spec={spec}
              matNormal={matNormal}
              matHover={matHover}
              removed={removed.has(spec.id)}
              interactable={interactable}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onPick={handlePick}
              registerBlockRoot={registerBlockRoot}
            />
          ))}
        </group>
      </group>
    </>
  );
}
