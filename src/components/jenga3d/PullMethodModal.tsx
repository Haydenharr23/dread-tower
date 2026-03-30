"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { motion, AnimatePresence } from "framer-motion";
import { Boxes, Target, Zap, Loader2, RotateCcw } from "lucide-react";
import { PhysicsTowerScene, type PhysicsTowerStatus } from "./PhysicsTowerScene";
import { loadTowerLabState, type RelocatedBlock } from "./towerLabPersistence";
import { jengaCollapseChance } from "@/data/freeSoloStories";
import { AiRichText } from "@/components/AiRichText";

const FOREST_BG = "url(/images/tower-forest-bg.png)";

type Phase = "picking" | "lab" | "classic" | "skip";

export type PullMethodModalProps = {
  /** Flavor text shown at the top — the pull context from the AI or story. */
  context: string;
  /** How many pulls have already happened this session (for collapse-odds scaling). */
  jengaPulls: number;
  /** Called once with true = success, false = tower fell. */
  onResult: (success: boolean) => void;
};

// ─── Embedded 3D lab view ─────────────────────────────────────────────────────
function LabView({ onResult }: { onResult: (success: boolean) => void }) {
  const [resetNonce, setResetNonce] = useState(0);
  const [removedBlockIds] = useState<string[]>(
    () => loadTowerLabState()?.removedIds ?? []
  );
  const [relocatedBlocks] = useState<RelocatedBlock[]>(
    () => loadTowerLabState()?.relocated ?? []
  );
  const [status, setStatus] = useState<PhysicsTowerStatus>({
    mode: "idle",
    blocks: 0,
    selectedId: null,
    pullCount: 0,
  });
  const resolvedRef   = useRef(false);
  const prevPullCount = useRef(0);

  // Detect successful pull
  useEffect(() => {
    if (resolvedRef.current) return;
    if (status.pullCount > prevPullCount.current) {
      prevPullCount.current = status.pullCount;
      resolvedRef.current   = true;
      // Small delay so the block is visibly landing before the modal closes.
      const id = setTimeout(() => onResult(true), 900);
      return () => clearTimeout(id);
    }
  }, [status.pullCount, onResult]);

  const handleGameOverContinue = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onResult(false);
  };

  const handleRebuild = () => {
    resolvedRef.current   = false;
    prevPullCount.current = 0;
    setResetNonce((n) => n + 1);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <p className="text-xs text-muted font-body px-5 py-2 shrink-0">
        Select a block, then drag it out. Pull past the edge — it snaps to the top.
        If the tower falls, your action fails.
      </p>

      <div className="relative flex-1 min-h-0" style={{ touchAction: "none" }}>
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{ backgroundImage: FOREST_BG }}
          aria-hidden
        />

        {/* Gameover overlay */}
        {status.mode === "gameover" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-center space-y-4 px-4">
              <p className="text-4xl">💀</p>
              <p className="font-display text-2xl text-blood-bright">Tower fell.</p>
              <motion.button
                type="button"
                onClick={handleGameOverContinue}
                className="rounded-xl border border-blood bg-blood text-white px-6 py-2.5 font-semibold text-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Continue
              </motion.button>
            </div>
          </div>
        )}

        {/* Three.js canvas */}
        <Canvas
          shadows
          className="!absolute inset-0 z-10 block h-full w-full touch-none !bg-transparent"
          style={{ background: "transparent", width: "100%", height: "100%" }}
          dpr={[1, 2]}
          eventPrefix="client"
          gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
          camera={{ position: [5.5, 4.5, 7.8], fov: 44, near: 0.1, far: 80 }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <Suspense fallback={null}>
            <PhysicsTowerScene
              resetNonce={resetNonce}
              removedBlockIds={removedBlockIds}
              relocatedBlocks={relocatedBlocks}
              onStatus={setStatus}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 flex justify-between items-center border-t border-border shrink-0">
        <p className="text-xs text-muted font-body">
          {status.mode === "gameover"
            ? "Tower collapsed"
            : `Blocks: ${status.blocks}`}
        </p>
        <button
          type="button"
          onClick={handleRebuild}
          className="text-xs text-muted hover:text-blood-light font-body flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Rebuild
        </button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function PullMethodModal({ context, jengaPulls, onResult }: PullMethodModalProps) {
  const [phase, setPhase]               = useState<Phase>("picking");
  const [classicAnimating, setClassicAnimating] = useState(false);

  const handleClassicPull = () => {
    if (classicAnimating) return;
    setClassicAnimating(true);
    setTimeout(() => {
      const success = Math.random() >= jengaCollapseChance(jengaPulls);
      onResult(success);
    }, 420);
  };

  const isLab = phase === "lab";

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`w-full rounded-2xl border border-blood/60 bg-card/98 shadow-2xl shadow-black/80 overflow-hidden flex flex-col ${
          isLab ? "max-w-xl" : "max-w-md"
        }`}
        style={isLab ? { height: "min(85dvh, 680px)" } : undefined}
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", damping: 26 }}
      >
        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <h3 className="font-display text-2xl text-blood-light flex items-center gap-2">
            <Boxes className="w-6 h-6 text-blood-bright shrink-0" />
            Pull from the tower
          </h3>
          {context && (
            <p className="text-sm text-[#d4d4d4] mt-2 font-body leading-relaxed">
              <AiRichText text={context} />
            </p>
          )}
        </div>

        {/* ── Option picker ── */}
        {phase === "picking" && (
          <div className="p-6 space-y-3">
            <p className="text-sm text-muted font-body mb-4">
              How do you want to resolve this pull?
            </p>

            <motion.button
              type="button"
              onClick={() => setPhase("lab")}
              className="w-full rounded-xl border border-blood/40 bg-blood/10 hover:bg-blood/20 p-4 text-left flex items-start gap-3 transition-colors"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Boxes className="w-5 h-5 text-blood-bright shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blood-light text-sm">3D Jenga Lab</p>
                <p className="text-xs text-muted font-body mt-0.5">
                  Pull from the physics tower. Uses your saved lab state.
                </p>
              </div>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setPhase("classic")}
              className="w-full rounded-xl border border-border bg-input/30 hover:bg-input/50 p-4 text-left flex items-start gap-3 transition-colors"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Target className="w-5 h-5 text-muted shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#e8e8e8] text-sm">Classic pull</p>
                <p className="text-xs text-muted font-body mt-0.5">
                  Tap a button — the app rolls the odds for you.
                </p>
              </div>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setPhase("skip")}
              className="w-full rounded-xl border border-border bg-input/30 hover:bg-input/50 p-4 text-left flex items-start gap-3 transition-colors"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Zap className="w-5 h-5 text-muted shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#e8e8e8] text-sm">Physical tower</p>
                <p className="text-xs text-muted font-body mt-0.5">
                  Use your own real Jenga tower. Log whether it succeeded.
                </p>
              </div>
            </motion.button>
          </div>
        )}

        {/* ── 3D Lab ── */}
        {phase === "lab" && <LabView onResult={onResult} />}

        {/* ── Classic pull ── */}
        {phase === "classic" && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted font-body leading-relaxed">
              Tap the button to attempt the pull. Odds worsen with each pull.
            </p>
            <motion.button
              type="button"
              onClick={handleClassicPull}
              disabled={classicAnimating}
              className="w-full rounded-xl border border-blood bg-blood text-white py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              whileHover={{ scale: classicAnimating ? 1 : 1.02 }}
              whileTap={{ scale: classicAnimating ? 1 : 0.98 }}
            >
              {classicAnimating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resolving…
                </>
              ) : (
                <>
                  <Target className="w-5 h-5" />
                  Pull a block
                </>
              )}
            </motion.button>
            <button
              type="button"
              onClick={() => setPhase("picking")}
              className="w-full text-sm text-muted hover:text-blood-light font-body underline underline-offset-4 transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Physical tower ── */}
        {phase === "skip" && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted font-body leading-relaxed">
              Pull a block from your real tower. What happened?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                type="button"
                onClick={() => onResult(true)}
                className="rounded-xl border border-green-600/60 bg-green-900/30 hover:bg-green-900/50 text-green-300 py-3 font-semibold text-sm transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Block came free
              </motion.button>
              <motion.button
                type="button"
                onClick={() => onResult(false)}
                className="rounded-xl border border-blood/60 bg-blood/20 hover:bg-blood/30 text-blood-light py-3 font-semibold text-sm transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Tower fell
              </motion.button>
            </div>
            <button
              type="button"
              onClick={() => setPhase("picking")}
              className="w-full text-sm text-muted hover:text-blood-light font-body underline underline-offset-4 transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
