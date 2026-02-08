export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).send("Missing OPENAI_API_KEY server env var");

  const body = req.body || {};
  const { mode } = body;

  // A helper that calls the OpenAI Responses API
  async function openaiJSON(system, user) {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || `OpenAI error: ${r.status}`);
    }
    const data = await r.json();
    // Responses API returns content in different shapes; easiest is to read output_text
    const jsonText = data.output_text || "{}";
    return JSON.parse(jsonText);
  }

  try {
    if (mode === "generate_plan") {
      const system = `You are an expert horror GM assistant. Return ONLY JSON.
Rules:
- If user did not provide beats/endings, create exactly 5 beats and 2-3 endings.
- Beats must be distinct, actionable, and reachable in a 1-3 hour session.
Return shape: { "beats": [5 strings], "endings": [2-3 strings] }`;

      const user = JSON.stringify({
        story: body.story,
        characters: body.characters,
        constraints: body.constraints,
      });

      const out = await openaiJSON(system, user);
      return res.status(200).json(out);
    }

    if (mode === "start_game") {
      const system = `You are an AI GM for a Dread-style one-shot. Return ONLY JSON.
You must respect constraints and steer toward the required beats/endings over time.
Return shape: { "sceneText": string, "choices": [3-5 strings] }`;

      const user = JSON.stringify({
        story: body.story,
        characters: body.characters,
        constraints: body.constraints,
        beats: body.beats,
        endings: body.endings,
        instruction: "Write the opening scene. Establish tone, hook, immediate pressure.",
      });

      const out = await openaiJSON(system, user);
      return res.status(200).json(out);
    }

    if (mode === "next_scene") {
      const system = `You are an AI GM for a Dread-style one-shot. Return ONLY JSON.
Hard rules:
- Always advance the story.
- Update beatHit and endingHit arrays (true/false) matching input lengths.
- Do NOT mark more than 1 beat as hit per scene unless absolutely unavoidable.
- Only begin aiming for endings once 4+ beats are hit.
Return shape:
{
  "sceneText": string,
  "choices": [3-5 strings],
  "beatHit": boolean[],
  "endingHit": boolean[]
}`;

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

      const out = await openaiJSON(system, user);
      return res.status(200).json(out);
    }

    return res.status(400).send("Unknown mode");
  } catch (err) {
    return res.status(500).send(err.message || "Server error");
  }
}
