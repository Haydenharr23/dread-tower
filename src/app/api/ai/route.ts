import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// gemini-pro is deprecated (404). Use 2.5-flash or 2.5-flash-lite. Override with GEMINI_MODEL in .env.local.
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();

/** Trimmed key; avoids empty-looking vars when .env has a space after `=`. */
function getGeminiApiKey(): string | undefined {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || undefined;
}

function getClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

function parseJSON<T>(text: string): T {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  let toParse = jsonMatch ? jsonMatch[0] : trimmed;
  try {
    return JSON.parse(toParse) as T;
  } catch {
    // Try fixing common Gemini issues: newlines inside strings break JSON. Replace unescaped newlines in string values.
    const fixed = toParse.replace(/"\s*\n\s*"/g, '", "').replace(/(?<!\\)\n/g, " ");
    try {
      return JSON.parse(fixed) as T;
    } catch (parseErr) {
      console.error("[api/ai] parseJSON failed. Raw length:", text?.length, "preview:", text?.slice(0, 300));
      throw parseErr;
    }
  }
}

/** Fallback: extract string arrays from malformed JSON by matching "key": ["a", "b", ...] */
function extractStringArray(raw: string, key: string): string[] {
  const regex = new RegExp(`"${key}"\\s*:\\s*\\[\\s*((?:"(?:[^"\\\\]|\\\\.)*"\\s*,?\\s*)*)\\s*\\]`, "s");
  const m = raw.match(regex);
  if (!m || !m[1]) return [];
  const inner = m[1];
  const out: string[] = [];
  let i = 0;
  while (i < inner.length) {
    if (inner[i] !== '"') {
      i++;
      continue;
    }
    i++;
    let s = "";
    while (i < inner.length) {
      if (inner[i] === "\\" && inner[i + 1]) {
        s += inner[i + 1] === "n" ? "\n" : inner[i + 1];
        i += 2;
        continue;
      }
      if (inner[i] === '"') break;
      s += inner[i];
      i++;
    }
    i++;
    if (s.trim()) out.push(s.trim());
  }
  return out;
}

function extractBeatsAndEndings(raw: string): { beats: string[]; endings: string[] } {
  const beats = extractStringArray(raw, "beats");
  const endings = extractStringArray(raw, "endings");
  return { beats, endings };
}

type PullOutcomeBranch = {
  sceneText: string;
  choices: string[];
  beatHit: boolean[];
  endingHit: boolean[];
  gameOver?: boolean;
};

function isPullOutcomeBranch(
  x: unknown,
  beatLen: number,
  endLen: number
): x is PullOutcomeBranch {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.sceneText === "string" &&
    Array.isArray(o.choices) &&
    Array.isArray(o.beatHit) &&
    Array.isArray(o.endingHit) &&
    o.beatHit.length === beatLen &&
    o.endingHit.length === endLen
  );
}

type GeminiJsonConfig = { maxOutputTokens?: number; temperature?: number };

async function geminiRaw(prompt: string, config?: GeminiJsonConfig): Promise<string> {
  const genAI = getClient();
  if (!genAI) throw new Error("Missing GEMINI_API_KEY. Add it to .env.local.");
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: config?.temperature ?? 0.8,
      maxOutputTokens: config?.maxOutputTokens ?? 2048,
    },
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

async function geminiJSON<T>(prompt: string, config?: GeminiJsonConfig): Promise<T> {
  console.log("[api/ai] geminiJSON: model =", GEMINI_MODEL, "| prompt length =", prompt.length);
  console.log("[api/ai] Calling Gemini generateContent...");
  const text = await geminiRaw(prompt, config);
  console.log("[api/ai] Gemini raw response length:", text.length, "preview:", text.slice(0, 150));
  return parseJSON<T>(text);
}

async function geminiText(prompt: string): Promise<string> {
  console.log("[api/ai] geminiText: prompt length =", prompt.length);
  const genAI = getClient();
  if (!genAI) throw new Error("Missing GEMINI_API_KEY. Add it to .env.local.");
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text) throw new Error("Gemini returned no text");
  return text.trim();
}

