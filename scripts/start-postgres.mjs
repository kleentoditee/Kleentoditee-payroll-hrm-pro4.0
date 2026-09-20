import { spawnSync } from "node:child_process";

function runDocker(args) {
  return spawnSync("docker", args, {
    shell: process.platform === "win32",
    stdio: "inherit"
  });
}

const version = spawnSync("docker", ["compose", "version"], {
  shell: process.platform === "win32",
  stdio: "pipe"
});
if (version.error || version.status !== 0) {
  console.error("\n[db] Docker Desktop is required. Start Docker Desktop, then run npm run db:up again.");
  console.error("[db] If Docker is not installed, install Docker Desktop first:");
  console.error("[db]   winget install -e --id Docker.DockerDesktop\n");
  process.exit(1);
}

const result = runDocker(["compose", "up", "-d"]);
if (result.error || result.status !== 0) {
  console.error("\n[db] Docker Desktop is required. Start Docker Desktop, then run npm run db:up again.");
  console.error("[db] Docker is installed, but it may not be running yet.\n");
  process.exit(result.status ?? 1);
}
