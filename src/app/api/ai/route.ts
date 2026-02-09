import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// gemini-pro is deprecated (404). Use 2.5-flash or 2.5-flash-lite. Override with GEMINI_MODEL in .env.local.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
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

async function geminiRaw(prompt: string): Promise<string> {
  const genAI = getClient();
  if (!genAI) throw new Error("Missing GEMINI_API_KEY. Add it to .env.local.");
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.8,
      maxOutputTokens: 2048,
    },
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

async function geminiJSON<T>(prompt: string): Promise<T> {
  console.log("[api/ai] geminiJSON: model =", GEMINI_MODEL, "| prompt length =", prompt.length);
  console.log("[api/ai] Calling Gemini generateContent...");
  const text = await geminiRaw(prompt);
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
    const mode = body.mode as string | undefined;
    console.log("[api/ai] mode =", mode, "| GEMINI_API_KEY set =", !!process.env.GEMINI_API_KEY);

    const useStub = !process.env.GEMINI_API_KEY;

    if (mode === "generate_plan") {
    if (useStub) {
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
    const system = `You are an expert horror GM assistant. All stories are horror-themed. Return ONLY valid JSON, no other text.
Rules:
- Use ONLY the storyDescription, characterSheets, and constraints in the JSON input below to create beats and endings.
- Create exactly 5 beats and 2-3 endings that fit that story and those characters. Keep a horror tone.
- Beats must be distinct, actionable, and reachable in a 1-3 hour session.
- Respect all constraints (tone, content limits).
- CRITICAL: Each beat and each ending must be a single line. No newlines or line breaks inside any string. Escape any double-quote inside a string with backslash (\\").`;
    const returnShape = `Return shape: { "beats": ["line one", "line two", "line three", "line four", "line five"], "endings": ["ending one", "ending two", "ending three"] }`;

    const promptPayload = {
      storyDescription: body.story ?? "",
      characterSheets: body.characters ?? "",
      constraints: body.constraints ?? "",
    };
    console.log("[api/ai] generate_plan payload lengths:", {
      storyDescription: String(promptPayload.storyDescription).length,
      characterSheets: String(promptPayload.characterSheets).length,
      constraints: String(promptPayload.constraints).length,
    });
    const promptText = `${system}\n${returnShape}\n\nInput (use this when generating beats and endings):\n${JSON.stringify(promptPayload, null, 2)}`;
    try {
      let out: { beats: string[]; endings: string[] };
      const rawText = await geminiRaw(promptText);
      try {
        out = parseJSON<{ beats: string[]; endings: string[] }>(rawText);
      } catch (parseErr) {
        const fallback = extractBeatsAndEndings(rawText);
        if (fallback.beats.length > 0 || fallback.endings.length > 0) {
          out = fallback;
          console.log("[api/ai] generate_plan JSON parse failed; used fallback parser. beats:", out.beats?.length, "endings:", out.endings?.length);
        } else {
          throw parseErr;
        }
      }
      console.log("[api/ai] generate_plan success. beats:", out.beats?.length, "endings:", out.endings?.length);
      return NextResponse.json({
        beats: Array.isArray(out.beats) ? out.beats : [],
        endings: Array.isArray(out.endings) ? out.endings : [],
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

  if (mode === "start_game") {
    if (useStub) {
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
    const system = `You are an AI GM for a Dread-style horror one-shot. All stories are horror-themed. Return ONLY valid JSON.
Respect the story, characters, and constraints. Steer toward the given beats/endings over time. Maintain dread and horror tone.
Return shape: { "sceneText": string, "choices": [3-5 strings] }
Write the opening scene: establish tone, hook, and immediate pressure.`;
    const user = JSON.stringify({
      story: body.story,
      characters: body.characters,
      constraints: body.constraints,
      beats: body.beats,
      endings: body.endings,
      instruction: "Write the opening scene. Establish tone, hook, immediate pressure.",
    });
    try {
      const out = await geminiJSON<{ sceneText: string; choices: string[] }>(
        `${system}\n\nUser input:\n${user}`
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
    if (useStub) {
      const firstUnhit = beatHit.findIndex((h: boolean) => !h);
      if (firstUnhit !== -1) beatHit[firstUnhit] = true;
      return NextResponse.json({
        sceneText: `You chose: "${body.playerText || "..."}"\n\nThe lodge responds. Dust falls from the ceiling. Somewhere a door slams. (Stub—set GEMINI_API_KEY for real AI.)`,
        choices: [
          "Push deeper into the building.",
          "Regroup and share what you've found.",
          "Look for a way to secure the exits.",
        ],
        beatHit,
        endingHit,
      });
    }
    const system = `You are an AI GM for a Dread-style horror one-shot. All stories are horror-themed. Return ONLY valid JSON.
Hard rules:
- Advance the story based on what the players did. Keep a horror/dread tone.
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

    console.warn("[api/ai] Unknown mode:", mode);
    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (topErr) {
    const msg = topErr instanceof Error ? topErr.message : "Internal server error";
    const stack = topErr instanceof Error ? topErr.stack : undefined;
    console.error("[api/ai] Uncaught error in POST:", msg, stack || "");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
