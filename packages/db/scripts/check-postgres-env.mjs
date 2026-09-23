import net from "node:net";
import { printPostgresRecoveryInstructions, readPostgresDatabaseUrl } from "./postgres-env.mjs";

const databaseUrl = readPostgresDatabaseUrl();
const host = databaseUrl.hostname || "localhost";
const port = Number(databaseUrl.port || 5432);

await new Promise((resolve) => {
  let settled = false;
  const socket = net.createConnection({ host, port });
  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    socket.destroy();
    failPostgresNotReachable(host, port);
  }, 2500);

  socket.once("connect", () => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    socket.end();
    resolve();
  });
  socket.once("error", () => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    failPostgresNotReachable(host, port);
  });
});
console.log(`[db] PostgreSQL is reachable at ${host}:${port}.`);

function failPostgresNotReachable(host, port) {
  console.error(`\n[db] PostgreSQL is not reachable at ${host}:${port}.`);
  console.error("[db] Start PostgreSQL before running Prisma commands or starting the platform.");
  console.error("");
  printPostgresRecoveryInstructions(host, port);
  console.error("");
  process.exit(1);
}
