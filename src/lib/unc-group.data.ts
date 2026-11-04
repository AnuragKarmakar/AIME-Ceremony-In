// SAMPLE DATA ONLY. No real matching or group assignment exists yet.
// Replace UNC_GROUP / UNC_ME_ID with the participant's real saved group
// (same shape) and the wheel needs no other change.
// `languages` is participant data used for matching; it is never displayed.

export type UncWorld = "Cities" | "Universities" | "Systems Change" | "Imagination Labs" | "Joy";

export interface UncPerson {
  id: string;
  name: string;
  country: string;
  world: UncWorld;
  /** Placeholder until real Visa Path data is wired in. */
  visaPath: string;
  background: string;
  languages: string[];
  /** Avatar / chip colour. */
  color: string;
  starter: string;
}

export const UNC_GROUP: UncPerson[] = [
  {
    id: "l",
    name: "Leila",
    country: "Jordan",
    world: "Cities",
    visaPath: "[Visa Path E]",
    background: "Volunteers at a city library",
    languages: ["English", "Arabic"],
    color: "#fe85e9",
    starter: "ask about a book that changed their mind.",
  },
  {
    id: "a",
    name: "Amara",
    country: "Ghana",
    world: "Universities",
    visaPath: "[Visa Path A]",
    background: "Grew up in a coastal fishing town",
    languages: ["English", "Twi", "French"],
    color: "#e2e75e",
    starter: "ask about a place that feels like home.",
  },
  {
    id: "m",
    name: "Mateo",
    country: "Chile",
    world: "Systems Change",
    visaPath: "[Visa Path B]",
    background: "Works nights at the family bakery",
    languages: ["Spanish", "English"],
    color: "#ff7c51",
    starter: "ask what they would change about school.",
  },
  {
    id: "k",
    name: "Kiri",
    country: "Aotearoa New Zealand",
    world: "Imagination Labs",
    visaPath: "[Visa Path C]",
    background: "Raised by grandparents on a farm",
    languages: ["English", "te reo Māori"],
    color: "#6bac78",
    starter: "ask who taught them the most.",
  },
  {
    id: "y",
    name: "Yusuf",
    country: "Türkiye",
    world: "Joy",
    visaPath: "[Visa Path D]",
    background: "First in family at university",
    languages: ["Turkish", "English", "German"],
    color: "#bb74f2",
    starter: "ask about something they made recently.",
  },
];

/** The participant who is viewing the wheel. The brain reveals the other four. */
export const UNC_ME_ID = "m";

/**
 * Where the fixed top pointer must rest for each lobe of the brain, in degrees
 * clockwise from the top of the artwork: the middle of the purple, pink, teal
 * and red sections. Person i of the four others always lands on lobe i, so a
 * spin never stops on a seam. Tied to public/design/unc/brain.webp.
 */
export const UNC_LANDING_ANGLES = [28, 138, 218, 339] as const;
