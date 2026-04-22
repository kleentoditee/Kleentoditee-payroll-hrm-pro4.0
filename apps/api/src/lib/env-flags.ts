/** True for 1, true, yes, on (case-insensitive, trims, strips BOM/CR) — for Windows .env quirks. */
export function isEnvTruthy(name: string): boolean {
  const raw = process.env[name];
  if (raw == null) {
    return false;
  }
  const v = raw.replace(/^\uFEFF/, "").trim().replace(/\r$/, "").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
