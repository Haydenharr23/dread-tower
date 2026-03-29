"use client";

import { Suspense, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { RotateCcw, Boxes } from "lucide-react";
import Link from "next/link";
import {
  PhysicsTowerScene,
  type PhysicsTowerStatus,
} from "./PhysicsTowerScene";
import { PHYSICS_BLOCK_COUNT } from "./towerLayout";
import {
  clearTowerLabState,
  loadTowerLabState,
  type RelocatedBlock,
} from "./towerLabPersistence";

const FOREST_BG = "url(/images/tower-forest-bg.png)";

function SceneReady({
  resetNonce,
  removedBlockIds,
  relocatedBlocks,
  onStatus,
}: {
  resetNonce: number;
  removedBlockIds: string[];
  relocatedBlocks: RelocatedBlock[];
  onStatus: (s: PhysicsTowerStatus) => void;
}) {
  return (
    <PhysicsTowerScene
      resetNonce={resetNonce}
      removedBlockIds={removedBlockIds}
      relocatedBlocks={relocatedBlocks}
      onStatus={onStatus}
    />
  );
}

export function DreadJengaLab() {
  const [resetNonce, setResetNonce] = useState(0);
  const [removedBlockIds, setRemovedBlockIds] = useState<string[]>(
    () => loadTowerLabState()?.removedIds ?? []
  );
  const [relocatedBlocks, setRelocatedBlocks] = useState<RelocatedBlock[]>(
    () => loadTowerLabState()?.relocated ?? []
  );
  const [status, setStatus] = useState<PhysicsTowerStatus>(() => ({
    mode: "idle",
    blocks: PHYSICS_BLOCK_COUNT - (loadTowerLabState()?.removedIds.length ?? 0),
    selectedId: null,
  }));

  const onStatus = useCallback((s: PhysicsTowerStatus) => setStatus(s), []);

  const reset = () => {
    clearTowerLabState();
    setRemovedBlockIds([]);
    setRelocatedBlocks([]);
    setResetNonce((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-background text-[#f2f2f2] flex flex-col">
      <header className="border-b border-border px-4 py-4 flex flex-wrap items-center justify-between gap-3 bg-card/80 backdrop-blur-sm relative z-20">
        <div className="flex items-center gap-2">
          <Boxes className="w-7 h-7 text-blood-bright" strokeWidth={1.5} />
          <div>
            <h1 className="font-display text-xl sm:text-2xl text-blood-light tracking-wide">
              Tower lab
            </h1>
            <p className="text-muted text-base font-body leading-relaxed">
              Tap a block to select, tap again and drag to pull it out. Pull past the
              red edge and it snaps to the top. Two fingers to orbit / zoom.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="text-sm font-body text-muted hover:text-blood-bright transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-blood/50"
          >
            ← Home
          </Link>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 text-sm font-body px-3 py-1.5 rounded-lg bg-blood hover:bg-blood-light text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Rebuild tower
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row min-h-0 overflow-hidden">
        <div className="relative isolate flex min-h-[min(62dvh,720px)] w-full flex-1 lg:min-h-0" style={{ touchAction: "none" }}>
          <div
            className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
            style={{ backgroundImage: FOREST_BG }}
            aria-hidden
          />
          {status.mode === "gameover" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-sm">
              <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-5 max-w-xs mx-4 shadow-2xl">
                <p className="text-5xl">💀</p>
                <h2 className="font-display text-3xl text-blood-bright tracking-wide">Tower fell!</h2>
                <p className="font-body text-muted text-sm leading-relaxed">
                  The tower has collapsed. Pull yourself together and try again.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 text-sm font-body px-4 py-2.5 rounded-lg bg-blood hover:bg-blood-light text-white transition-colors w-full justify-center"
                >
                  <RotateCcw className="w-4 h-4" />
                  Rebuild tower
                </button>
              </div>
            </div>
          )}
          <Canvas
            shadows
            className="!absolute inset-0 z-10 block h-full w-full touch-none !bg-transparent"
            style={{ background: "transparent", width: "100%", height: "100%" }}
            dpr={[1, 2]}
            resize={{ scroll: true, debounce: { scroll: 80, resize: 40 } }}
            eventPrefix="client"
            gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
            camera={{ position: [4.0, 3.15, 5.6], fov: 44, near: 0.1, far: 80 }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          >
            <Suspense fallback={null}>
              <SceneReady
                resetNonce={resetNonce}
                removedBlockIds={removedBlockIds}
                relocatedBlocks={relocatedBlocks}
                onStatus={onStatus}
              />
            </Suspense>
          </Canvas>
        </div>

        <aside className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border p-5 space-y-4 font-body bg-card/40 relative z-20">
          <div className="rounded-xl border border-border bg-input/30 p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-blood-bright/90">Physics lab</p>
            <p className="text-sm text-muted">
              Blocks in stack:{" "}
              <span className="text-[#e8e8e8] font-semibold tabular-nums">{status.blocks}</span>
            </p>
            <p className="text-sm text-muted">
              Input:{" "}
              <span className="text-[#e8e8e8] font-semibold capitalize">{status.mode}</span>
            </p>
            {status.selectedId && (
              <p className="text-sm text-muted">
                Selected:{" "}
                <span className="text-blood-bright font-mono text-xs">{status.selectedId}</span>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-input/30 p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-blood-bright/90">How to play</p>
            <ul className="text-sm text-muted list-disc list-inside space-y-1.5 leading-relaxed">
              <li>Tap a block to select it (red outline).</li>
              <li>Tap again and drag to pull it out.</li>
              <li>Pull past the red table edge — it snaps to the top.</li>
              <li>Two fingers to orbit; pinch to zoom.</li>
            </ul>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Tower state saves automatically when you leave. Use{" "}
            <span className="text-blood-light/90">Rebuild tower</span> to start fresh.
            Tweak <code className="text-blood-light/90">PHYSICS_TOWER_LAYERS</code> in{" "}
            <code className="text-blood-light/90">towerLayout.ts</code> for a taller stack.
          </p>
        </aside>
      </div>
    </div>
  );
}
