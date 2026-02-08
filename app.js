const el = (id) => document.getElementById(id);

const state = {
  story: "",
  characters: "",
  constraints: "",
  beats: [],
  endings: [],
  beatHit: [],
  endingHit: [],
  transcript: [], // {role, text}
};

function setEditableList(listEl, items) {
  listEl.innerHTML = "";
  items.forEach((text, i) => {
    const li = document.createElement("li");
    li.textContent = text;
    li.setAttribute("contenteditable", "true");
    li.addEventListener("input", () => {
      items[i] = li.textContent.trim();
    });
    listEl.appendChild(li);
  });
}

function renderProgress() {
  const beatLines = state.beats.map((b, i) => `${state.beatHit[i] ? "✓" : "•"} ${b}`).join("\n");
  const endLines  = state.endings.map((e, i) => `${state.endingHit[i] ? "✓" : "•"} ${e}`).join("\n");
  el("progress").textContent = `Beats:\n${beatLines}\n\nEndings:\n${endLines}`;
}

function setScene(sceneText, choices) {
  el("sceneText").textContent = sceneText || "";
  const ul = el("choices");
  ul.innerHTML = "";
  (choices || []).forEach(c => {
    const li = document.createElement("li");
    li.textContent = c;
    ul.appendChild(li);
  });
}

async function callAI(payload) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `AI request failed: ${res.status}`);
  }
  return res.json();
}

el("btnGenerate").addEventListener("click", async () => {
  state.story = el("story").value.trim();
  state.characters = el("characters").value.trim();
  state.constraints = el("constraints").value.trim();

  if (!state.story || !state.characters) {
    alert("Add a story description and character sheets first.");
    return;
  }

  try {
    const data = await callAI({
      mode: "generate_plan",
      story: state.story,
      characters: state.characters,
      constraints: state.constraints,
    });

    state.beats = data.beats || [];
    state.endings = data.endings || [];
    state.beatHit = new Array(state.beats.length).fill(false);
    state.endingHit = new Array(state.endings.length).fill(false);

    setEditableList(el("beatsList"), state.beats);
    setEditableList(el("endingsList"), state.endings);

    el("btnStart").disabled = !(state.beats.length === 5 && state.endings.length >= 2);
    renderProgress();
  } catch (err) {
    alert(err.message);
  }
});

el("btnStart").addEventListener("click", async () => {
  state.transcript = [];
  el("btnNext").disabled = false;

  try {
    const data = await callAI({
      mode: "start_game",
      story: state.story,
      characters: state.characters,
      constraints: state.constraints,
      beats: state.beats,
      endings: state.endings,
    });

    setScene(data.sceneText, data.choices);
    renderProgress();
  } catch (err) {
    alert(err.message);
  }
});

el("btnNext").addEventListener("click", async () => {
  const playerText = el("playerInput").value.trim();
  if (!playerText) return;

  try {
    const data = await callAI({
      mode: "next_scene",
      story: state.story,
      characters: state.characters,
      constraints: state.constraints,
      beats: state.beats,
      endings: state.endings,
      beatHit: state.beatHit,
      endingHit: state.endingHit,
      playerText,
      transcriptTail: state.transcript.slice(-10),
    });

    // Update progress flags from AI output
    if (Array.isArray(data.beatHit)) state.beatHit = data.beatHit;
    if (Array.isArray(data.endingHit)) state.endingHit = data.endingHit;

    // Update transcript
    state.transcript.push({ role: "players", text: playerText });
    state.transcript.push({ role: "gm", text: data.sceneText });

    setScene(data.sceneText, data.choices);
    renderProgress();

    el("playerInput").value = "";
  } catch (err) {
    alert(err.message);
  }
});

el("btnReset").addEventListener("click", () => {
  location.reload();
});
