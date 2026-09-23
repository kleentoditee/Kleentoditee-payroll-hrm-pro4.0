import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { loadDotEnv } from "./postgres-env.mjs";

const require = createRequire(import.meta.url);

loadDotEnv();

const [tool, ...toolArgs] = process.argv.slice(2);

if (!tool) {
  console.error("[db] Usage: node scripts/run-with-root-env.mjs <prisma|tsx|command> [...args]");
  process.exit(1);
}

const resolvedTool = resolveTool(tool, toolArgs);

const child = spawn(resolvedTool.command, resolvedTool.args, {
  cwd: process.cwd(),
  env: process.env,
  shell: false,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`[db] Failed to start ${tool}: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[db] ${tool} exited due to signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

function resolveTool(name, args) {
  if (name === "prisma") {
    return {
      command: process.execPath,
      args: [resolvePackageBin("prisma", "prisma"), ...args],
    };
  }

  if (name === "tsx") {
    return {
      command: process.execPath,
      args: [resolvePackageBin("tsx"), ...args],
    };
  }

  if (name === "tsc") {
    return {
      command: process.execPath,
      args: [resolvePackageBin("typescript", "tsc"), ...args],
    };
  }

  return {
    command: name,
    args,
  };
}

function resolvePackageBin(packageName, binName = packageName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageDir = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const bin = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.[binName];

  if (!bin) {
    throw new Error(`Package ${packageName} does not expose a ${binName} binary.`);
  }

  return path.resolve(packageDir, bin);
}
