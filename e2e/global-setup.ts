const ADMIN_URL = process.env.E2E_ADMIN_URL ?? "http://localhost:3000";
const TRACKER_URL = process.env.E2E_TRACKER_URL ?? "http://localhost:3001";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8787";

async function check(name: string, url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!response.ok) return `${name} returned HTTP ${response.status} at ${url}`;
    return null;
  } catch (error) {
    return `${name} is unavailable at ${url}: ${error instanceof Error ? error.message : "connection failed"}`;
  }
}

export default async function globalSetup() {
  const failures = (
    await Promise.all([
      check("Admin web", `${ADMIN_URL}/login`),
      check("Employee tracker", `${TRACKER_URL}/login`),
      check("API", `${API_URL}/health`)
    ])
  ).filter((failure): failure is string => Boolean(failure));

  if (failures.length > 0) {
    throw new Error(
      [
        "E2E prerequisite failed. Start the local platform once with `npm run start:work`, then rerun `npm run test:e2e`.",
        ...failures.map((failure) => `- ${failure}`)
      ].join("\n")
    );
  }
}
