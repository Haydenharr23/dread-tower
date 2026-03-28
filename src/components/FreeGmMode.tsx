"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Users,
  ListOrdered,
  Flag,
  Play,
  RotateCcw,
  ScrollText,
  Mic,
  ChevronRight,
} from "lucide-react";
import { AiRichText } from "@/components/AiRichText";
import { GM_STORY_PRESETS, type GmStoryPreset } from "@/data/gmPresets";

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

type Phase = "pick" | "setup";

export function FreeGmMode({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [story, setStory] = useState("");
  const [characters, setCharacters] = useState("");
  const [beats, setBeats] = useState<string[]>([]);
  const [endings, setEndings] = useState<string[]>([]);
  const [beatHit, setBeatHit] = useState<boolean[]>([]);
  const [endingHit, setEndingHit] = useState<boolean[]>([]);
  const [gmScene, setGmScene] = useState("");
  const [gmLogInput, setGmLogInput] = useState("");
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);

  const applyPreset = (p: GmStoryPreset) => {
    setSelectedId(p.id);
    setStory(p.storyDescription);
    setCharacters(p.characters);
    setBeats([...p.beats]);
    setEndings([...p.endings]);
    setBeatHit(new Array(p.beats.length).fill(false));
    setEndingHit(new Array(p.endings.length).fill(false));
    setPhase("setup");
    setGameStarted(false);
    setSessionLog([]);
    setGmLogInput("");
    setGmScene("");
  };

  const goPickStory = () => {
    setPhase("pick");
    setSelectedId(null);
    setStory("");
    setCharacters("");
    setBeats([]);
    setEndings([]);
    setBeatHit([]);
    setEndingHit([]);
    setGameStarted(false);
    setSessionLog([]);
    setGmLogInput("");
    setGmScene("");
  };

  useEffect(() => {
    setBeatHit((prev) => {
      const next = new Array(beats.length).fill(false);
      for (let i = 0; i < Math.min(prev.length, beats.length); i++) next[i] = prev[i];
      return next;
    });
  }, [beats.length]);

  useEffect(() => {
    setEndingHit((prev) => {
      const next = new Array(endings.length).fill(false);
      for (let i = 0; i < Math.min(prev.length, endings.length); i++) next[i] = prev[i];
      return next;
    });
  }, [endings.length]);

  const canStart = story.trim().length > 0 && characters.trim().length > 0 && beats.length > 0 && endings.length > 0;

  const progressLines = [
    ...beats.map((b, i) => `${beatHit[i] ? "✓" : "•"} ${b}`),
    "",
    ...endings.map((e, i) => `${endingHit[i] ? "✓" : "•"} ${e}`),
  ].join("\n");

  const startSession = () => {
    setBeatHit(new Array(beats.length).fill(false));
    setEndingHit(new Array(endings.length).fill(false));
    setSessionLog([]);
    setGmLogInput("");
    setGmScene("");
    setGameStarted(true);
  };

  const appendLog = () => {
    const t = gmLogInput.trim();
    if (!t) return;
    setSessionLog((prev) => [...prev, t]);
    setGmLogInput("");
  };

  const resetSession = () => {
    setGameStarted(false);
    setSessionLog([]);
    setGmLogInput("");
    setGmScene("");
  };

  const selectedPreset = selectedId ? GM_STORY_PRESETS.find((p) => p.id === selectedId) : null;

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

      {phase === "pick" && (
        <section className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-black/50">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blood/60 to-transparent" />
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-2 text-blood-light flex items-center gap-2">
            <Mic className="w-5 h-5" />
            GM Tools — pick a story
          </h2>
          <p className="text-muted text-base mb-6 font-body max-w-2xl leading-relaxed">
            Choose a table kit. Story description (including tone and safety notes), cast sketches, beats, and endings fill
            in automatically—no AI, no API. You can edit everything before you start.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GM_STORY_PRESETS.map((p) => (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-2xl border border-blood/40 bg-blood/10 hover:bg-blood/20 p-5 text-left transition-colors"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <span className="font-display text-xl font-semibold text-blood-light block mb-1">{p.title}</span>
                <span className="text-muted text-base font-body leading-relaxed">{p.blurb}</span>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {phase === "setup" && (
        <>
          <section className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 lg:p-10 shadow-2xl shadow-black/50">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blood/60 to-transparent" />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-1 text-blood-light flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  {selectedPreset?.title ?? "Your story"}
                </h2>
                <p className="text-muted text-base font-body leading-relaxed">
                  Tone and table expectations are part of the story description below—not a separate field.
                </p>
              </div>
              <button
                type="button"
                onClick={goPickStory}
                className="text-sm text-muted hover:text-blood-light font-body underline underline-offset-4 shrink-0"
              >
                ← Choose a different story
              </button>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 font-semibold text-[#e8e8e8] mb-2 font-body">
                <BookOpen className="w-4 h-4 text-blood-bright shrink-0" />
                Story description
              </label>
              <textarea
                className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y focus:ring-2 focus:ring-blood/60 focus:border-blood transition-all placeholder:text-[#6b6b6b]"
                rows={8}
                value={story}
                onChange={(e) => setStory(e.target.value)}
              />
            </div>

            <div className="mb-8">
              <label className="flex items-center gap-2 font-semibold text-[#e8e8e8] mb-2 font-body">
                <Users className="w-4 h-4 text-blood-bright shrink-0" />
                Characters
              </label>
              <textarea
                className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y focus:ring-2 focus:ring-blood/60 focus:border-blood transition-all placeholder:text-[#6b6b6b]"
                rows={8}
                value={characters}
                onChange={(e) => setCharacters(e.target.value)}
              />
            </div>

            <div className="rounded-xl bg-blood/10 border border-blood/30 p-4 mb-8">
              <p className="text-[#e8e8e8] text-base font-body mb-3 leading-relaxed">
                Edit beats and endings if you want, then start the session when you’re ready at the table.
              </p>
              <motion.button
                type="button"
                onClick={startSession}
                disabled={!canStart}
                className="rounded-xl border border-blood bg-blood text-white px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                whileHover={{ scale: canStart ? 1.03 : 1 }}
                whileTap={{ scale: canStart ? 0.98 : 1 }}
              >
                <Play className="w-4 h-4" />
                Start session
              </motion.button>
              {!canStart && (
                <span className="text-base text-muted ml-3 leading-relaxed">Preset should fill all fields; add text if something’s empty.</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-border/80">
              <div>
                <h3 className="font-display text-lg font-semibold mb-2 text-blood-light flex items-center gap-2">
                  <ListOrdered className="w-4 h-4" />
                  Beats
                </h3>
                <EditableList items={beats} onChange={setBeats} />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold mb-2 text-blood-light flex items-center gap-2">
                  <Flag className="w-4 h-4" />
                  Endings
                </h3>
                <EditableList items={endings} onChange={setEndings} />
              </div>
            </div>
          </section>

          <section className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 lg:p-10 shadow-2xl shadow-black/50">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blood/60 to-transparent" />
            <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-2 text-blood-light flex items-center gap-2">
              <ScrollText className="w-5 h-5" />
              GM run — scene &amp; log
            </h2>
            <p className="text-muted text-base mb-6 font-body leading-relaxed">
              {gameStarted
                ? "Type what the table hears/sees. Log outcomes. Tick beats when you earn them."
                : "Start a session above to unlock this panel."}
            </p>

            {!gameStarted ? (
              <p className="text-muted text-base font-body italic">Waiting for session start…</p>
            ) : (
              <div className="space-y-8">
                <div>
                  <div className="text-base uppercase tracking-wider text-muted font-body mb-2">Scene (what players see)</div>
                  <textarea
                    className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y min-h-[8rem] focus:ring-2 focus:ring-blood/60 focus:border-blood"
                    placeholder="You describe the room, the sound, the pressure…"
                    value={gmScene}
                    onChange={(e) => setGmScene(e.target.value)}
                  />
                </div>

                <div>
                  <div className="text-base uppercase tracking-wider text-muted font-body mb-2">Beat progress</div>
                  <div className="input-text whitespace-pre-wrap rounded-xl border border-border bg-input/50 p-4 font-mono text-base text-[#e0e0e0] leading-relaxed mb-4">
                    {progressLines || "—"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {beats.map((b, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setBeatHit((prev) => {
                            const next = [...prev];
                            if (next.length !== beats.length)
                              return new Array(beats.length).fill(false).map((_, j) => j === i);
                            next[i] = !next[i];
                            return next;
                          })
                        }
                        className={`text-base px-3 py-2 rounded-lg border font-body leading-snug ${
                          beatHit[i]
                            ? "border-emerald-600/60 bg-emerald-950/40 text-emerald-100"
                            : "border-border bg-input/40 text-muted hover:bg-input/60"
                        }`}
                      >
                        {i + 1}. {b.slice(0, 28)}
                        {b.length > 28 ? "…" : ""}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-base uppercase tracking-wider text-muted font-body mb-2">Session log (append)</div>
                  {sessionLog.length > 0 && (
                    <ul className="mb-3 space-y-2 border border-border/60 rounded-xl p-3 bg-input/30 max-h-48 overflow-y-auto">
                      {sessionLog.map((line, i) => (
                        <li
                          key={i}
                          className="text-base text-[#e2e2e2] font-body border-b border-border/40 pb-2 last:border-0 last:pb-0 leading-relaxed"
                        >
                          <AiRichText text={line} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <textarea
                    className="input-text w-full min-w-0 rounded-xl border border-border bg-input p-4 resize-y min-h-[6rem]"
                    placeholder="What happened at the table this beat? Append to the log."
                    value={gmLogInput}
                    onChange={(e) => setGmLogInput(e.target.value)}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <motion.button
                      type="button"
                      onClick={appendLog}
                      disabled={!gmLogInput.trim()}
                      className="rounded-xl border border-blood bg-blood text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                      whileHover={{ scale: gmLogInput.trim() ? 1.02 : 1 }}
                      whileTap={{ scale: gmLogInput.trim() ? 0.98 : 1 }}
                    >
                      <ChevronRight className="w-4 h-4" />
                      Append to log
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={resetSession}
                      className="rounded-lg border border-border/90 px-4 py-2 text-sm font-semibold text-[#d0d0d0] inline-flex items-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset session
                    </motion.button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </motion.div>
  );
}
