"use client";

import { useEffect, useRef } from "react";

/** Mermaid reference for product flows — not used on the home page; import only if you want a diagram elsewhere. */
const DIAGRAM = `flowchart TD
Start([Start])
Start --> Mode{Choose Mode}

Mode --> NASolo[Non-AI Solo]
NASolo --> SelectStory[Select story]
SelectStory --> SelectCharacter[Select character]
SelectCharacter --> Scene[Scene]
Scene --> Choice[Choice]
Choice --> ScoreUpdate[Score update]
ScoreUpdate --> NextScene[Next scene]
NextScene --> EndingCheck{Ending?}
EndingCheck -->|Continue| Scene
EndingCheck -->|Finish| Ending([Ending])

Mode --> NAGM[Non-AI GM Tools]
NAGM --> ManualSetup[Manual setup]
ManualSetup --> GMRun[GM run]
GMRun --> ManualLog[Manual log]
ManualLog --> ContinueSession[Continue session]

Mode --> AISolo[AI Solo]
AISolo --> AISetup[AI setup]
AISetup --> AILoop[AI play loop]
AILoop --> AIEnding([AI ending])

Mode --> AIGM[AI GM Assistant]
AIGM --> GMSetup[GM setup]
GMSetup --> SuggestLoop[Suggest loop]
SuggestLoop --> GMEnding([GM ending])`;

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
