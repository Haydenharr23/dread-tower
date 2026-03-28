/** Scripted non-AI solo: 3 choices per scene; `requiresPull` only on moves that need a tower resolution (no UI labels). */

export type FreeSoloOutcome = {
  nextSceneIndex: number;
  scoreDelta: number;
  endingText?: string;
};

export type FreeSoloChoice = {
  label: string;
  requiresPull?: boolean;
  pullContext?: string;
  onPullSuccess?: FreeSoloOutcome;
  onPullFailure?: FreeSoloOutcome;
  nextSceneIndex: number;
  scoreDelta: number;
  endingText?: string;
};

export type FreeSoloScene = {
  text: string;
  choices: [FreeSoloChoice, FreeSoloChoice, FreeSoloChoice];
};

export type FreeSoloCharacter = {
  id: string;
  name: string;
  tagline: string;
};

export type FreeSoloStory = {
  id: string;
  title: string;
  blurb: string;
  characters: FreeSoloCharacter[];
  scenes: FreeSoloScene[];
};

export function jengaCollapseChance(completedPulls: number): number {
  return Math.min(0.45, 0.06 + completedPulls * 0.03);
}

export function resolveFreeSoloChoice(ch: FreeSoloChoice, pullSucceeded: boolean): FreeSoloOutcome {
  if (ch.requiresPull && ch.onPullSuccess && ch.onPullFailure) {
    return pullSucceeded ? ch.onPullSuccess : ch.onPullFailure;
  }
  return {
    nextSceneIndex: ch.nextSceneIndex,
    scoreDelta: ch.scoreDelta,
    endingText: ch.endingText,
  };
}

