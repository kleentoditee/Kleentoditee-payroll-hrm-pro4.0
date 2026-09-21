/**
 * WhatsApp deep links (Batch 16). Direct wa.me/<number> links open a chat with
 * a specific phone; the generic api.whatsapp.com/send link just carries text.
 * Provider sending stays optional until the owner supplies credentials.
 */

/** Normalize a stored phone to wa.me digits; null when unusable. */
export function waMeDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  // BVI default: local 7-digit numbers get the +1-284 country/area code.
  if (digits.length === 7) digits = `1284${digits}`;
  if (digits.length === 10 && digits.startsWith("284")) digits = `1${digits}`;
  return digits.length >= 10 ? digits : null;
}

/** Direct chat link: https://wa.me/<number>?text=... */
export function waMeLink(phone: string | null | undefined, text: string): string | null {
  const digits = waMeDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
