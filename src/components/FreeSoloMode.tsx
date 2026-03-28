"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, User, Swords, Gauge, RotateCcw, Boxes, Target, Loader2 } from "lucide-react";
import {
  FREE_SOLO_STORIES,
  jengaCollapseChance,
  resolveFreeSoloChoice,
  type FreeSoloStory,
  type FreeSoloChoice,
  type FreeSoloOutcome,
} from "@/data/freeSoloStories";
import { AiRichText } from "@/components/AiRichText";

type Phase = "story" | "character" | "play" | "done";

export function FreeSoloMode({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("story");
  const [storyId, setStoryId] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [endingText, setEndingText] = useState<string | null>(null);
  const [jengaPulls, setJengaPulls] = useState(0);
  const [pendingPull, setPendingPull] = useState<FreeSoloChoice | null>(null);
  const [pullAnimating, setPullAnimating] = useState(false);
  const [pullOutcome, setPullOutcome] = useState<"success" | "fail" | null>(null);

  const story = useMemo(
    () => FREE_SOLO_STORIES.find((s) => s.id === storyId) ?? null,
    [storyId]
  );

  const character = useMemo(() => {
    if (!story || !characterId) return null;
    return story.characters.find((c) => c.id === characterId) ?? null;
  }, [story, characterId]);

  const scene = story && sceneIndex >= 0 ? story.scenes[sceneIndex] : null;

  const applyOutcome = useCallback(
    (out: FreeSoloOutcome) => {
      setScore((x) => x + out.scoreDelta);
      if (out.nextSceneIndex < 0) {
        setEndingText(out.endingText ?? scene?.text ?? "The story ends.");
        setPhase("done");
        return;
      }
      if (!story || out.nextSceneIndex >= story.scenes.length) {
        setEndingText("The story ends here.");
        setPhase("done");
        return;
      }
      setSceneIndex(out.nextSceneIndex);
    },
    [story, scene?.text]
  );

  const reset = () => {
    setPhase("story");
    setStoryId(null);
    setCharacterId(null);
    setSceneIndex(0);
    setScore(0);
    setEndingText(null);
    setJengaPulls(0);
    setPendingPull(null);
    setPullAnimating(false);
    setPullOutcome(null);
  };

  const pickStory = (s: FreeSoloStory) => {
    setStoryId(s.id);
    setSceneIndex(0);
    setScore(0);
    setEndingText(null);
    setJengaPulls(0);
    setPendingPull(null);
    setPullOutcome(null);
    setPhase("character");
  };

  const pickCharacter = (id: string) => {
    setCharacterId(id);
    setPhase("play");
  };

  const onChoose = (ch: FreeSoloChoice) => {
    if (ch.requiresPull && ch.onPullSuccess && ch.onPullFailure) {
      setPendingPull(ch);
      setPullOutcome(null);
      return;
    }
    applyOutcome(resolveFreeSoloChoice(ch, true));
  };

  const handleJengaPull = () => {
    if (!pendingPull || pullAnimating) return;
    setPullAnimating(true);
    const attemptNumber = jengaPulls + 1;
    const collapseChance = jengaCollapseChance(jengaPulls);
    const success = Math.random() >= collapseChance;
    setJengaPulls(attemptNumber);
    const out = resolveFreeSoloChoice(pendingPull, success);
    setPullOutcome(success ? "success" : "fail");
    setPendingPull(null);
    applyOutcome(out);
    setPullAnimating(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex justify-center mb-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted hover:text-blood-light font-body underline underline-offset-4"
        >
          ← Change mode
        </button>
      </div>

      {phase === "story" && (
        <section className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-black/50">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blood/60 to-transparent" />
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-2 text-blood-light flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Select story
          </h2>
          <p className="text-muted text-base mb-6 font-body leading-relaxed">
            Three choices per beat. At the table, pull from a real Jenga tower when the app asks—then tap the button so the
            outcome matches the tower (no AI).
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {FREE_SOLO_STORIES.map((s) => (
              <motion.button
                key={s.id}
                type="button"
                onClick={() => pickStory(s)}
                className="rounded-2xl border border-blood/40 bg-blood/10 hover:bg-blood/20 p-5 text-left transition-colors"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <span className="font-display text-xl font-semibold text-blood-light block mb-1">{s.title}</span>
                <span className="text-muted text-base font-body leading-relaxed">{s.blurb}</span>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {phase === "character" && story && (
        <section className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-black/50">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blood/60 to-transparent" />
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-2 text-blood-light flex items-center gap-2">
            <User className="w-5 h-5" />
            Select character
          </h2>
          <p className="text-muted text-base mb-2 font-body leading-relaxed">
            <span className="text-[#e0e0e0] font-medium">{story.title}</span> — who are you playing?
          </p>
          <div className="space-y-3 mt-6">
            {story.characters.map((c) => (
              <motion.button
                key={c.id}
                type="button"
                onClick={() => pickCharacter(c.id)}
                className="w-full rounded-xl border border-border bg-input/50 hover:bg-input p-4 text-left"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <span className="font-semibold text-blood-light block">{c.name}</span>
                <span className="text-base text-muted font-body leading-relaxed">{c.tagline}</span>
              </motion.button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPhase("story")}
            className="mt-6 text-sm text-muted hover:text-blood-light font-body underline underline-offset-4"
          >
            ← Back to stories
          </button>
        </section>
      )}

      {(phase === "play" || phase === "done") && story && character && (
        <section className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-black/50">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blood/60 to-transparent" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="font-display text-2xl font-semibold text-blood-light flex items-center gap-2">
                <Swords className="w-5 h-5 shrink-0" />
                {phase === "done" ? "Ending" : "Scene"}
              </h2>
              <p className="text-base text-muted font-body mt-1">
                {character.name} · {story.title}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <div className="flex items-center gap-2 rounded-lg border border-blood/35 bg-blood/10 px-3 py-2 text-sm text-muted font-body">
                <Gauge className="w-4 h-4 text-blood-bright shrink-0" aria-hidden />
                <span>
                  Tension: <span className="text-[#e8e8e8] font-semibold tabular-nums">{score}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-blood/35 bg-blood/10 px-3 py-2 text-sm text-muted font-body">
                <Boxes className="w-4 h-4 text-blood-bright shrink-0" aria-hidden />
                <span>
                  Tower pulls: <span className="text-[#e8e8e8] font-semibold tabular-nums">{jengaPulls}</span>
                </span>
              </div>
            </div>
          </div>

          {phase === "play" && pullOutcome && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 rounded-xl border px-4 py-3 text-base font-body ${
                pullOutcome === "success"
                  ? "border-emerald-700/60 bg-emerald-950/35 text-emerald-100"
                  : "border-blood bg-blood/20 text-red-100"
              }`}
              role="status"
            >
              {pullOutcome === "success" ? (
                <span>
                  <strong className="font-semibold">Pull succeeded.</strong> The tower still stands—the next scene follows.
                </span>
              ) : (
                <span>
                  <strong className="font-semibold">The tower fell.</strong> The next scene follows the collapse.
                </span>
              )}
            </motion.div>
          )}

          {phase === "play" && scene && (
            <div className="space-y-8">
              <div className="input-text rounded-xl border border-border bg-input/70 p-5 sm:p-6 min-h-[8rem] text-lg leading-[1.75] text-[#f2f2f2] shadow-inner">
                <AiRichText text={scene.text} />
              </div>
              {scene.choices.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-base uppercase tracking-wider text-muted font-body">Choose</div>
                  <ul className="flex flex-col gap-2">
                    {scene.choices.map((ch, i) => (
                      <motion.li key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setPullOutcome(null);
                            onChoose(ch);
                          }}
                          disabled={!!pendingPull}
                          className="w-full text-left input-text rounded-lg border border-border/80 bg-input/35 px-4 py-3.5 text-base text-[#ececec] hover:bg-input/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
                        >
                          <span className="text-blood-bright font-semibold mr-2">{i + 1}.</span>
                          {ch.label}
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted text-base font-body">No choices—use Reset to replay.</p>
              )}
            </div>
          )}

          {phase === "done" && endingText && (
            <div className="space-y-6">
              {pullOutcome && (
                <div
                  className={`rounded-xl border px-4 py-3 text-base font-body ${
                    pullOutcome === "success"
                      ? "border-emerald-700/60 bg-emerald-950/35 text-emerald-100"
                      : "border-blood bg-blood/20 text-red-100"
                  }`}
                  role="status"
                >
                  {pullOutcome === "success" ? (
                    <span>
                      <strong className="font-semibold">Last pull succeeded.</strong> This ending follows that pull.
                    </span>
                  ) : (
                    <span>
                      <strong className="font-semibold">The tower fell.</strong> This ending follows that pull.
                    </span>
                  )}
                </div>
              )}
              <div className="input-text rounded-xl border border-blood/40 bg-blood/10 p-5 sm:p-6 text-lg leading-[1.75] text-[#f2f2f2] shadow-inner">
                <AiRichText text={endingText} />
              </div>
              <p className="text-base text-muted font-body">
                Final tension: <span className="text-[#e8e8e8] font-semibold">{score}</span>
                {" · "}
                Tower pulls: <span className="text-[#e8e8e8] font-semibold">{jengaPulls}</span>
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-border/70">
            <motion.button
              type="button"
              onClick={reset}
              className="rounded-lg border border-border/90 bg-transparent text-[#d0d0d0] px-4 py-2.5 text-sm font-semibold hover:bg-input/40 transition-colors inline-flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RotateCcw className="w-4 h-4" />
              Start over
            </motion.button>
            {phase === "play" && (
              <button
                type="button"
                onClick={() => setPhase("character")}
                className="text-sm text-muted hover:text-blood-light font-body underline underline-offset-4"
              >
                ← Change character
              </button>
            )}
          </div>
        </section>
      )}

      <AnimatePresence>
        {pendingPull && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="max-w-md w-full rounded-2xl border border-blood/60 bg-card/98 p-6 sm:p-8 shadow-2xl shadow-black/80"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", damping: 26 }}
            >
              <h3 className="font-display text-2xl text-blood-light mb-2 flex items-center gap-2">
                <Boxes className="w-6 h-6 text-blood-bright shrink-0" />
                Pull from the tower
              </h3>
              <p className="text-base text-[#dedede] mb-4 font-body leading-relaxed">
                <AiRichText text={pendingPull.pullContext ?? pendingPull.label} />
              </p>
              <p className="text-base text-muted mb-6 font-body leading-relaxed">
                Pull one block from the tower with one hand at the table. If the tower collapses, use the failure outcome
                in the story. Tap the button after you know the result.
              </p>
              <motion.button
                type="button"
                onClick={handleJengaPull}
                disabled={pullAnimating}
                className="w-full rounded-xl border border-blood bg-blood text-white py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                whileHover={{ scale: pullAnimating ? 1 : 1.02 }}
                whileTap={{ scale: pullAnimating ? 1 : 0.98 }}
              >
                {pullAnimating ? (
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
