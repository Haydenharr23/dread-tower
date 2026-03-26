"use client";

import { useEffect, useRef } from "react";

const DIAGRAM = `flowchart TD
Start([Start])
Start --> Mode{Choose Mode}

Mode --> Solo[Select Solo Mode]
Mode --> Host[Select Host Mode]

%% SOLO MODE
Solo --> SoloChar[Enter character]
SoloChar --> SoloTone["Enter story tone (optional)"]
SoloTone --> SoloGen[AI generates beats, endings, opening scene]
SoloGen --> SoloPlay[Player chooses actions]
SoloPlay --> SoloLoop[AI runs full game loop]
SoloLoop --> SoloControl[AI controls pacing, tension, ending]
SoloControl --> SoloEnd([Ending])

%% HOST MODE
Host --> HostStory[Enter story description]
HostStory --> HostChars[Enter characters]
HostChars --> HostGen[Generate beats and endings]
HostGen --> HostAssist[AI provides suggestions only]
HostAssist --> HostRun[GM runs session]
HostRun --> HostPlayers[Players act]
HostPlayers --> HostLog[GM logs events]
HostLog --> HostAI[AI suggests consequences]
HostAI --> HostEnd([Ending])`;

export function Flowchart() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        themeVariables: {
          primaryColor: "#5c1010",
          primaryTextColor: "#f2f2f2",
          primaryBorderColor: "#8b0000",
          lineColor: "#a63a3a",
          secondaryColor: "#2a1515",
          tertiaryColor: "#1a0a0a",
        },
      });
      const id = `flow-${Math.random().toString(36).slice(2)}`;
      try {
        const { svg } = await mermaid.render(id, DIAGRAM);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        console.error("[Flowchart] mermaid render failed", e);
        if (!cancelled && ref.current) {
          ref.current.textContent = "Could not render flowchart.";
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      ref={ref}
      className="flowchart-root flex justify-center min-h-[200px] [&_svg]:max-w-full [&_svg]:h-auto text-[#e8e8e8]"
      aria-hidden
    />
  );
}
