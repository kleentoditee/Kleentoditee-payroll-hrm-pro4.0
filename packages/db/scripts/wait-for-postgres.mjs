import net from "node:net";
import { printPostgresRecoveryInstructions, readPostgresDatabaseUrl } from "./postgres-env.mjs";

const databaseUrl = readPostgresDatabaseUrl();
const host = databaseUrl.hostname || "localhost";
const port = Number(databaseUrl.port || 5432);
const timeoutMs = Number(process.env.POSTGRES_WAIT_TIMEOUT_MS ?? 60_000);
const startedAt = Date.now();
let attempt = 0;

console.log(`[db] Waiting for PostgreSQL at ${host}:${port}...`);

while (Date.now() - startedAt < timeoutMs) {
  attempt += 1;
  if (await canConnect(host, port)) {
    console.log(`[db] PostgreSQL is ready at ${host}:${port}.`);
    process.exit(0);
  }
  console.log(`[db] Still waiting for PostgreSQL (${attempt})...`);
  await sleep(2_000);
}

console.error(`\n[db] PostgreSQL did not become ready within ${Math.round(timeoutMs / 1000)} seconds.`);
printPostgresRecoveryInstructions(host, port);
process.exit(1);

function canConnect(host, port) {
  return new Promise((resolve) => {
    let settled = false;
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(false);
    }, 1500);

    socket.once("connect", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
