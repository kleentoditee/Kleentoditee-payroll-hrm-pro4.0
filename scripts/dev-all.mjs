import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run") || process.argv.includes("--check");

const servers = [
  {
    name: "api",
    cwd: path.join(repoRoot, "apps", "api"),
    packageName: "tsx",
    binName: "tsx",
    args: ["watch", "src/index.ts"],
  },
  {
    name: "admin",
    cwd: path.join(repoRoot, "apps", "admin-web"),
    packageName: "next",
    binName: "next",
    args: ["dev", "--port", "3000"],
  },
  {
    name: "tracker",
    cwd: path.join(repoRoot, "apps", "employee-tracker"),
    packageName: "next",
    binName: "next",
    args: ["dev", "--port", "3001"],
  },
];

let commands;
try {
  commands = servers.map((server) => ({
    ...server,
    binPath: resolvePackageBin(server.cwd, server.packageName, server.binName),
  }));
} catch (error) {
  console.error("[dev] Dependencies are missing or incomplete.");
  console.error("[dev] From the repo root, run: npm.cmd install");
  console.error(`[dev] ${error.message}`);
  process.exit(1);
}

if (dryRun) {
  for (const command of commands) {
    console.log(`[dev] ${command.name}: node ${path.relative(repoRoot, command.binPath)} ${command.args.join(" ")}`);
  }
  process.exit(0);
}

console.log("[dev] Starting api, admin-web, and employee-tracker...");

let shuttingDown = false;
const children = commands.map(startServer);

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

function startServer(command) {
  const child = spawn(process.execPath, [command.binPath, ...command.args], {
    cwd: command.cwd,
    env: process.env,
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
  });

  prefixStream(child.stdout, command.name, process.stdout);
  prefixStream(child.stderr, command.name, process.stderr);

  child.on("error", (error) => {
    console.error(`[${command.name}] Failed to start: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    console.error(`[${command.name}] stopped unexpectedly (${reason}).`);
    shutdown(code && code > 0 ? code : 1);
  });

  return child;
}

function shutdown(exitCode) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(exitCode);
}

function prefixStream(stream, prefix, output) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      output.write(`[${prefix}] ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer) {
      output.write(`[${prefix}] ${buffer}\n`);
    }
  });
}

function resolvePackageBin(cwd, packageName, binName) {
  const requireFromWorkspace = createRequire(path.join(cwd, "package.json"));
  const packageJsonPath = requireFromWorkspace.resolve(`${packageName}/package.json`);
  const packageDir = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const bin = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.[binName];

  if (!bin) {
    throw new Error(`Package ${packageName} does not expose a ${binName} binary.`);
  }

  return path.resolve(packageDir, bin);
}
