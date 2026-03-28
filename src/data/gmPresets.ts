/**
 * Non-AI GM table kits: pick a story to auto-fill description, cast, beats, and endings.
 * Tone / safety / table expectations live inside `storyDescription` only.
 */

export type GmStoryPreset = {
  id: string;
  title: string;
  blurb: string;
  /** Setup pitch for the GM — includes tone, rating, and safety notes inline. */
  storyDescription: string;
  /** Suggested PCs / NPC hooks the table can rename or trim. */
  characters: string;
  beats: string[];
  endings: string[];
};

export const GM_STORY_PRESETS: GmStoryPreset[] = [
  {
    id: "blackthorn-lodge",
    title: "Blackthorn Lodge",
    blurb: "Winter return, guestbook gaps, something patient in the walls.",
    storyDescription: `A closed lodge at the end of a county road. The group arrives because of a letter, a debt, or a rumor—your pick. The building is warm inside without a clear source; doors drift open; names in the guestbook stop halfway down a page.

Tone: slow-burn isolation horror—dread from detail, not jump scares. Keep violence suggestive; no sexual violence. Aim PG-13 at the table; use lines & veils if anyone needs to tap out. Horror comes from obligation, recognition, and “this place knows you.”`,
    characters: `• Morgan Vale — owes someone an honest answer; fear: small enclosed spaces; secret: ignored a warning sign last winter.
• Jun Reyes — wants proof the lodge was never empty; fear: being watched; secret: tampered with evidence once.
• Eli Hart — running from a mistake that started here; fear: losing control; secret: opened something they shouldn’t have.

Rename, swap genders, or replace with your table’s PCs. Give each a want that forces them toward the lodge’s center.`,
    beats: [
      "Discover the source of the sound in the walls (scratching, breathing, or something mimicking speech).",
      "Find the guestbook’s missing pages—or who tore them.",
      "Learn what happened to the last people who stayed past dark.",
      "Uncover what was sealed in the cellar (ritual, remains, or a bargain).",
      "Face the lodge’s claim: escape, bargain, or be folded into it.",
    ],
    endings: [
      "Survival: the group leaves with scars and secrets; the lodge sleeps, not dies.",
      "Loss: someone doesn’t walk away—or walks away wrong.",
      "Pyrrhic: a bargain works; the price is bearable only if no one asks what was traded.",
    ],
  },
  {
    id: "last-train-platform",
    title: "Platform Zero",
    blurb: "Ghost schedule line, stairs that go too far, a train that shouldn’t run.",
    storyDescription: `A late-night station where the board sometimes lists a third departure—no platform number, unreadable destination. Tickets don’t match the weekday schedule; staff act like they don’t see the extra line; the help point plays static.

Tone: urban unease, liminal spaces, “wrong schedule” horror. Keep it surreal but grounded—no gore porn. PG-13; consent-based play for anything involving pursuit or confinement.`,
    characters: `• Sara Okonkwo — maps exits first; fear: being cornered; secret: once missed a last train on purpose.
• Noah Kim — carrying an object that isn’t theirs to return; fear: being recognized; secret: lied about where they found it.

Expand to more PCs if needed: add a commuter, a cleaner, or a security guard with their own rule about the third line.`,
    beats: [
      "Confirm the ghost line exists for more than one witness (photo, corroboration, or shared hallucination).",
      "Find the service stairs or door that shouldn’t be used.",
      "Learn who scratched the tally marks and why they stopped.",
      "Reach the lower platform—or whatever pretends to be a train.",
      "Resolve boarding, fleeing, or breaking the schedule’s hold.",
    ],
    endings: [
      "Escape: the third line vanishes; life stays weird but livable.",
      "Schedule: someone boards—or is listed as a departure.",
      "Secret kept: they flee and agree never to compare notes again.",
    ],
  },
  {
    id: "sealed-ward",
    title: "The Sealed Ward",
    blurb: "Abandoned hospital wing, wrong charts, right names.",
    storyDescription: `A condemned hospital wing is opened for one night—inventory, urban exploration, or a favor for a dying relative. Power is partial; some rooms are flooded or bricked; patient charts still have names the party recognizes from dreams or old photos.

Tone: clinical dread, wrong-place wrong-time. Body horror only if the table opts in; default to implication. PG-13; use lines & veils for medical trauma.`,
    characters: `• Dr. Rowan Vale — former intern; fear: being responsible; secret: signed a discharge they shouldn’t have.
• Miko Tan — there to photograph evidence; fear: silence; secret: family member was a patient here under a false name.

Add orderlies, security, or a patient advocate as NPCs if you want more bodies in the wing.`,
    beats: [
      "Get inside the wing past a believable barrier (lock, guard, or bureaucratic lie).",
      "Find a chart or file that ties a PC to the ward.",
      "Witness something the building does on a schedule (lights, intercom, water).",
      "Learn what the ward was really for (experiment, hospice, or containment).",
      "End the night: seal it again, burn records, or let something out.",
    ],
    endings: [
      "Containment: the wing goes quiet; the group leaves with paperwork and doubt.",
      "Bleed-through: one PC carries a symptom or name they didn’t have before.",
      "Closure: a spirit or system is satisfied; the cost is a secret the table agrees not to log.",
    ],
  },
];
