import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { envPath, printPostgresRecoveryInstructions, readPostgresDatabaseUrl } from "./postgres-env.mjs";

console.log("[db:doctor] KleenToDiTee database diagnostics");
console.log(`[db:doctor] .env exists: ${existsSync(envPath) ? "yes" : "no"} (${envPath})`);

let databaseUrl;
try {
  databaseUrl = readPostgresDatabaseUrl();
} catch {
  process.exit(1);
}

const host = databaseUrl.hostname || "localhost";
const port = Number(databaseUrl.port || 5432);
const database = databaseUrl.pathname.replace(/^\//, "") || "(none)";
const username = decodeURIComponent(databaseUrl.username || "");

console.log(`[db:doctor] DATABASE_URL host: ${host}`);
console.log(`[db:doctor] DATABASE_URL port: ${port}`);
console.log(`[db:doctor] DATABASE_URL database: ${database}`);
console.log(`[db:doctor] DATABASE_URL username: ${username || "(none)"}`);
console.log("[db:doctor] DATABASE_URL password: (hidden)");

const reachable = await canConnect(host, port);
console.log(`[db:doctor] PostgreSQL reachable at ${host}:${port}: ${reachable ? "yes" : "no"}`);

const dockerVersion = spawnSync("docker", ["--version"], {
  shell: process.platform === "win32",
  stdio: "pipe",
  encoding: "utf8"
});
const dockerCliExists = dockerVersion.status === 0;
console.log(`[db:doctor] Docker CLI available: ${dockerCliExists ? "yes" : "no"}`);
if (dockerCliExists) {
  console.log(`[db:doctor] Docker CLI version: ${dockerVersion.stdout.trim()}`);
}

const dockerInfo = spawnSync("docker", ["info"], {
  shell: process.platform === "win32",
  stdio: "pipe",
  encoding: "utf8"
});
console.log(`[db:doctor] Docker appears running: ${dockerInfo.status === 0 ? "yes" : "no"}`);

console.log("");
if (reachable) {
  console.log("[db:doctor] Next step: run npm run start:local");
  process.exit(0);
}

console.log(`[db:doctor] PostgreSQL is not reachable at ${host}:${port}.`);
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
