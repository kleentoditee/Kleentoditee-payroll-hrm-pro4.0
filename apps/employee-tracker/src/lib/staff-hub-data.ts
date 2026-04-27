/**
 * Local-only tips and practice quiz when the API has no quiz configured.
 * Does not contain payroll or sensitive HR data.
 */
export const CLEANING_TIPS: string[] = [
  "Work top to bottom, dry to wet — so dust and drips go toward the floor last.",
  "Color-coded cloths: one site per day; wash hot after bodily-fluid contact.",
  "Check SDS sheets before mixing any chemicals; never improvise with bleach + ammonia."
];

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

function localYmdString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function pickForDay<T>(list: T[], d: Date): T {
  if (list.length === 0) {
    throw new Error("list must not be empty");
  }
  const key = localYmdString(d);
  return list[hashString(key) % list.length]!;
}

export const DAILY_QUIZZES: Array<{
  question: string;
  options: string[];
  correctIndex: number;
  praise: string;
}> = [
  {
    question: "A spill in a hallway should be…",
    options: ["Left until later", "Marked and cleaned promptly", "Only mopped on Fridays"],
    correctIndex: 1,
    praise: "Right — mark or barricade, then clean so nobody slips."
  }
];

export function greetingForTime(d: Date): string {
  const h = d.getHours();
  if (h < 12) {
    return "Good morning";
  }
  if (h < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}