export const FREE_SOLO_STORIES: FreeSoloStory[] = [
  {
    id: "last-letter",
    title: "The Last Letter",
    blurb: "Winter lodge, a guestbook, and a letter that won’t stay read.",
    characters: [
      { id: "morgan", name: "Morgan Vale", tagline: "They owe someone an honest answer." },
      { id: "jun", name: "Jun Reyes", tagline: "Looking for proof the place was never empty." },
      { id: "eli", name: "Eli Hart", tagline: "Running from a mistake that started here." },
    ],
    scenes: [
      {
        text:
          "Blackthorn Lodge sits where the county road gives up. Snow has drifted across the porch; the door stands ajar by a finger’s width. Inside, the air is warm and wrong—stale heat with no voice behind it.\n\nA lantern on the desk throws a thin circle over a guestbook. Names stop halfway down the page.",
        choices: [
          { label: "Call out from the threshold and wait.", nextSceneIndex: 1, scoreDelta: 0 },
          { label: "Read the guestbook before you move.", nextSceneIndex: 2, scoreDelta: 0 },
          {
            label: "Run the stairs toward the scrape you heard upstairs.",
            requiresPull: true,
            pullContext: "You take the steps two at a time; the wood answers like something counting.",
            onPullSuccess: { nextSceneIndex: 3, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 3,
              endingText:
                "A riser gives. You pitch forward—skull, rail, darkness. When you come to, you’re on the ground floor again. The guestbook lies open to a blank page with your name already penciled in.\n\n**Ending — caught on the way up.**",
            },
            nextSceneIndex: 3,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "Your voice thins in the hall. No answer—only the tick of cooling metal. On the desk, a key on a ring labeled *cellar* in pencil. The scrape comes again, softer, from above.",
        choices: [
          { label: "Take the cellar key and head toward the stairs down.", nextSceneIndex: 4, scoreDelta: 1 },
          { label: "Search the desk drawers for anything else.", nextSceneIndex: 2, scoreDelta: 0 },
          {
            label: "Shoulder the front door open against the wind and step outside.",
            requiresPull: true,
            pullContext: "The wind wants the door; you fight it like a second pair of hands.",
            onPullSuccess: { nextSceneIndex: 5, scoreDelta: 1 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 2,
              endingText:
                "The door slams you back into the hall. Your shoulder won’t sit right. Inside, the lantern steadies—and the guestbook flips its own page.\n\n**Ending — refused exit.**",
            },
            nextSceneIndex: 5,
            scoreDelta: 1,
          },
        ],
      },
      {
        text:
          "The guestbook’s last legible names share a handwriting you almost recognize. A scrap marks a page: *Don’t sign. Don’t stay past dark.* The ink looks fresh.\n\nOutside, wind finds a loose pane and makes it chatter.",
        choices: [
          { label: "Photograph the page, then move on.", nextSceneIndex: 3, scoreDelta: 1 },
          { label: "Return toward the hall and the cellar key.", nextSceneIndex: 1, scoreDelta: 0 },
          {
            label: "Tear the warning out and pocket it.",
            requiresPull: true,
            pullContext: "Paper fights you; the book wants to keep every word.",
            onPullSuccess: { nextSceneIndex: 6, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: 1,
              scoreDelta: 2,
            },
            nextSceneIndex: 6,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "The upper hall is dim. A door stands open; inside, a stripped bed and a closet with a coat—wet at the hem.\n\nOn the floor, a child’s drawing: the lodge, the road, and a tall figure with no face behind the house.",
        choices: [
          { label: "Take the drawing and head back toward the stairs.", nextSceneIndex: 7, scoreDelta: 1 },
          { label: "Skip the room and try the next door.", nextSceneIndex: 8, scoreDelta: 0 },
          {
            label: "Open the closet.",
            requiresPull: true,
            pullContext: "Fabric, darkness, and whatever hung there first.",
            onPullSuccess: { nextSceneIndex: 9, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 3,
              endingText:
                "The sleeve catches your wrist. Wool becomes intent. When you tear free, your reflection in the window blinks late.\n\n**Ending — worn.**",
            },
            nextSceneIndex: 9,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "Cellar steps groan. Below, shelves of jars—labels faded, contents dark. At the back wall, scratches in mortar form a circle someone tried to pry loose.",
        choices: [
          { label: "Back away and return to the hall.", nextSceneIndex: 1, scoreDelta: 0 },
          { label: "Sweep the shelves with your light and move on.", nextSceneIndex: 10, scoreDelta: 1 },
          {
            label: "Pry at the loose bricks with your bare hands.",
            requiresPull: true,
            pullContext: "Mortar bites; something behind exhales.",
            onPullSuccess: { nextSceneIndex: 11, scoreDelta: 3 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 4,
              endingText:
                "The wall doesn’t open—it inhales. Cold runs your arms. You wake at the desk. The pen is warm.\n\n**Ending — the lodge keeps what it borrows.**",
            },
            nextSceneIndex: 11,
            scoreDelta: 3,
          },
        ],
      },
      {
        text:
          "The porch light you didn’t turn on catches snow. The road is a pale line. For a heartbeat, leaving feels possible—if you don’t look at the guestbook through the glass.",
        choices: [
          { label: "Step back inside and shut the door firmly.", nextSceneIndex: 1, scoreDelta: 1 },
          { label: "Stand on the porch until your breathing slows.", nextSceneIndex: 2, scoreDelta: 0 },
          {
            label: "Sprint for your car and don’t look back.",
            requiresPull: true,
            pullContext: "Ice, steps, and the house at your back.",
            onPullSuccess: { nextSceneIndex: 12, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 3,
              endingText:
                "You trip on the top step. Snow fills your mouth. The lodge’s windows warm—one light, then many.\n\n**Ending — pulled back in.**",
            },
            nextSceneIndex: 12,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "The pantry smells of cinnamon and rot. Behind a panel: letters in your handwriting to this address. You don’t remember writing them.\n\nYour phone buzzes—no bars, no name—only vibration timed to your pulse.",
        choices: [
          { label: "Put the letters back and leave the pantry.", nextSceneIndex: 7, scoreDelta: 1 },
          { label: "Read one letter through, slowly.", nextSceneIndex: 2, scoreDelta: 1 },
          {
            label: "Smash the phone under your heel.",
            requiresPull: true,
            pullContext: "Glass, battery, something that wants to keep buzzing.",
            onPullSuccess: { nextSceneIndex: 8, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 3,
              endingText:
                "The screen cracks; the buzz moves into your wrist. You sit down among the letters. They sort themselves.\n\n**Ending — answered.**",
            },
            nextSceneIndex: 8,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "You move room to room. The lodge remembers footprints: mud older than today. In the kitchen, a kettle on a cold stove.\n\nBehind you, the front door stands open a crack—again.",
        choices: [
          { label: "Re-shut the door and wedge a chair under the handle.", nextSceneIndex: 1, scoreDelta: 1 },
          { label: "Leave the ground floor and take the stairs.", nextSceneIndex: 3, scoreDelta: 1 },
          {
            label: "Push deeper into the house without touching the door.",
            requiresPull: true,
            pullContext: "Corridors narrow; the floor tilts toward something listening.",
            onPullSuccess: { nextSceneIndex: 4, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: 3,
              scoreDelta: 2,
            },
            nextSceneIndex: 4,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "The next door opens onto a bathroom mirror filmed with steam though nothing runs hot. Your reflection lags.\n\nWords in the condensation: *ASK THE DESK.*",
        choices: [
          { label: "Wipe the mirror and return to the guestbook.", nextSceneIndex: 2, scoreDelta: 0 },
          { label: "Leave the bathroom and find the attic hatch.", nextSceneIndex: 13, scoreDelta: 1 },
          {
            label: "Break the mirror with your elbow.",
            requiresPull: true,
            pullContext: "Glass, blood, and seven years of bad luck compressed into one second.",
            onPullSuccess: { nextSceneIndex: 6, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 3,
              endingText:
                "Shards find your skin; the lagging reflection doesn’t bleed. It smiles when you don’t.\n\n**Ending — wrong face.**",
            },
            nextSceneIndex: 6,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "The coat smells like rain that never fell. In the pocket: a ticket stub dated three days from now.\n\nSomething brushes your neck—recognition, not wind.",
        choices: [
          { label: "Strip the coat onto the bed and back away.", nextSceneIndex: 3, scoreDelta: 1 },
          { label: "Search the pockets again, slower.", nextSceneIndex: 2, scoreDelta: 0 },
          {
            label: "Speak the name you came to say aloud.",
            requiresPull: true,
            pullContext: "The word leaves your mouth like a door unlatched.",
            onPullSuccess: {
              nextSceneIndex: -1,
              scoreDelta: 1,
              endingText:
                "The closet eases shut. Downstairs, the lantern steadies. Outside, snow thins; the road almost looks passable.\n\n**Ending — borrowed time.**",
            },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 3,
              endingText:
                "The name comes back with extra syllables. The coat hangs itself. You sit until the house learns your breathing.\n\n**Ending — named.**",
            },
            nextSceneIndex: -1,
            scoreDelta: 1,
          },
        ],
      },
      {
        text:
          "Behind dust, photographs: the lodge in every season, always empty—except the last, where a silhouette fills the doorway. The face is smudged.",
        choices: [
          { label: "Take only the keys from the shelf.", nextSceneIndex: 4, scoreDelta: 1 },
          { label: "Put everything back exactly as it was.", nextSceneIndex: 7, scoreDelta: 0 },
          {
            label: "Burn the photos in the cold stove upstairs.",
            requiresPull: true,
            pullContext: "Flame, draft, and smoke that wants a chimney it remembers.",
            onPullSuccess: { nextSceneIndex: 6, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 3,
              endingText:
                "Smoke climbs wrong—into the room, into your eyes, into a shape that coughs your name.\n\n**Ending — developed.**",
            },
            nextSceneIndex: 6,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "Beyond the broken circle, stairs go down farther than the cellar should allow. Water laps below—slow, patient.\n\nA voice you almost recognize calls your name once.",
        choices: [
          {
            label: "Descend until your shoes touch water.",
            requiresPull: true,
            pullContext: "Wet stone, no rail, and hands you can’t see yet.",
            onPullSuccess: {
              nextSceneIndex: -1,
              scoreDelta: 4,
              endingText:
                "The water isn’t deep; it’s full. Gentle hands help you in. Above, the lodge closes like an eyelid.\n\n**Ending — depth is a room.**",
            },
            onPullFailure: {
              nextSceneIndex: 1,
              scoreDelta: 2,
            },
            nextSceneIndex: -1,
            scoreDelta: 4,
          },
          {
            label: "Block the stair with furniture from upstairs.",
            requiresPull: true,
            pullContext: "Dragging weight while something tests each step below.",
            onPullSuccess: {
              nextSceneIndex: -1,
              scoreDelta: 1,
              endingText:
                "The barricade holds long enough. Porch air tastes clean. Behind you, something tests the wood once—then stops.\n\n**Ending — borrowed hours.**",
            },
            onPullFailure: {
              nextSceneIndex: 4,
              scoreDelta: 2,
            },
            nextSceneIndex: -1,
            scoreDelta: 1,
          },
          {
            label: "Walk away from the stair and find the porch again.",
            nextSceneIndex: 5,
            scoreDelta: 0,
          },
        ],
      },
      {
        text:
          "The car starts on the third try. Headlights cut snow. In the rearview, the lodge is dark—no lantern.\n\nYour phone buzzes: *Thanks for visiting.* No sender.",
        choices: [
          {
            label: "Delete the message and keep driving.",
            nextSceneIndex: -1,
            scoreDelta: 1,
            endingText:
              "The road improves; the sky thins. By morning you’ll call it exhaustion.\n\n**Ending — sensible distance.**",
          },
          {
            label: "Turn around toward Blackthorn.",
            nextSceneIndex: -1,
            scoreDelta: 3,
            endingText:
              "The turn is too easy. The porch light waits. The guestbook lies open; your name isn’t dry.\n\n**Ending — the letter was always yours.**",
          },
          {
            label: "Pull over and breathe until the buzz stops.",
            nextSceneIndex: -1,
            scoreDelta: 2,
            endingText:
              "Silence returns in pieces. The message vanishes from your phone. You keep the keys anyway.\n\n**Ending — carried.**",
          },
        ],
      },
      {
        text:
          "Shingles bite; the hatch opens onto a roof slick with ice. Below, the chimney coughs smoke in a shape like your profile.\n\nThe gully of black trees waits.",
        choices: [
          { label: "Crawl back through the hatch.", nextSceneIndex: 8, scoreDelta: 1 },
          { label: "Sit on the ridge until your hands stop shaking.", nextSceneIndex: 3, scoreDelta: 0 },
          {
            label: "Slide toward the gutter and drop to the snow.",
            requiresPull: true,
            pullContext: "Gravity, ice, and the edge you can’t negotiate twice.",
            onPullSuccess: { nextSceneIndex: 5, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 4,
              endingText:
                "Air, branch, pain. You wake inside. The ceiling is too close. The lodge has a shorter leash.\n\n**Ending — gravity is an opinion.**",
            },
            nextSceneIndex: 5,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "The guestbook lies open to a fresh page. The pen rolls slightly, as if just released.\n\nSnow ticks against the glass like fingernails.",
        choices: [
          {
            label: "Sign your name and walk out.",
            nextSceneIndex: -1,
            scoreDelta: 1,
            endingText:
              "Ink dries too fast. The door opens wide. The road is tire tracks and dusk—enough.\n\n**Ending — you leave with a story you won’t tell straight.**",
          },
          {
            label: "Tear the page out and leave it on the desk.",
            nextSceneIndex: -1,
            scoreDelta: 2,
            endingText:
              "Paper tears too loud. Outside, snow erases your tracks before the next step.\n\n**Ending — no record, no claim.**",
          },
          {
            label: "Write *not today* and close the book.",
            nextSceneIndex: -1,
            scoreDelta: 0,
            endingText:
              "The book accepts the refusal. The floorboards exhale. Outside, the wind drops.\n\n**Ending — partial payment.**",
          },
        ],
      },
    ],
  },
  {
    id: "platform",
    title: "Last Train",
    blurb: "A station, a ghost line, and stairs that go one flight too far.",
    characters: [
      { id: "sara", name: "Sara Okonkwo", tagline: "Insomnia and a habit of checking exits." },
      { id: "noah", name: "Noah Kim", tagline: "Here to return something that isn’t theirs." },
    ],
    scenes: [
      {
        text:
          "The station is almost empty. Fluorescents buzz. The board lists two delays—then blinks a third line with no platform.\n\nYour ticket doesn’t match the weekday schedule. The clerk window is shuttered.",
        choices: [
          { label: "Walk the platform looking for a service stair.", nextSceneIndex: 1, scoreDelta: 1 },
          { label: "Wait on a bench under the cameras.", nextSceneIndex: 2, scoreDelta: 0 },
          {
            label: "Try every ticket gate until one flashes green.",
            requiresPull: true,
            pullContext: "Alarms hate being wrong; your body is the argument.",
            onPullSuccess: { nextSceneIndex: 3, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: 2,
              scoreDelta: 1,
            },
            nextSceneIndex: 3,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "Past the vending machines, a service door stands ajar. Stairs go down; air turns wet and warm.\n\nTally marks on the wall—dozens—stop mid-line.",
        choices: [
          { label: "Go down exactly one flight.", nextSceneIndex: 4, scoreDelta: 2 },
          { label: "Return to the main platform.", nextSceneIndex: 2, scoreDelta: 0 },
          {
            label: "Kick the door fully open and take the stairs at a run.",
            requiresPull: true,
            pullContext: "Metal echoes; something below matches your cadence.",
            onPullSuccess: { nextSceneIndex: 4, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 4,
              endingText:
                "Your foot slips on something that isn’t water. Lights strobe; you wake on the main board’s glass, your name in departure font.\n\n**Ending — delisted.**",
            },
            nextSceneIndex: 4,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "Minutes pass. A cleaner pushes a cart; they don’t look at you. The ghost line lengthens—destination unreadable.\n\nYour phone has no signal.",
        choices: [
          { label: "Follow the cleaner at a distance.", nextSceneIndex: 5, scoreDelta: 1 },
          { label: "Study the board until your eyes ache.", nextSceneIndex: 6, scoreDelta: 0 },
          {
            label: "Leave the station entirely.",
            requiresPull: true,
            pullContext: "Revolving doors, rain, and the city’s idea of escape.",
            onPullSuccess: {
              nextSceneIndex: -1,
              scoreDelta: 0,
              endingText:
                "Rain erases edges. You throw the ticket away. By morning the third line won’t exist on any board.\n\n**Ending — sensible exit.**",
            },
            onPullFailure: {
              nextSceneIndex: 1,
              scoreDelta: 1,
            },
            nextSceneIndex: -1,
            scoreDelta: 0,
          },
        ],
      },
      {
        text:
          "A corridor of service posters peeled to blank paper. Your shoes stick slightly. The lights pulse once—together—like one shared heartbeat.",
        choices: [
          { label: "Keep walking until the corridor ends.", nextSceneIndex: 4, scoreDelta: 1 },
          { label: "Turn back before the lights pulse again.", nextSceneIndex: 2, scoreDelta: 0 },
          {
            label: "Run the length of the hall without looking sideways.",
            requiresPull: true,
            pullContext: "Walls and doors blur; vertigo isn’t always inner ear.",
            onPullSuccess: { nextSceneIndex: 4, scoreDelta: 2 },
            onPullFailure: {
              nextSceneIndex: 6,
              scoreDelta: 2,
            },
            nextSceneIndex: 4,
            scoreDelta: 2,
          },
        ],
      },
      {
        text:
          "The lower platform is raw concrete. A train sits with doors open—lights too white, seats too clean.\n\nNo conductor. No chime. Ozone and old perfume.",
        choices: [
          {
            label: "Step aboard.",
            requiresPull: true,
            pullContext: "The gap breathes; the car waits like a mouth.",
            onPullSuccess: {
              nextSceneIndex: -1,
              scoreDelta: 2,
              endingText:
                "Doors seal without sound. The station recedes—not into tunnels, into something like a throat.\n\n**Ending — you’re on the schedule now.**",
            },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 4,
              endingText:
                "Your foot crosses; the gap yawns wider. You stumble back onto concrete—alone. Platform Zero is gone from the signs.\n\n**Ending — rejected boarding.**",
            },
            nextSceneIndex: -1,
            scoreDelta: 2,
          },
          {
            label: "Run for the stairs to the main hall.",
            requiresPull: true,
            pullContext: "Fluorescents die one by one behind you.",
            onPullSuccess: {
              nextSceneIndex: -1,
              scoreDelta: 3,
              endingText:
                "You burst onto the main platform. The board is normal—two delays. Your hands shake for an hour.\n\n**Ending — you keep the station’s secret.**",
            },
            onPullFailure: {
              nextSceneIndex: 4,
              scoreDelta: 2,
            },
            nextSceneIndex: -1,
            scoreDelta: 3,
          },
          { label: "Circle the train without entering.", nextSceneIndex: 6, scoreDelta: 1 },
        ],
      },
      {
        text:
          "The cleaner’s cart blocks a door—*staff only* in peeling letters. Through the window: uniforms; one name tag almost spells yours.\n\nThey hum a tune you half remember.",
        choices: [
          { label: "Apologize and back away.", nextSceneIndex: 2, scoreDelta: 0 },
          { label: "Ask if they’ve seen the third line.", nextSceneIndex: 6, scoreDelta: 1 },
          {
            label: "Snatch the jacket when they turn.",
            requiresPull: true,
            pullContext: "Fabric, alarm, and the weight of someone else’s shift.",
            onPullSuccess: { nextSceneIndex: 7, scoreDelta: 3 },
            onPullFailure: {
              nextSceneIndex: 2,
              scoreDelta: 2,
            },
            nextSceneIndex: 7,
            scoreDelta: 3,
          },
        ],
      },
      {
        text:
          "Your shadow stretches toward the tracks before you move. The PA crackles your name—then departure times in another language.\n\nWind along the platform smells like brakes.",
        choices: [
          { label: "Step back until your shadow shortens.", nextSceneIndex: 2, scoreDelta: 0 },
          { label: "Record the PA on your phone.", nextSceneIndex: 6, scoreDelta: 1 },
          {
            label: "Jump down to the tracks to cross faster.",
            requiresPull: true,
            pullContext: "Third rail myth or fact—you’re about to find out.",
            onPullSuccess: { nextSceneIndex: 4, scoreDelta: 3 },
            onPullFailure: {
              nextSceneIndex: -1,
              scoreDelta: 5,
              endingText:
                "Your shoe catches. Metal, light, hands—too many—haul you to a platform you don’t recognize. The board lists one departure: you.\n\n**Ending — misrouted.**",
            },
            nextSceneIndex: 4,
            scoreDelta: 3,
          },
        ],
      },
      {
        text:
          "Street air hits like permission. Behind you, the station hums—tired, human. Your phone has two bars.\n\nA calendar reminder blinks: *Platform — tonight.* You delete it; it returns with tomorrow’s date.",
        choices: [
          {
            label: "Go home and lock the door.",
            nextSceneIndex: -1,
            scoreDelta: 0,
            endingText:
              "Sleep is thin. You wake with ticket paper under your nails.\n\n**Ending — deferred.**",
          },
          {
            label: "Return before midnight.",
            nextSceneIndex: -1,
            scoreDelta: 2,
            endingText:
              "The third line waits. The train is longer than the station.\n\n**Ending — on time.**",
          },
          {
            label: "Give your ticket to a stranger outside.",
            nextSceneIndex: -1,
            scoreDelta: 1,
            endingText:
              "They tear it in half. The weight lifts; station noise fades like a lost station.\n\n**Ending — passed along.**",
          },
        ],
      },
    ],
  },
];