export async function POST(request: NextRequest) {
  console.log("[api/ai] POST /api/ai called");
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json().catch((e) => {
        console.error("[api/ai] request.json() failed:", e);
        return {};
      });
    } catch (e) {
      console.error("[api/ai] Failed to get body:", e);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const expectedPasskey = (
      process.env.AI_PASSKEY ?? process.env.NEXT_PUBLIC_AI_PASSKEY ?? "1234"
    ).trim();
    const providedPasskey = String(body.aiPasskey ?? "").trim();
    if (providedPasskey !== expectedPasskey) {
      return NextResponse.json(
        { error: "AI modes require a valid passkey." },
        { status: 401 }
      );
    }

    const mode = body.mode as string | undefined;
    console.log("[api/ai] mode =", mode, "| GEMINI_API_KEY set =", !!getGeminiApiKey());

    const useStub = !getGeminiApiKey();

    if (mode === "generate_plan") {
    let storyDescription = String(body.story ?? "");
    let characterSheets = String(body.characters ?? "").trim();
    let constraintsText = String(body.constraints ?? "").trim();
    const soloBootstrap = body.soloBootstrap === true;
    let filledCharacters: string | undefined;
    let filledConstraints: string | undefined;

    if (soloBootstrap) {
      if (useStub) {
        if (!characterSheets) {
          characterSheets =
            "Name: Morgan Vale\nGoal: Learn what happened the night the lodge closed.\nFear: Small enclosed spaces.\nSecret: They ignored a warning sign last winter.";
          filledCharacters = characterSheets;
        }
        if (!constraintsText) {
          constraintsText = "Slow-burn isolation horror; PG-13; no sexual violence.";
          filledConstraints = constraintsText;
        }
      }
      if (!storyDescription.trim()) {
        storyDescription = `Solo horror one-shot. Protagonist:\n${characterSheets}`;
      }
    }

    if (useStub && !soloBootstrap) {
      return NextResponse.json({
        beats: [
          "Discover the source of the scratching in the walls.",
          "Find the old guestbook with the missing pages.",
          "Learn what happened to the previous caretaker.",
          "Uncover the ritual hidden in the cellar.",
          "Face the entity before dawn.",
        ],
        endings: [
          "The entity is bound again; the lodge is safe but changed.",
          "Someone is lost; the survivors flee at first light.",
          "A bargain is struck—at a cost.",
        ],
      });
    }
    if (useStub && soloBootstrap) {
      return NextResponse.json({
        beats: [
          "Discover the source of the scratching in the walls.",
          "Find the old guestbook with the missing pages.",
          "Learn what happened to the previous caretaker.",
          "Uncover the ritual hidden in the cellar.",
          "Face the entity before dawn.",
        ],
        endings: [
          "The entity is bound again; the lodge is safe but changed.",
          "Someone is lost; the survivors flee at first light.",
          "A bargain is struck—at a cost.",
        ],
        ...(filledCharacters ? { filledCharacters } : {}),
        ...(filledConstraints ? { filledConstraints } : {}),
      });
    }
    const soloPlanExtra = soloBootstrap
      ? `
SOLO BOOTSTRAP (single response — no follow-up calls):
- If characterSheets is empty or whitespace, invent a protagonist in "filledCharacters" (Name, Goal, Fear, Secret; under ~500 chars) and use that character for beats/endings. If the user already provided characterSheets, set "filledCharacters" to null.
- If constraints is empty or whitespace, invent a one-line tone/safety line in "filledConstraints". If the user already provided constraints, set "filledConstraints" to null.
`
      : "";
    const system = `You are an expert horror GM assistant. All stories are horror-themed. Return ONLY valid JSON, no other text.
Rules:
- Use ONLY the storyDescription, characterSheets, and constraints in the JSON input below to create beats and endings.
- Create exactly 5 beats and 2-3 endings that fit that story and those characters. Keep a horror tone.
- Beats must be distinct, actionable, and reachable in a 1-3 hour session.
- Respect all constraints (tone, content limits).
- CRITICAL: Each beat and each ending must be a single line. No newlines or line breaks inside any string. Escape any double-quote inside a string with backslash (\\").${soloPlanExtra}`;
    const returnShape = soloBootstrap
      ? `Return shape: { "beats": ["line one", ... "line five"], "endings": ["ending one", ...], "filledCharacters": string | null, "filledConstraints": string | null }`
      : `Return shape: { "beats": ["line one", "line two", "line three", "line four", "line five"], "endings": ["ending one", "ending two", "ending three"] }`;

    const promptPayload = {
      storyDescription,
      characterSheets,
      constraints: constraintsText,
    };
    console.log("[api/ai] generate_plan payload lengths:", {
      storyDescription: String(promptPayload.storyDescription).length,
      characterSheets: String(promptPayload.characterSheets).length,
      constraints: String(promptPayload.constraints).length,
    });
    const promptText = `${system}\n${returnShape}\n\nInput (use this when generating beats and endings):\n${JSON.stringify(promptPayload, null, 2)}`;
    try {
      let out: {
        beats: string[];
        endings: string[];
        filledCharacters?: string | null;
        filledConstraints?: string | null;
      };
      const rawText = await geminiRaw(
        promptText,
        soloBootstrap ? { maxOutputTokens: 4096 } : undefined
      );
      try {
        out = parseJSON<{
          beats: string[];
          endings: string[];
          filledCharacters?: string | null;
          filledConstraints?: string | null;
        }>(rawText);
      } catch (parseErr) {
        const fallback = extractBeatsAndEndings(rawText);
        if (fallback.beats.length > 0 || fallback.endings.length > 0) {
          out = { ...fallback, filledCharacters: null, filledConstraints: null };
          console.log("[api/ai] generate_plan JSON parse failed; used fallback parser. beats:", out.beats?.length, "endings:", out.endings?.length);
        } else {
          throw parseErr;
        }
      }
      if (soloBootstrap) {
        const fc = typeof out.filledCharacters === "string" ? out.filledCharacters.trim() : "";
        const fcons = typeof out.filledConstraints === "string" ? out.filledConstraints.trim() : "";
        if (!String(body.characters ?? "").trim() && fc) {
          filledCharacters = fc;
        }
        if (!String(body.constraints ?? "").trim() && fcons) {
          filledConstraints = fcons;
        }
      }
      console.log("[api/ai] generate_plan success. beats:", out.beats?.length, "endings:", out.endings?.length);
      return NextResponse.json({
        beats: Array.isArray(out.beats) ? out.beats : [],
        endings: Array.isArray(out.endings) ? out.endings : [],
        ...(filledCharacters ? { filledCharacters } : {}),
        ...(filledConstraints ? { filledConstraints } : {}),
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "AI request failed";
      const msg = raw.includes("429") || raw.includes("quota") || raw.includes("Too Many Requests")
        ? "Rate limit or quota exceeded. Wait ~30 seconds and try again, or try model gemini-pro (set GEMINI_MODEL=gemini-pro in .env.local)."
        : raw;
      console.error("[api/ai] generate_plan error:", raw, err instanceof Error ? err.stack : "");
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (mode === "solo_begin") {
    let characterSheets = String(body.characters ?? "").trim();
    let constraintsText = String(body.constraints ?? "").trim();
    let storyDescription = String(body.story ?? "").trim();
    let filledCharacters: string | undefined;
    let filledConstraints: string | undefined;

    if (useStub) {
      if (!characterSheets) {
        characterSheets =
          "Name: Morgan Vale\nGoal: Learn what happened the night the lodge closed.\nFear: Small enclosed spaces.\nSecret: They ignored a warning sign last winter.";
        filledCharacters = characterSheets;
      }
      if (!constraintsText) {
        constraintsText = "Slow-burn isolation horror; PG-13; no sexual violence.";
        filledConstraints = constraintsText;
      }
      if (!storyDescription.trim()) {
        storyDescription = `Solo horror one-shot. Protagonist:\n${characterSheets}`;
      }
      return NextResponse.json({
        beats: [
          "Discover the source of the scratching in the walls.",
          "Find the old guestbook with the missing pages.",
          "Learn what happened to the previous caretaker.",
          "Uncover the ritual hidden in the cellar.",
          "Face the entity before dawn.",
        ],
        endings: [
          "The entity is bound again; the lodge is safe but changed.",
          "Someone is lost; the survivors flee at first light.",
          "A bargain is struck—at a cost.",
        ],
        sceneText:
          "Blackthorn Lodge, late winter, near dark. You're on the porch because a letter asked you to come back about the night the place closed. The door is open a crack; inside, the air is warm and stale. A lantern on the desk flickers over a guestbook—names stop halfway down the page. Nobody answers when you call.\n\n" +
          "The fire's been used recently. Ash in the hearth. Then a slow scrape of wood somewhere deeper in the building, then nothing. You're still on the threshold.",
        choices: [
          "Call out for the caretaker and stay in the light of the desk.",
          "Shut the front door behind you and search the ground floor.",
          "Follow the sound toward the stairs.",
          "Read the guestbook for names and dates before moving on.",
        ],
        ...(filledCharacters ? { filledCharacters } : {}),
        ...(filledConstraints ? { filledConstraints } : {}),
      });
    }

    if (!storyDescription.trim()) {
      storyDescription = `Solo horror one-shot. Protagonist:\n${characterSheets}`;
    }

    const soloOpeningRules = `
OPENING SCENE (sceneText):
- First in-world moment. Do NOT list beats/endings or GM meta. Never quote beat/ending titles as a list.
- LENGTH: **At most two paragraphs**, separated by one blank line (\\n\\n). Never a third paragraph. Target about **120–220 words total**—prefer the tight end of that range.
- STYLE: **Dense and explanatory**: more information per sentence, fewer filler words. Favor concrete nouns/verbs. No bullet lists in sceneText—prose only.
- VOICE (important): **Understated and matter-of-fact.** Avoid melodrama, purple prose, and theatrical lines. Sound like a calm narrator, not a movie trailer.
- Narrate for the group of players (one or more). If multiple characters are present, address the group. Cover: where, when if it matters, why the group is here, what's wrong or urgent now (one hook), then stop—do not resolve the horror.
- choices: 3–5 short, actionable next moves (any character can lead).
`;

    const system = `You are an expert horror GM assistant running a Dread-style horror one-shot for one or more players. Return ONLY valid JSON. All stories are horror-themed.

PART 1 — PLAN:
- Create exactly 5 beats and 2-3 endings that fit the story and characters. Each beat and ending must be a single line (no newlines inside strings). Escape double-quotes inside strings with backslash (\\\\").
- If characterSheets is empty or whitespace, invent "filledCharacters" with 2–3 pre-gen player characters (Name, Goal, Fear, Secret for each; concise, one character per line) and use them for beats/endings. If the user already provided characterSheets, set "filledCharacters" to null.
- If constraints is empty or whitespace, invent "filledConstraints" (one line, tone/safety). If the user already provided constraints, set "filledConstraints" to null.

PART 2 — OPENING (same JSON response):
- sceneText and choices follow the OPENING rules below.
- Plain prose only—never markdown (no **, _, #).

${soloOpeningRules}

Return shape: {
  "beats": [ five lines ],
  "endings": [ two or three lines ],
  "filledCharacters": string | null,
  "filledConstraints": string | null,
  "sceneText": string,
  "choices": [ 3-5 strings ]
}`;
    const user = JSON.stringify({
      storyDescription,
      characterSheets,
      constraints: constraintsText,
    });

    try {
      const out = await geminiJSON<{
        beats: string[];
        endings: string[];
        filledCharacters?: string | null;
        filledConstraints?: string | null;
        sceneText: string;
        choices: string[];
      }>(`${system}\n\nInput:\n${user}`, { maxOutputTokens: 8192, temperature: 0.65 });
      const fc = typeof out.filledCharacters === "string" ? out.filledCharacters.trim() : "";
      const fcons = typeof out.filledConstraints === "string" ? out.filledConstraints.trim() : "";
      if (!String(body.characters ?? "").trim() && fc) filledCharacters = fc;
      if (!String(body.constraints ?? "").trim() && fcons) filledConstraints = fcons;
      return NextResponse.json({
        beats: Array.isArray(out.beats) ? out.beats : [],
        endings: Array.isArray(out.endings) ? out.endings : [],
        sceneText: out.sceneText ?? "",
        choices: Array.isArray(out.choices) ? out.choices : [],
        ...(filledCharacters ? { filledCharacters } : {}),
        ...(filledConstraints ? { filledConstraints } : {}),
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "AI request failed";
      const msg = raw.includes("429") || raw.includes("quota") || raw.includes("Too Many Requests")
        ? "Rate limit or quota exceeded. Wait ~30 seconds and try again, or try model gemini-pro (set GEMINI_MODEL=gemini-pro in .env.local)."
        : raw;
      console.error("[api/ai] solo_begin error:", raw, err instanceof Error ? err.stack : "");
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (mode === "start_game") {
    const soloSession = body.soloSession === true;
    if (useStub) {
      if (soloSession) {
        return NextResponse.json({
          sceneText:
            "Blackthorn Lodge, late winter, near dark. You're on the porch because a letter asked you to come back about the night the place closed. The door is open a crack; inside, the air is warm and stale. A lantern on the desk flickers over a guestbook—names stop halfway down the page. Nobody answers when you call.\n\n" +
            "The fire's been used recently. Ash in the hearth. Then a slow scrape of wood somewhere deeper in the building, then nothing. You're still on the threshold.",
          choices: [
            "Call out for the caretaker and stay in the light of the desk.",
            "Shut the front door behind you and search the ground floor.",
            "Follow the sound toward the stairs.",
            "Read the guestbook for names and dates before moving on.",
          ],
        });
      }
      return NextResponse.json({
        sceneText:
          "The lodge creaks as you step inside. Snow blows against the windows. The fire is lit but no one is here. From somewhere above, a slow scrape—then silence. Your breath fogs in the cold.\n\nWhat do you do?",
        choices: [
          "Search the ground floor for the caretaker.",
          "Follow the sound upstairs.",
          "Check the guestbook by the front desk.",
          "Head to the cellar to find more firewood.",
        ],
      });
    }
    const soloRules = soloSession
      ? `
OPENING SCENE (sceneText):
- First in-world moment for the group. Do NOT list beats/endings or GM meta. Never quote beat/ending titles as a list.
- LENGTH: **At most two paragraphs**, separated by one blank line (\\n\\n). Never a third paragraph. Target about **120–220 words total**—prefer the tight end of that range.
- STYLE: **Dense and explanatory**: more information per sentence, fewer filler words. Favor concrete nouns/verbs. No bullet lists in sceneText—prose only.
- VOICE (important): **Understated and matter-of-fact.** Avoid melodrama, purple prose, and theatrical lines. Sound like a calm narrator, not a movie trailer. Horror comes from situation and detail, not from hyping every sentence.
- Narrate for the group (one or more players). Cover: **where** (place + sensory anchors), **when** (only if it matters), **why the group is here** (stakes from characters), **what's wrong or urgent now** (one clear hook), then stop—do not resolve the horror.
- choices: 3–5 short, actionable next moves (any character can lead).
`
      : "";
    const system = `You are an AI GM for a Dread-style horror one-shot. All stories are horror-themed. Return ONLY valid JSON.
Respect the story, characters, and constraints. Steer toward the given beats/endings over time. ${soloSession ? "Narrate for the group of players. Keep tension low-key and grounded—avoid theatrical or overwrought narration." : "Maintain dread and horror tone."}
In sceneText and choices, use plain prose only—never markdown (no **, _, #, or markdown bullets).
${soloRules}
Return shape: { "sceneText": string, "choices": [3-5 strings] }
${soloSession ? "Follow the OPENING SCENE rules above for sceneText." : "Write the opening scene: establish tone, hook, and immediate pressure."}`;
    const user = JSON.stringify({
      story: body.story,
      characters: body.characters,
      constraints: body.constraints,
      beats: body.beats,
      endings: body.endings,
      instruction: soloSession
        ? "Write the SOLO opening: two paragraphs max, dense prose, restrained voice (not dramatic or purple)."
        : "Write the opening scene. Establish tone, hook, immediate pressure.",
    });
    try {
      const out = await geminiJSON<{ sceneText: string; choices: string[] }>(
        `${system}\n\nUser input:\n${user}`,
        soloSession ? { maxOutputTokens: 2048, temperature: 0.65 } : undefined
      );
      return NextResponse.json({
        sceneText: out.sceneText ?? "",
        choices: Array.isArray(out.choices) ? out.choices : [],
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "AI request failed";
      const msg = raw.includes("429") || raw.includes("quota") || raw.includes("Too Many Requests")
        ? "Rate limit or quota exceeded. Wait ~30 seconds and try again."
        : raw;
      console.error("[api/ai] start_game error:", raw, err instanceof Error ? err.stack : "");
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (mode === "enhance") {
    const field = body.field as string;
    const text = String(body.text ?? "").trim();
    const storyContext = String(body.story ?? "").trim();
    const charactersContext = String(body.characters ?? "").trim();
    if (!field || !text) {
      return NextResponse.json({ error: "Missing field or text" }, { status: 400 });
    }
    let prompt: string;
    if (field === "story") {
      prompt = `You are enhancing a **story description** for a horror tabletop one-shot. The user will paste their current story description below. Improve it so it stays a clear, concise story description—richer in atmosphere, stakes, and dread—without turning it into something else. Return ONLY the enhanced story description, no explanation or preamble.\n\n---\n${text}`;
    } else if (field === "characters") {
      prompt = storyContext
        ? `You are enhancing **character sheets** for a horror TTRPG one-shot. Use the following story description as context so the characters fit the story and tone. The user will paste their current character sheet notes below. Keep the same structure (names, goals, fears, secrets) but make them more vivid and consistent with the story. Return ONLY the enhanced character sheets, no explanation.\n\nStory description (for context):\n${storyContext}\n\n---\nCharacter sheets to enhance:\n${text}`
        : `You are enhancing **character sheets** for a horror TTRPG one-shot. The user will paste their current character sheet notes below. Keep the same structure (names, goals, fears, secrets) but make them more vivid and fitting for dread. Return ONLY the enhanced character sheets, no explanation.\n\n---\n${text}`;
    } else if (field === "constraints") {
      const hasContext = storyContext || charactersContext;
      prompt = hasContext
        ? `You are enhancing **safety/tone constraints** for a horror game. Use the following story and/or character context so the constraints fit the table and support the tone. The user will paste their current constraints below. Make them clear and enforceable. Return ONLY the enhanced constraints, no explanation.\n\n${storyContext ? `Story description (for context):\n${storyContext}\n\n` : ""}${charactersContext ? `Character sheets (for context):\n${charactersContext}\n\n` : ""}---\nConstraints to enhance:\n${text}`
        : `You are enhancing **safety/tone constraints** for a horror game. The user will paste their current constraints below. Make them clear and enforceable. Return ONLY the enhanced constraints, no explanation.\n\n---\n${text}`;
    } else {
      prompt = `Enhance this text for a horror TTRPG. Return ONLY the enhanced text.\n\n---\n${text}`;
    }
    if (useStub) {
      return NextResponse.json({ text: text + "\n\n[Enhancement placeholder — set GEMINI_API_KEY]" });
    }
    try {
      const enhanced = await geminiText(prompt);
      return NextResponse.json({ text: enhanced });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "AI request failed";
      console.error("[api/ai] enhance error:", raw);
      return NextResponse.json({ error: raw }, { status: 500 });
    }
  }

  if (mode === "next_scene") {
    const beatHit = Array.isArray(body.beatHit) ? [...body.beatHit] : [];
    const endingHit = Array.isArray(body.endingHit) ? [...body.endingHit] : [];
    const soloSession = body.soloSession === true;
    const resolvePull = body.resolvePull as { success?: boolean } | undefined;
    const playerText = String(body.playerText ?? "").trim();
    const jengaPullCount = typeof body.jengaPullCount === "number" ? body.jengaPullCount : 0;
    const beats = Array.isArray(body.beats) ? body.beats : [];
    const endings = Array.isArray(body.endings) ? body.endings : [];

    if (useStub) {
      if (soloSession && resolvePull) {
        return NextResponse.json(
          { error: "resolvePull is no longer used; the client resolves pulls locally." },
          { status: 400 }
        );
      }
      if (soloSession && !resolvePull) {
        const risky =
          /\b(climb|jump|run|fight|grab|force|sneak|hide|risk|tower|jenga|pull)\b/i.test(playerText) ||
          playerText.length > 80;
        if (risky) {
          const stubSuccess = {
            sceneText: `The block slides free. The moment breaks open.\n\n(Stub) The lodge responds to your action: "${playerText}"`,
            choices: ["Press forward.", "Hang back.", "Listen."],
            beatHit: (() => {
              const b = [...beatHit];
              const i = b.findIndex((h) => !h);
              if (i !== -1) b[i] = true;
              return b;
            })(),
            endingHit: [...endingHit],
            gameOver: false,
          };
          const deathIdx = endings.findIndex((e: string) => /\b(die|death|lost|kill|perish)/i.test(String(e)));
          const idx = deathIdx >= 0 ? deathIdx : 0;
          const stubFail = {
            sceneText:
              "The tower shudders—and collapses. Your character does not walk away from this.\n\n(Stub: set GEMINI_API_KEY for full narration.)",
            choices: [] as string[],
            beatHit,
            endingHit: endingHit.map((_, i) => i === idx),
            gameOver: true,
          };
          return NextResponse.json({
            requiresPull: true,
            pullContext: "A risky moment—the tower demands a pull.",
            pullBranch: { onSuccess: stubSuccess, onFailure: stubFail },
            sceneText: "",
            choices: [],
            beatHit,
            endingHit,
            gameOver: false,
          });
        }
        const firstUnhit = beatHit.findIndex((h: boolean) => !h);
        if (firstUnhit !== -1) beatHit[firstUnhit] = true;
        return NextResponse.json({
          sceneText: `You chose: "${playerText || "..."}"\n\nThe lodge responds. Dust sifts from the ceiling; the boards groan. (Demo mode — no API key in .env.local.)`,
          choices: [
            "Push deeper into the building.",
            "Regroup and share what you've found.",
            "Look for a way to secure the exits.",
          ],
          beatHit,
          endingHit,
          requiresPull: false,
          gameOver: false,
        });
      }
      const firstUnhit = beatHit.findIndex((h: boolean) => !h);
      if (firstUnhit !== -1) beatHit[firstUnhit] = true;
      return NextResponse.json({
        sceneText: `You chose: "${body.playerText || "..."}"\n\nThe lodge responds. Dust sifts from the ceiling; somewhere a door slams. (Demo mode — no API key in .env.local.)`,
        choices: [
          "Push deeper into the building.",
          "Regroup and share what you've found.",
          "Look for a way to secure the exits.",
        ],
        beatHit,
        endingHit,
      });
    }

    const immutableSolo = soloSession
      ? `
AI GM / DREAD TOWER:
- The beats[] and endings[] arrays are FIXED. Never invent new beats or endings; never change their wording. Only update beatHit and endingHit to reflect progress.
- Do not reveal beats or endings as a list to the players in sceneText.
- Narrate for the whole group (one or more players). If multiple characters are mentioned, address them collectively.
- Endings only become true in endingHit when narratively appropriate; if a character dies or the group fails (e.g. failed Jenga), set exactly one endingHit true—prefer an ending that matches death/loss if present.
- VOICE: Understated, matter-of-fact narration. Avoid melodrama and purple prose. Plain sentences, concrete detail.
`
      : "";

    if (soloSession && resolvePull) {
      return NextResponse.json(
        { error: "resolvePull is no longer used; the client resolves pulls locally." },
        { status: 400 }
      );
    }

    if (soloSession && !resolvePull) {
      const system = `You are an AI GM for a Dread-style horror one-shot for one or more players. Return ONLY valid JSON.
${immutableSolo}
In sceneText, choices, pullContext, and pullBranch fields, plain prose only—never markdown (no **, _, #).
First decide if the players' action is RISKY (physical danger, confrontation, tight escape, deception under pressure, reading forbidden text fast, etc.)—anything where failure could mean injury or serious loss. If risky, they must pull from the Jenga tower before you resolve the action—but you must still write BOTH outcomes in this same response (no second API call).

Return shape: { "requiresPull": boolean, "pullContext": string, "sceneText": string, "choices": [strings], "beatHit": boolean[], "endingHit": boolean[], "pullBranch"?: { "onSuccess": { "sceneText": string, "choices": [strings], "beatHit": boolean[], "endingHit": boolean[], "gameOver": boolean }, "onFailure": { "sceneText": string, "choices": [strings], "beatHit": boolean[], "endingHit": boolean[], "gameOver": boolean } } }

Rules:
- If requiresPull is true: set sceneText to "" and choices to []. pullContext is one short sentence (in-world, no meta) about why the tower matters now.
- If requiresPull is true: you MUST set pullBranch.onSuccess and pullBranch.onFailure. Each branch is the full state if the player pulls successfully (tower stands) vs if the tower falls (failure—usually death/loss; set gameOver true onFailure and mark exactly one appropriate endingHit).
- onSuccess: narrate them succeeding at the risky action; update beatHit/endingHit arrays (same length as input).
- onFailure: tower collapses; narrate death or total loss; gameOver true; endingHit reflects a death/loss ending.
- If requiresPull is false: omit pullBranch. Full scene and choices as usual. beatHit/endingHit updated.
- Never list or quote the full beats/endings arrays in sceneText.
`;
      const user = JSON.stringify({
        story: body.story,
        characters: body.characters,
        constraints: body.constraints,
        beats,
        endings,
        beatHit: body.beatHit,
        endingHit: body.endingHit,
        playersDo: playerText,
        recentTranscript: body.transcriptTail || [],
      });
      try {
        const out = await geminiJSON<{
          requiresPull?: boolean;
          pullContext?: string;
          sceneText: string;
          choices: string[];
          beatHit: boolean[];
          endingHit: boolean[];
          pullBranch?: {
            onSuccess?: unknown;
            onFailure?: unknown;
          };
        }>(`${system}\n\nUser input:\n${user}`, { maxOutputTokens: 8192, temperature: 0.65 });
        if (out.requiresPull === true) {
          const pb = out.pullBranch;
          const ok =
            pb &&
            isPullOutcomeBranch(pb.onSuccess, beatHit.length, endingHit.length) &&
            isPullOutcomeBranch(pb.onFailure, beatHit.length, endingHit.length);
          if (!ok) {
            return NextResponse.json(
              { error: "Solo response missing valid pull branches. Try your action again." },
              { status: 500 }
            );
          }
          return NextResponse.json({
            requiresPull: true,
            pullContext: out.pullContext ?? "This could go badly.",
            pullBranch: {
              onSuccess: pb.onSuccess as PullOutcomeBranch,
              onFailure: pb.onFailure as PullOutcomeBranch,
            },
            sceneText: "",
            choices: [],
            beatHit,
            endingHit,
            gameOver: false,
          });
        }
        return NextResponse.json({
          requiresPull: false,
          sceneText: out.sceneText ?? "",
          choices: Array.isArray(out.choices) ? out.choices : [],
          beatHit: Array.isArray(out.beatHit) ? out.beatHit : beatHit,
          endingHit: Array.isArray(out.endingHit) ? out.endingHit : endingHit,
          gameOver: false,
        });
      } catch (err) {
        const raw = err instanceof Error ? err.message : "AI request failed";
        const msg = raw.includes("429") || raw.includes("quota") || raw.includes("Too Many Requests")
          ? "Rate limit or quota exceeded. Wait ~30 seconds and try again."
          : raw;
        console.error("[api/ai] next_scene solo evaluate error:", raw, err instanceof Error ? err.stack : "");
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    const system = `You are an AI GM for a Dread-style horror one-shot. All stories are horror-themed. Return ONLY valid JSON.
Hard rules:
- Advance the story based on what the players did. Keep a horror/dread tone.
- In sceneText and choices, plain prose only—never markdown (no **, _, #, or markdown bullets).
- Update beatHit and endingHit arrays (same length as input). Set true for beats/endings that were just achieved.
- Do NOT mark more than 1 beat as hit per scene unless unavoidable.
- Only move toward endings once 4+ beats are hit.
Return shape: { "sceneText": string, "choices": [3-5 strings], "beatHit": boolean[], "endingHit": boolean[] }`;
    const user = JSON.stringify({
      story: body.story,
      characters: body.characters,
      constraints: body.constraints,
      beats: body.beats,
      endings: body.endings,
      beatHit: body.beatHit,
      endingHit: body.endingHit,
      playersDo: body.playerText,
      recentTranscript: body.transcriptTail || [],
    });
    try {
      const out = await geminiJSON<{
        sceneText: string;
        choices: string[];
        beatHit: boolean[];
        endingHit: boolean[];
      }>(`${system}\n\nUser input:\n${user}`);
      return NextResponse.json({
        sceneText: out.sceneText ?? "",
        choices: Array.isArray(out.choices) ? out.choices : [],
        beatHit: Array.isArray(out.beatHit) ? out.beatHit : beatHit,
        endingHit: Array.isArray(out.endingHit) ? out.endingHit : endingHit,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "AI request failed";
      const msg = raw.includes("429") || raw.includes("quota") || raw.includes("Too Many Requests")
        ? "Rate limit or quota exceeded. Wait ~30 seconds and try again."
        : raw;
      console.error("[api/ai] next_scene error:", raw, err instanceof Error ? err.stack : "");
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (mode === "host_suggestions") {
    if (useStub) {
      return NextResponse.json({
        suggestions: [
          "A lightbulb pops; the hallway goes dark except for emergency strips.",
          "Someone finds a scrap that contradicts an earlier clue.",
          "A distant sound suggests something is moving toward the group.",
        ],
      });
    }
    const system = `You are an assistant for a human GM running a Dread-style horror one-shot. The GM logs what happened at the table. Return ONLY valid JSON.
Rules:
- Suggestions are optional consequences, complications, or sensory beats—NOT a full scene rewrite.
- Keep a horror/dread tone. Respect story, characters, and constraints.
Return shape: { "suggestions": [3-5 strings] }`;
    const user = JSON.stringify({
      story: body.story,
      characters: body.characters,
      constraints: body.constraints,
      beats: body.beats,
      endings: body.endings,
      gmLog: body.gmLog,
      recentTranscript: body.transcriptTail || [],
    });
    try {
      const out = await geminiJSON<{ suggestions: string[] }>(`${system}\n\nUser input:\n${user}`);
      return NextResponse.json({
        suggestions: Array.isArray(out.suggestions) ? out.suggestions : [],
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "AI request failed";
      const msg = raw.includes("429") || raw.includes("quota") || raw.includes("Too Many Requests")
        ? "Rate limit or quota exceeded. Wait ~30 seconds and try again."
        : raw;
      console.error("[api/ai] host_suggestions error:", raw, err instanceof Error ? err.stack : "");
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

    console.warn("[api/ai] Unknown mode:", mode);
    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (topErr) {
    const msg = topErr instanceof Error ? topErr.message : "Internal server error";
    const stack = topErr instanceof Error ? topErr.stack : undefined;
    console.error("[api/ai] Uncaught error in POST:", msg, stack || "");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
