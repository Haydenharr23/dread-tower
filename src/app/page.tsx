"use client";

import { useState, useEffect } from "react";
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
  Network,
  User,
  Mic,
  Boxes,
  History,
  ClipboardList,
  Lock,
} from "lucide-react";
import { AiRichText } from "@/components/AiRichText";
import { AI_PASSKEY_STORAGE_KEY, getStoredAiPasskey } from "@/lib/aiGate";
import { FreeSoloMode } from "@/components/FreeSoloMode";
import { FreeGmMode } from "@/components/FreeGmMode";

type TranscriptEntry = { role: "players" | "gm" | "tower"; text: string };
type SessionMode = "pick" | "solo" | "host" | "free_solo" | "free_gm";

/** Precomputed solo outcomes when a Jenga pull is required (one API call for both paths). */
type PullBranchPayload = {
  sceneText: string;
  choices: string[];
  beatHit: boolean[];
  endingHit: boolean[];
  gameOver?: boolean;
};

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

const DEFAULT_AI_PASSKEY =
  process.env.NEXT_PUBLIC_AI_PASSKEY?.trim() || "1234";

async function callAI(payload: object) {
  const aiPasskey = getStoredAiPasskey();
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, aiPasskey }),
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
  const [sessionMode, setSessionMode] = useState<SessionMode>("pick");
  const [hostSuggestions, setHostSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [jengaPulls, setJengaPulls] = useState(0);
  const [pendingRisk, setPendingRisk] = useState<{
    text: string;
    context: string;
    branch: { onSuccess: PullBranchPayload; onFailure: PullBranchPayload };
  } | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [pullAnimating, setPullAnimating] = useState(false);
  const [pullOutcome, setPullOutcome] = useState<"success" | "fail" | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [aiModesUnlocked, setAiModesUnlocked] = useState(false);
  const [passkeyDraft, setPasskeyDraft] = useState("");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  useEffect(() => {
  try {
    if (getStoredAiPasskey()) {
      setAiModesUnlocked(true);
    }
  } catch {
      /* private mode, etc. */
    }
  }, []);

  useEffect(() => {
    if (
      (sessionMode === "solo" || sessionMode === "host") &&
      !aiModesUnlocked
    ) {
      setSessionMode("pick");
    }
  }, [sessionMode, aiModesUnlocked]);

  const effectiveStory =
    sessionMode === "solo"
      ? `Solo horror one-shot. Protagonist:\n${characters.trim()}`
      : sessionMode === "host"
        ? story.trim()
        : "";
  const effectiveCharacters = characters.trim();
  const effectiveConstraints = constraints.trim();

  const canStart = beats.length === 5 && endings.length >= 2;

  const handleBeginSoloAdventure = async () => {
    setError(null);
    setLoading(true);
    try {
      let chars = characters.trim();
      let cons = constraints.trim();
      const data = await callAI({
        mode: "solo_begin",
        story: chars ? `Solo horror one-shot. Protagonist:\n${chars}` : "Solo horror one-shot.",
        characters: chars,
        constraints: cons,
      });
      if (typeof data.filledCharacters === "string") {
        chars = data.filledCharacters;
        setCharacters(data.filledCharacters);
      }
      if (typeof data.filledConstraints === "string") {
        cons = data.filledConstraints;
        setConstraints(data.filledConstraints);
      }
      const b = data.beats ?? [];
      const e = data.endings ?? [];
      setBeats(b);
      setEndings(e);
      setBeatHit(new Array(b.length).fill(false));
      setEndingHit(new Array(e.length).fill(false));

      const opening = data.sceneText ?? "";
      setSceneText(opening);
      setChoices(Array.isArray(data.choices) ? data.choices : []);
      setTranscript([{ role: "gm", text: opening }]);
      setHostSuggestions([]);
      setJengaPulls(0);
      setPendingRisk(null);
      setGameOver(false);
      setGameStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (sessionMode === "host" && (!story.trim() || !characters.trim())) {
      setError("Add a story description and character sheets first.");
      return;
    }
    if (sessionMode === "solo") {
      setError("Use “Begin solo adventure” for solo mode.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await callAI({
        mode: "generate_plan",
        story: effectiveStory,
        characters: effectiveCharacters,
        constraints: effectiveConstraints,
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
        story: effectiveStory,
        characters: effectiveCharacters,
        constraints: effectiveConstraints,
        beats,
        endings,
      });
      setSceneText(data.sceneText ?? "");
      setChoices(data.choices ?? []);
      setTranscript([]);
      setHostSuggestions([]);
      setGameStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNextScene = async () => {
    const text = playerInput.trim();
    if (!text || gameOver || pendingRisk) return;
    setError(null);
    if (sessionMode === "solo") setPullOutcome(null);
    setLoading(true);
    try {
      const data = await callAI({
        mode: "next_scene",
        story: effectiveStory,
        characters: effectiveCharacters,
        constraints: effectiveConstraints,
        beats,
        endings,
        beatHit,
        endingHit,
        playerText: text,
        transcriptTail: transcript.slice(-10),
        soloSession: sessionMode === "solo",
      });
      if (sessionMode === "solo" && data.requiresPull === true) {
        const pb = data.pullBranch as
          | { onSuccess: PullBranchPayload; onFailure: PullBranchPayload }
          | undefined;
        if (!pb?.onSuccess || !pb?.onFailure) {
          setError("Could not load pull outcomes. Try your action again.");
          return;
        }
        setPendingRisk({
          text,
          context: typeof data.pullContext === "string" ? data.pullContext : "",
          branch: pb,
        });
        setPlayerInput("");
        return;
      }
      if (Array.isArray(data.beatHit)) setBeatHit(data.beatHit);
      if (Array.isArray(data.endingHit)) setEndingHit(data.endingHit);
      if (sessionMode === "host") setHostSuggestions([]);
      setTranscript((prev) => [
        ...prev,
        { role: "players", text },
        { role: "gm", text: data.sceneText ?? "" },
      ]);
      setSceneText(data.sceneText ?? "");
      setChoices(data.choices ?? []);
      setPlayerInput("");
      if (data.gameOver === true) setGameOver(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleJengaPull = () => {
    if (!pendingRisk || pullAnimating || loading) return;
    const saved = pendingRisk;
    setPullAnimating(true);
    setError(null);
    const attemptNumber = jengaPulls + 1;
    const collapseChance = Math.min(0.45, 0.06 + jengaPulls * 0.03);
    const success = Math.random() >= collapseChance;
    const branch = success ? saved.branch.onSuccess : saved.branch.onFailure;
    setJengaPulls(attemptNumber);
    const riskText = saved.text;
    setPendingRisk(null);
    setBeatHit(branch.beatHit);
    setEndingHit(branch.endingHit);
    const towerLine = success
      ? "The block comes free. The tower still stands."
      : "The tower collapses.";
    setPullOutcome(success ? "success" : "fail");
    setTranscript((prev) => [
      ...prev,
      { role: "players", text: riskText },
      { role: "tower", text: towerLine },
      { role: "gm", text: branch.sceneText },
    ]);
    setSceneText(branch.sceneText);
    setChoices(Array.isArray(branch.choices) ? branch.choices : []);
    setGameOver(branch.gameOver === true || !success);
    setPullAnimating(false);
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
      const storyForEnhance = sessionMode === "solo" ? effectiveStory : story.trim();
      if (field === "characters" && storyForEnhance) payload.story = storyForEnhance;
      if (field === "constraints") {
        if (storyForEnhance) payload.story = storyForEnhance;
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

  const handleHostSuggest = async () => {
    if (sessionMode !== "host") return;
    const log = playerInput.trim();
    if (!log) {
      setError("Log what happened at the table first.");
      return;
    }
    setError(null);
    setSuggestLoading(true);
    try {
      const data = await callAI({
        mode: "host_suggestions",
        story: effectiveStory,
        characters: effectiveCharacters,
        constraints: effectiveConstraints,
        beats,
        endings,
        gmLog: log,
        transcriptTail: transcript.slice(-10),
      });
      setHostSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSuggestLoading(false);
    }
  };

  const setupReady =
    sessionMode === "host"
      ? !!(story.trim() && characters.trim())
      : sessionMode === "solo";

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
            The Dread Tower
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
          Horror one-shots — free tools or AI-assisted play
        </motion.p>
      </motion.header>

      {sessionMode === "pick" && (
        <div className="space-y-10 mb-12">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-black/50"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blood/60 to-transparent" />
            <h2 className="font-display text-xl sm:text-2xl font-semibold mb-2 text-blood-light text-center flex items-center justify-center gap-2">
              <Network className="w-6 h-6" />
              Choose mode
            </h2>
            <p className="text-muted text-sm text-center mb-8 font-body max-w-xl mx-auto">
              Free modes need no API key. AI modes use Gemini for narration or suggestions.
            </p>

            <p className="text-xs uppercase tracking-wider text-blood-bright/90 font-body mb-3 text-center">
              Free modes
            </p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-10">
              <motion.button
                type="button"
                onClick={() => setSessionMode("free_solo")}
                className="rounded-2xl border border-border bg-input/30 hover:bg-input/50 p-6 text-left transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <BookOpen className="w-8 h-8 text-blood-bright mb-3" strokeWidth={1.5} />
                <span className="font-display text-lg font-semibold text-blood-light block mb-1">Solo Story (No AI)</span>
                <span className="text-muted text-sm font-body">
                  Pick a scripted story, a character, then play scene-by-scene with a tension score—no network calls.
                </span>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setSessionMode("free_gm")}
                className="rounded-2xl border border-border bg-input/30 hover:bg-input/50 p-6 text-left transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ClipboardList className="w-8 h-8 text-blood-bright mb-3" strokeWidth={1.5} />
                <span className="font-display text-lg font-semibold text-blood-light block mb-1">GM Tools (Manual)</span>
                <span className="text-muted text-sm font-body">
                  Pick a table kit—story (with tone baked in), cast, beats, and endings auto-fill; no AI. Run with scene notes and a log.
                </span>
              </motion.button>
            </div>

            <div className="relative max-w-2xl mx-auto rounded-2xl border border-blood/30 bg-blood/5 p-4 sm:p-5">
              <p className="text-xs uppercase tracking-wider text-blood-bright/90 font-body mb-1 text-center">
                AI modes
              </p>
              <p className="text-muted text-xs text-center font-body mb-4">
                Gemini-backed — locked so random visitors don’t burn your API quota. Unlock once per browser session.
              </p>
              <div
                className={`grid sm:grid-cols-2 gap-4 ${!aiModesUnlocked ? "opacity-50 blur-[1px] pointer-events-none select-none" : ""}`}
                aria-hidden={!aiModesUnlocked}
              >
                <motion.button
                  type="button"
                  disabled={!aiModesUnlocked}
                  onClick={() => setSessionMode("solo")}
                  className="rounded-2xl border border-blood/50 bg-blood/15 hover:bg-blood/25 disabled:opacity-60 p-6 text-left transition-colors"
                  whileHover={aiModesUnlocked ? { scale: 1.02 } : undefined}
                  whileTap={aiModesUnlocked ? { scale: 0.98 } : undefined}
                >
                  <User className="w-8 h-8 text-blood-bright mb-3" strokeWidth={1.5} />
                  <span className="font-display text-lg font-semibold text-blood-light block mb-1">Solo (AI GM)</span>
                  <span className="text-muted text-sm font-body">Optional character &amp; tone → AI plans and runs the full solo loop with Jenga risk.</span>
                </motion.button>
                <motion.button
                  type="button"
                  disabled={!aiModesUnlocked}
                  onClick={() => setSessionMode("host")}
                  className="rounded-2xl border border-blood/50 bg-blood/15 hover:bg-blood/25 disabled:opacity-60 p-6 text-left transition-colors"
                  whileHover={aiModesUnlocked ? { scale: 1.02 } : undefined}
                  whileTap={aiModesUnlocked ? { scale: 0.98 } : undefined}
                >
                  <Mic className="w-8 h-8 text-blood-bright mb-3" strokeWidth={1.5} />
                  <span className="font-display text-lg font-semibold text-blood-light block mb-1">Host (AI Assistant)</span>
                  <span className="text-muted text-sm font-body">You GM at the table; AI generates setup and optional consequence suggestions.</span>
                </motion.button>
              </div>
              {!aiModesUnlocked && (
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/85 backdrop-blur-sm border border-border/80 p-4 sm:p-6"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="ai-passkey-heading"
                >
                  <form
                    className="w-full max-w-sm space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = passkeyDraft.trim();
                      if (v === DEFAULT_AI_PASSKEY) {
                        try {
                          sessionStorage.setItem(AI_PASSKEY_STORAGE_KEY, v);
                        } catch {
                          /* */
                        }
                        setAiModesUnlocked(true);
                        setPasskeyError(null);
                        setPasskeyDraft("");
                      } else {
                        setPasskeyError("Wrong passkey.");
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-2 text-blood-light">
                      <Lock className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                      <h3
                        id="ai-passkey-heading"
                        className="font-display text-base font-semibold text-center"
                      >
                        Enter passkey
                      </h3>
                    </div>
                    <p className="text-muted text-xs text-center font-body">
                      Required to use Solo (AI) and Host (AI). Free modes stay open.
                    </p>
                    <input
                      type="password"
                      name="ai-passkey"
                      autoComplete="off"
                      value={passkeyDraft}
                      onChange={(e) => {
                        setPasskeyDraft(e.target.value);
                        setPasskeyError(null);
                      }}
                      className="w-full rounded-xl border border-border bg-input/80 px-3 py-2.5 text-sm font-body input-text placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-blood/50"
                      placeholder="Passkey"
                      aria-invalid={!!passkeyError}
                    />
                    {passkeyError && (
                      <p className="text-sm text-red-400 font-body text-center" role="alert">
                        {passkeyError}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-blood/60 bg-blood/20 hover:bg-blood/30 py-2.5 text-sm font-display font-semibold text-blood-light transition-colors"
                    >
                      Unlock AI modes
                    </button>
                  </form>
                </div>
              )}
            </div>
          </motion.section>
        </div>
      )}

      {sessionMode === "free_solo" && (
        <FreeSoloMode onBack={() => setSessionMode("pick")} />
      )}

      {sessionMode === "free_gm" && (
        <FreeGmMode onBack={() => setSessionMode("pick")} />
      )}

      {(sessionMode === "solo" || sessionMode === "host") && (
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        <div className="flex justify-center mb-2">
          <motion.button
            type="button"
            onClick={() => setSessionMode("pick")}
            className="text-sm text-muted hover:text-blood-light font-body underline underline-offset-4"
          >
            ← Change mode
          </motion.button>
        </div>
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
          <p className="text-muted text-sm mb-6 font-body">
            {sessionMode === "solo"
              ? "Optional: add a character and tone—or leave them blank and the AI will invent them. Beats, endings, and the opening stay hidden; you discover the story in play."
              : "Step 1: Add your story and characters, then generate beats."}
          </p>

          {/* Story (host only) */}
          {sessionMode === "host" && (
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
          )}

          {/* Characters */}
          <motion.div variants={item} className="mb-6">
            <label className="flex items-center gap-2 font-semibold text-[#e8e8e8] mb-2 font-body">
              <Users className="w-4 h-4 text-blood-bright shrink-0" />
              <span>{sessionMode === "solo" ? "1. Character (optional)" : "2. Character sheets"}</span>
              <span className="text-muted font-normal text-xs">({characters.length} chars)</span>
            </label>
            <textarea
              className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y focus:ring-2 focus:ring-blood/60 focus:border-blood transition-all placeholder:text-[#6b6b6b]"
              rows={sessionMode === "solo" ? 8 : 6}
              placeholder={
                sessionMode === "solo"
                  ? "Leave blank for a random protagonist, or write: Name, Goal, Fear, Secret…"
                  : "Name: ...\nGoal: ...\nFear: ...\nSecret: ..."
              }
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

          {/* Constraints / tone */}
          <motion.div variants={item} className="mb-8">
            <label className="flex items-center gap-2 font-semibold text-[#e8e8e8] mb-2 font-body">
              <Shield className="w-4 h-4 text-blood-bright shrink-0" />
              <span>{sessionMode === "solo" ? "2. Story tone (optional)" : "3. Constraints (optional)"}</span>
            </label>
            <textarea
              className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y focus:ring-2 focus:ring-blood/60 focus:border-blood transition-all placeholder:text-[#6b6b6b]"
              rows={3}
              placeholder={
                sessionMode === "solo"
                  ? "Slow dread, claustrophobic, cosmic horror..."
                  : "Tone: slow dread. No sexual violence. Keep it PG-13."
              }
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

          {sessionMode === "host" && (
          <div className="rounded-xl bg-blood/10 border border-blood/30 p-4 mb-6">
            <p className="text-[#e0e0e0] text-sm font-body mb-3">Step 2: Generate beats & endings, then start the game.</p>
            <div className="flex flex-wrap gap-3 items-center">
            <motion.button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !setupReady}
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
            {!setupReady && !loading && (
              <span className="text-sm text-muted">
                Fill in story and character sheets above first.
              </span>
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
          )}

          {sessionMode === "solo" && (
            <div className="rounded-xl bg-blood/10 border border-blood/30 p-4 mb-6">
              <p className="text-[#e0e0e0] text-sm font-body mb-3">
                Ready when you are—the story, beats, and endings are generated behind the scenes and stay secret until you earn them in play.
              </p>
              <motion.button
                type="button"
                onClick={handleBeginSoloAdventure}
                disabled={loading}
                className="rounded-xl border border-blood bg-blood text-white px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <><Spinner /> Starting…</>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Begin solo adventure
                  </>
                )}
              </motion.button>
            </div>
          )}

          {sessionMode === "host" && (
          <>
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
          </>
          )}
        </motion.section>

        {/* Play card — scene first, then input (read → act) */}
        <motion.section
          variants={item}
          className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 lg:p-10 shadow-2xl shadow-black/50"
          whileHover={{ boxShadow: "0 0 50px -12px rgba(139,0,0,0.25)" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blood/60 to-transparent" />
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
            <div>
              <motion.h2
                className="font-display text-xl sm:text-2xl font-semibold text-blood-light flex items-center gap-2"
                variants={item}
              >
                <Swords className="w-5 h-5 shrink-0" />
                Play
              </motion.h2>
              <p className="text-muted text-sm mt-1 font-body max-w-xl">
                {gameStarted
                  ? sessionMode === "host"
                    ? "Read the scene, then log what happened and advance when ready."
                    : "Read the scene, then say what your character does. Risky actions may ask for a tower pull."
                  : sessionMode === "host"
                    ? "After you start the game, the scene and choices appear here."
                    : "After you begin, a short opening (two paragraphs) lands here—place, stakes, and what’s wrong."}
              </p>
            </div>
            {sessionMode === "solo" && gameStarted && (
              <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                <div className="flex items-center gap-2 rounded-lg border border-blood/35 bg-blood/10 px-3 py-2 text-xs text-muted font-body">
                  <Boxes className="w-4 h-4 text-blood-bright shrink-0" aria-hidden />
                  <span>
                    Tower pulls: <span className="text-[#e8e8e8] font-semibold tabular-nums">{jengaPulls}</span>
                    {gameOver && <span className="text-blood-bright font-semibold"> — Ended</span>}
                  </span>
                </div>
                <motion.button
                  type="button"
                  onClick={() => setLogModalOpen(true)}
                  className="rounded-lg border border-border bg-input/60 text-[#e0e0e0] px-3 py-2 text-xs font-semibold font-body flex items-center justify-center gap-2 hover:bg-input transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <History className="w-4 h-4 shrink-0 text-blood-bright" aria-hidden />
                  Full gameplay log
                </motion.button>
              </div>
            )}
          </div>

          {sessionMode === "solo" && gameStarted && pullOutcome && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 rounded-xl border px-4 py-3 text-sm font-body ${
                pullOutcome === "success"
                  ? "border-emerald-700/60 bg-emerald-950/35 text-emerald-100"
                  : "border-blood bg-blood/20 text-red-100"
              }`}
              role="status"
            >
              {pullOutcome === "success" ? (
                <span>
                  <strong className="font-semibold">Pull succeeded.</strong> The tower still stands—your action goes through.
                </span>
              ) : (
                <span>
                  <strong className="font-semibold">The tower fell.</strong> This risky action fails; see the scene below.
                </span>
              )}
            </motion.div>
          )}

          <div className="space-y-8">
            {/* 1 — Scene (primary read) */}
            <motion.div variants={item} className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted font-body">
                <ScrollText className="w-3.5 h-3.5 text-blood-bright shrink-0" />
                {sessionMode === "solo" ? "Where you are" : "Scene"}
              </div>
              <div
                className={`input-text rounded-xl border border-border bg-input/70 p-5 sm:p-6 min-h-[10rem] text-[1.05rem] leading-[1.75] text-[#efefef] shadow-inner ${
                  !gameStarted ? "text-muted italic" : ""
                }`}
              >
                {gameStarted && sceneText ? (
                  <AiRichText text={sceneText} />
                ) : gameStarted ? (
                  "—"
                ) : (
                  "Start the game to see the opening scene."
                )}
              </div>
            </motion.div>

            {/* 2 — Choices / ideas */}
            {gameStarted && choices.length > 0 && (
              <motion.div variants={item} className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted font-body">
                  <Target className="w-3.5 h-3.5 text-blood-bright shrink-0" />
                  {sessionMode === "solo" ? "Paths you might take" : "Suggested directions"}
                </div>
                <ul className="flex flex-col gap-2">
                  {choices.map((c, i) => (
                    <motion.li
                      key={i}
                      className="input-text rounded-lg border border-border/80 bg-input/35 px-4 py-3 text-[0.98rem] leading-snug text-[#e8e8e8]"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <span className="text-blood-bright font-semibold mr-2">{i + 1}.</span>
                      <AiRichText text={c} className="inline" />
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Host: progress */}
            {sessionMode === "host" && gameStarted && (
              <motion.div variants={item} className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted font-body">
                  <Flag className="w-3.5 h-3.5 text-blood-bright shrink-0" />
                  Beat progress
                </div>
                <div className="input-text whitespace-pre-wrap rounded-xl border border-border bg-input/50 p-4 font-mono text-sm text-[#d8d8d8]">
                  {progressLines || "—"}
                </div>
              </motion.div>
            )}

            {/* Host: AI suggestions */}
            {sessionMode === "host" && hostSuggestions.length > 0 && (
              <motion.div variants={item} className="rounded-xl border border-blood/30 bg-blood/10 p-4">
                <h3 className="font-display font-semibold text-blood-light flex items-center gap-2 mb-2 text-sm">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  AI suggestions
                </h3>
                <ul className="space-y-2">
                  {hostSuggestions.map((s, i) => (
                    <li key={i} className="input-text text-sm text-[#e4e4e4] flex gap-2">
                      <span className="text-blood-bright font-semibold shrink-0">•</span>
                      <span className="min-w-0">
                        <AiRichText text={s} />
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* 3 — Your action */}
            <div className="border-t border-border/70 pt-8 space-y-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted font-body">
                <Ghost className="w-3.5 h-3.5 text-blood-bright shrink-0" />
                {sessionMode === "host" ? "GM log — then continue" : "Your action"}
              </div>
              <label className="sr-only" htmlFor="player-action">
                {sessionMode === "host" ? "GM log" : "Describe your action"}
              </label>
              <textarea
                id="player-action"
                className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y min-h-[7rem] focus:ring-2 focus:ring-blood/60 focus:border-blood transition-all placeholder:text-[#6b6b6b]"
                rows={5}
                placeholder={
                  sessionMode === "host"
                    ? "What happened at the table this beat? (Then use Continue for the next AI scene.)"
                    : "Describe what your character says, does, or focuses on—be specific."
                }
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                disabled={gameOver || !!pendingRisk}
              />

              <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {sessionMode === "host" && (
                    <motion.button
                      type="button"
                      onClick={handleHostSuggest}
                      disabled={!gameStarted || suggestLoading || loading}
                      className="rounded-lg border border-border bg-input/80 text-[#f0f0f0] px-4 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {suggestLoading ? (
                        <><Loader2 className="w-4 h-4 inline animate-spin mr-1" /> Suggesting…</>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 inline mr-1 -mt-0.5" />
                          Suggest only
                        </>
                      )}
                    </motion.button>
                  )}
                  <motion.button
                    type="button"
                    onClick={handleReset}
                    className="rounded-lg border border-border/90 bg-transparent text-[#d0d0d0] px-4 py-2.5 text-sm font-semibold hover:bg-input/40 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <RotateCcw className="w-4 h-4 inline mr-1 -mt-0.5" />
                    Reset
                  </motion.button>
                </div>
                <motion.button
                  type="button"
                  onClick={handleNextScene}
                  disabled={!gameStarted || loading || gameOver || !!pendingRisk}
                  className="rounded-xl border border-blood bg-blood text-white px-6 py-3 text-sm sm:text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blood/20 w-full sm:w-auto sm:min-w-[200px]"
                  whileHover={{ scale: !gameStarted || loading || gameOver || pendingRisk ? 1 : 1.02 }}
                  whileTap={{ scale: !gameStarted || loading || gameOver || pendingRisk ? 1 : 0.98 }}
                >
                  {loading && !pendingRisk ? (
                    <>
                      <Spinner />
                      Working…
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-5 h-5 shrink-0" />
                      {sessionMode === "host" ? "Continue scene" : "Continue"}
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.section>
      </motion.div>
      )}

      <AnimatePresence>
        {pendingRisk && sessionMode === "solo" && (
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
              <h3 className="font-display text-xl text-blood-light mb-2 flex items-center gap-2">
                <Boxes className="w-6 h-6 text-blood-bright shrink-0" />
                Pull from the tower
              </h3>
              {pendingRisk.context ? (
                <p className="text-sm text-[#d4d4d4] mb-4 font-body leading-relaxed">
                  <AiRichText text={pendingRisk.context} />
                </p>
              ) : null}
              <p className="text-sm text-muted mb-6 font-body">
                Pull one block from the tower with one hand. If the tower collapses, this risky action fails—and your character may die.
              </p>
              <motion.button
                type="button"
                onClick={handleJengaPull}
                disabled={pullAnimating || loading}
                className="w-full rounded-xl border border-blood bg-blood text-white py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                whileHover={{ scale: pullAnimating || loading ? 1 : 1.02 }}
                whileTap={{ scale: pullAnimating || loading ? 1 : 0.98 }}
              >
                {pullAnimating || loading ? (
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

      <AnimatePresence>
        {logModalOpen && sessionMode === "solo" && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLogModalOpen(false)}
          >
            <motion.div
              className="max-w-2xl w-full max-h-[85vh] flex flex-col rounded-2xl border border-blood/50 bg-card/98 shadow-2xl"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 shrink-0">
                <h3 className="font-display text-lg text-blood-light flex items-center gap-2">
                  <History className="w-5 h-5 text-blood-bright shrink-0" />
                  Full gameplay log
                </h3>
                <button
                  type="button"
                  onClick={() => setLogModalOpen(false)}
                  className="text-sm text-muted hover:text-blood-light font-body underline underline-offset-4"
                >
                  Close
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-4 space-y-5 text-left">
                {transcript.length === 0 ? (
                  <p className="text-muted text-sm font-body">Nothing logged yet.</p>
                ) : (
                  transcript.map((entry, i) => (
                    <div key={i} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
                      <div className="text-[0.7rem] uppercase tracking-wider text-blood-bright/90 font-body mb-1.5">
                        {entry.role === "players"
                          ? "You"
                          : entry.role === "tower"
                            ? "Tower"
                            : "Story"}
                      </div>
                      <div className="input-text text-[0.98rem] leading-relaxed text-[#e8e8e8]">
                        <AiRichText text={entry.text} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
