/** Lowercased + trimmed email for uniqueness and lookups. */
export function emailCanonical(email: string): string {
  return email.trim().toLowerCase();
}
