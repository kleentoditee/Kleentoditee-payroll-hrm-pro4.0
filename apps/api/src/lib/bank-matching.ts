// Bank statement line -> document matching (Batch 14).
// Pure scoring; the route layer loads candidate documents from the DB.

export const MATCH_AMOUNT_TOLERANCE = 0.005;
export const MATCH_DATE_WINDOW_DAYS = 7;

export type MatchEntityType = "payment" | "deposit" | "expense" | "bill_payment" | "journal";

export type MatchCandidate = {
  entityType: MatchEntityType;
  entityId: string;
  /** Human label, e.g. document number or journal memo. */
  label: string;
  date: string; // ISO yyyy-mm-dd
  /** Signed from the bank account's perspective: + in, - out. */
  amount: number;
  reference: string;
  description: string;
  score: number;
};

export type ScorableDocument = {
  entityType: MatchEntityType;
  entityId: string;
  label: string;
  date: string;
  amount: number;
  reference: string;
  description: string;
};

function dayDiff(a: string, b: string): number {
  const ms = Date.parse(a) - Date.parse(b);
  return Math.abs(Math.round(ms / 86_400_000));
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3)
  );
}

/**
 * Score 0-100. Hard requirement: |amount| matches within tolerance and the
 * sign matches (money in vs money out). Date proximity contributes up to 40,
 * reference exact/prefix match up to 40, description token overlap up to 20.
 */
export function scoreCandidate(
  line: { date: string; amount: number; reference: string; description: string },
  doc: ScorableDocument
): number | null {
  if (Math.abs(Math.abs(doc.amount) - Math.abs(line.amount)) > MATCH_AMOUNT_TOLERANCE) return null;
  if (Math.sign(doc.amount) !== Math.sign(line.amount)) return null;

  let score = 0;
  const dd = dayDiff(line.date, doc.date);
  if (dd > MATCH_DATE_WINDOW_DAYS) return null;
  score += 40 * (1 - dd / (MATCH_DATE_WINDOW_DAYS + 1));

  const refL = line.reference.trim().toLowerCase();
  const refD = doc.reference.trim().toLowerCase();
  if (refL && refD) {
    if (refL === refD) score += 40;
    else if (refL.includes(refD) || refD.includes(refL)) score += 25;
  }

  const tl = tokens(line.description);
  const td = tokens(doc.description);
  if (tl.size && td.size) {
    let overlap = 0;
    for (const t of tl) if (td.has(t)) overlap++;
    score += 20 * (overlap / Math.max(tl.size, td.size));
  }

  return Math.round(score * 10) / 10;
}

/** Score, filter, and rank candidates; best first. */
export function rankCandidates(
  line: { date: string; amount: number; reference: string; description: string },
  docs: ScorableDocument[]
): MatchCandidate[] {
  return docs
    .map((doc) => {
      const score = scoreCandidate(line, doc);
      return score === null ? null : { ...doc, score };
    })
    .filter((c): c is MatchCandidate => c !== null)
    .sort((a, b) => b.score - a.score);
}
