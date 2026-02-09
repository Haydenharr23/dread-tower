"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Skull,
  Moon,
  Ghost,
  Sparkles,
  BookOpen,
  Users,
  Shield,
  ListOrdered,
  Flag,
  Play,
  RotateCcw,
  ChevronRight,
  AlertCircle,
  Loader2,
  Flame,
  ScrollText,
  Swords,
  Target,
} from "lucide-react";

type TranscriptEntry = { role: string; text: string };

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`spinner ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

async function callAI(payload: object) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const raw = await res.text();
    let msg = raw || `AI request failed: ${res.status}`;
    try {
      const j = JSON.parse(raw);
      if (typeof j?.error === "string") msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg);
  }
  return res.json();
}

function EditableList({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <ol className="list-decimal list-inside space-y-2">
      {items.map((text, i) => (
        <motion.li
          key={i}
          layout
          contentEditable
          suppressContentEditableWarning
          className="outline-2 outline-dashed outline-blood p-2.5 rounded-lg min-h-[1.5em] bg-input/40 focus:outline-blood-bright transition-colors input-text"
          onInput={(e: React.FormEvent<HTMLElement>) => {
            const next = [...items];
            next[i] = (e.target as HTMLElement).textContent?.trim() ?? "";
            onChange(next);
          }}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
        >
          {text}
        </motion.li>
      ))}
    </ol>
  );
}

export default function Home() {
  const [story, setStory] = useState("");
  const [characters, setCharacters] = useState("");
  const [constraints, setConstraints] = useState("");
  const [beats, setBeats] = useState<string[]>([]);
  const [endings, setEndings] = useState<string[]>([]);
  const [beatHit, setBeatHit] = useState<boolean[]>([]);
  const [endingHit, setEndingHit] = useState<boolean[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [sceneText, setSceneText] = useState("");
  const [choices, setChoices] = useState<string[]>([]);
  const [playerInput, setPlayerInput] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enhanceLoading, setEnhanceLoading] = useState<"story" | "characters" | "constraints" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canStart = beats.length === 5 && endings.length >= 2;

  const handleGenerate = async () => {
    const s = story.trim();
    const c = characters.trim();
    if (!s || !c) {
      setError("Add a story description and character sheets first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await callAI({
        mode: "generate_plan",
        story: s,
        characters: c,
        constraints: constraints.trim(),
      });
      setBeats(data.beats ?? []);
      setEndings(data.endings ?? []);
      setBeatHit(new Array(data.beats?.length ?? 0).fill(false));
      setEndingHit(new Array(data.endings?.length ?? 0).fill(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await callAI({
        mode: "start_game",
        story: story.trim(),
        characters: characters.trim(),
        constraints: constraints.trim(),
        beats,
        endings,
      });
      setSceneText(data.sceneText ?? "");
      setChoices(data.choices ?? []);
      setTranscript([]);
      setGameStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNextScene = async () => {
    const text = playerInput.trim();
    if (!text) return;
    setError(null);
    setLoading(true);
    try {
      const data = await callAI({
        mode: "next_scene",
        story: story.trim(),
        characters: characters.trim(),
        constraints: constraints.trim(),
        beats,
        endings,
        beatHit,
        endingHit,
        playerText: text,
        transcriptTail: transcript.slice(-10),
      });
      if (Array.isArray(data.beatHit)) setBeatHit(data.beatHit);
      if (Array.isArray(data.endingHit)) setEndingHit(data.endingHit);
      setTranscript((prev) => [
        ...prev,
        { role: "players", text },
        { role: "gm", text: data.sceneText ?? "" },
      ]);
      setSceneText(data.sceneText ?? "");
      setChoices(data.choices ?? []);
      setPlayerInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => window.location.reload();

  const handleEnhance = async (field: "story" | "characters" | "constraints") => {
    const getter = field === "story" ? story : field === "characters" ? characters : constraints;
    if (!getter.trim()) {
      setError(`Add some text to ${field} first.`);
      return;
    }
    setError(null);
    setEnhanceLoading(field);
    try {
      const payload: { mode: "enhance"; field: typeof field; text: string; story?: string; characters?: string } = {
        mode: "enhance",
        field,
        text: getter,
      };
      if (field === "characters" && story.trim()) payload.story = story.trim();
      if (field === "constraints") {
        if (story.trim()) payload.story = story.trim();
        if (characters.trim()) payload.characters = characters.trim();
      }
      const data = await callAI(payload);
      const newText = data.text ?? getter;
      if (field === "story") setStory(newText);
      else if (field === "characters") setCharacters(newText);
      else setConstraints(newText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhanceLoading(null);
    }
  };

  const progressLines = [
    ...beats.map((b, i) => `${beatHit[i] ? "✓" : "•"} ${b}`),
    "",
    ...endings.map((e, i) => `${endingHit[i] ? "✓" : "•"} ${e}`),
  ].join("\n");

  return (
    <motion.main
      className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-blood/5" />
        <motion.div
          className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-blood/5 blur-3xl"
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-40 right-1/4 w-80 h-80 rounded-full bg-blood/5 blur-3xl"
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1.02, 1, 1.02] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Header */}
      <motion.header
        className="text-center mb-10"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <motion.div
          className="inline-flex items-center gap-3 mb-2"
          animate={{ opacity: [1, 0.88, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Skull className="w-10 h-10 text-blood-bright" strokeWidth={1.5} />
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wide text-blood-bright">
            Dread AI GM
          </h1>
          <Moon className="w-8 h-8 text-blood-light" strokeWidth={1.5} />
        </motion.div>
        <motion.p
          className="text-muted text-sm sm:text-base font-body flex items-center justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Ghost className="w-4 h-4" />
          Horror one-shots, AI-powered
        </motion.p>
      </motion.header>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        {/* Setup card */}
        <motion.section
          variants={item}
          className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 lg:p-10 shadow-2xl shadow-black/50"
          whileHover={{ boxShadow: "0 0 50px -12px rgba(139,0,0,0.25)" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blood/60 to-transparent" />
          <motion.h2
            className="font-display text-xl sm:text-2xl font-semibold mb-1 text-blood-light flex items-center gap-2"
            variants={item}
          >
            <Flame className="w-5 h-5" />
            Setup
          </motion.h2>
          <p className="text-muted text-sm mb-6 font-body">Step 1: Add your story and characters, then generate beats.</p>

          {/* Story */}
          <motion.div variants={item} className="mb-6">
            <label className="flex items-center gap-2 font-semibold text-[#e8e8e8] mb-2 font-body">
              <BookOpen className="w-4 h-4 text-blood-bright shrink-0" />
              <span>1. Story description</span>
              <span className="text-muted font-normal text-xs">({story.length} chars)</span>
            </label>
            <textarea
              className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y focus:ring-2 focus:ring-blood/60 focus:border-blood transition-all placeholder:text-[#6b6b6b]"
              rows={5}
              placeholder="A haunted winter lodge. Something in the walls learns your secrets..."
              value={story}
              onChange={(e) => setStory(e.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <motion.button
                type="button"
                onClick={() => handleEnhance("story")}
                disabled={!!enhanceLoading || !story.trim()}
                className="rounded-lg border border-blood bg-blood text-white px-4 py-2 flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {enhanceLoading === "story" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Enhance with AI
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* Characters */}
          <motion.div variants={item} className="mb-6">
            <label className="flex items-center gap-2 font-semibold text-[#e8e8e8] mb-2 font-body">
              <Users className="w-4 h-4 text-blood-bright shrink-0" />
              <span>2. Character sheets</span>
              <span className="text-muted font-normal text-xs">({characters.length} chars)</span>
            </label>
            <textarea
              className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y focus:ring-2 focus:ring-blood/60 focus:border-blood transition-all placeholder:text-[#6b6b6b]"
              rows={6}
              placeholder={"Name: ...\nGoal: ...\nFear: ...\nSecret: ..."}
              value={characters}
              onChange={(e) => setCharacters(e.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <motion.button
                type="button"
                onClick={() => handleEnhance("characters")}
                disabled={!!enhanceLoading || !characters.trim()}
                className="rounded-lg border border-blood bg-blood text-white px-4 py-2 flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {enhanceLoading === "characters" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Enhance with AI
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* Constraints */}
          <motion.div variants={item} className="mb-8">
            <label className="flex items-center gap-2 font-semibold text-[#e8e8e8] mb-2 font-body">
              <Shield className="w-4 h-4 text-blood-bright shrink-0" />
              <span>3. Constraints (optional)</span>
            </label>
            <textarea
              className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y focus:ring-2 focus:ring-blood/60 focus:border-blood transition-all placeholder:text-[#6b6b6b]"
              rows={3}
              placeholder="Tone: slow dread. No sexual violence. Keep it PG-13."
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <motion.button
                type="button"
                onClick={() => handleEnhance("constraints")}
                disabled={!!enhanceLoading || !constraints.trim()}
                className="rounded-lg border border-blood bg-blood text-white px-4 py-2 flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {enhanceLoading === "constraints" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Enhance with AI
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>

          <div className="rounded-xl bg-blood/10 border border-blood/30 p-4 mb-6">
            <p className="text-[#e0e0e0] text-sm font-body mb-3">Step 2: Generate beats & endings, then start the game.</p>
            <div className="flex flex-wrap gap-3 items-center">
            <motion.button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !story.trim() || !characters.trim()}
              className="rounded-xl border border-blood bg-blood text-white px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <><Spinner /> Generating…</>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Generate beats & endings
                </>
              )}
            </motion.button>
            {(!story.trim() || !characters.trim()) && !loading && (
              <span className="text-sm text-muted">Fill in 1 and 2 above first.</span>
            )}
            <motion.button
              type="button"
              onClick={handleStartGame}
              disabled={!canStart || loading}
              className="rounded-xl border border-blood bg-blood text-white px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <><Spinner /> Starting…</>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start game
                </>
              )}
            </motion.button>
          </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 pt-8 border-t border-border/80">
            <motion.div variants={item}>
              <h3 className="font-display font-semibold mb-2 text-blood-light flex items-center gap-2">
                <ListOrdered className="w-4 h-4" />
                Beats (5)
              </h3>
              <EditableList items={beats} onChange={setBeats} />
            </motion.div>
            <motion.div variants={item}>
              <h3 className="font-display font-semibold mb-2 text-blood-light flex items-center gap-2">
                <Flag className="w-4 h-4" />
                Endings (2–3)
              </h3>
              <EditableList items={endings} onChange={setEndings} />
            </motion.div>
          </div>
          <p className="text-sm text-muted mt-4 flex items-center gap-1.5 font-body">
            <ScrollText className="w-3.5 h-3.5 shrink-0" />
            Click a beat or ending to edit it.
          </p>
        </motion.section>

        {/* Play card */}
        <motion.section
          variants={item}
          className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 lg:p-10 shadow-2xl shadow-black/50"
          whileHover={{ boxShadow: "0 0 50px -12px rgba(139,0,0,0.25)" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blood/60 to-transparent" />
          <motion.h2
            className="font-display text-xl sm:text-2xl font-semibold mb-1 text-blood-light flex items-center gap-2"
            variants={item}
          >
            <Swords className="w-5 h-5" />
            Play
          </motion.h2>
          <p className="text-muted text-sm mb-5 font-body">Describe what the players do; the AI will respond with the next scene.</p>

          <motion.div variants={item}>
            <label className="flex items-center gap-2 font-semibold text-[#e8e8e8] mb-2 font-body">
              <Ghost className="w-4 h-4 text-blood-bright shrink-0" />
              Players do…
            </label>
            <textarea
              className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y focus:ring-2 focus:ring-blood/60 focus:border-blood transition-all placeholder:text-[#6b6b6b]"
              rows={4}
              placeholder="We split up to search the basement and the attic."
              value={playerInput}
              onChange={(e) => setPlayerInput(e.target.value)}
            />
          </motion.div>

          <div className="flex gap-3 mt-4 flex-wrap">
            <motion.button
              type="button"
              onClick={handleNextScene}
              disabled={!gameStarted || loading}
              className="rounded-xl border border-blood bg-blood text-white px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? <><Spinner /> Loading…</> : <><ChevronRight className="w-4 h-4" /> Next scene</>}
            </motion.button>
            <motion.button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-border bg-input/50 text-[#f2f2f2] px-5 py-2.5 flex items-center gap-2 font-semibold hover:bg-input transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </motion.button>
          </div>

          <div className="mt-6 space-y-5">
            <motion.div variants={item}>
              <h3 className="font-display font-semibold text-blood-light flex items-center gap-2 mb-2">
                <ScrollText className="w-4 h-4 shrink-0" />
                Scene
              </h3>
              <div className="input-text whitespace-pre-wrap bg-input/60 p-4 rounded-xl min-h-[6rem] border border-border">
                {sceneText || "—"}
              </div>
            </motion.div>
            <motion.div variants={item}>
              <h3 className="font-display font-semibold text-blood-light flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 shrink-0" />
                Choices
              </h3>
              <ul className="space-y-2">
                {choices.map((c, i) => (
                  <motion.li
                    key={i}
                    className="input-text flex items-center gap-2"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <span className="text-blood-bright font-semibold">›</span> {c}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={item}>
              <h3 className="font-display font-semibold text-blood-light flex items-center gap-2 mb-2">
                <Flag className="w-4 h-4 shrink-0" />
                Progress
              </h3>
              <div className="input-text whitespace-pre-wrap bg-input/60 p-4 rounded-xl border border-border font-mono text-sm">
                {progressLines || "—"}
              </div>
            </motion.div>
          </div>
        </motion.section>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-md w-full mx-4 rounded-xl bg-blood/25 border border-blood backdrop-blur-sm text-red-100 px-4 py-3 flex items-center gap-3 shadow-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25 }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-blood-bright" />
            <p className="text-sm font-body">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
