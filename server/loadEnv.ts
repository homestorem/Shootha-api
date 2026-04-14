import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/** Resolve repo root (directory containing package.json + app.json). */
function resolveProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, "package.json");
    const app = path.join(dir, "app.json");
    if (fs.existsSync(pkg) && fs.existsSync(app)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const projectRoot = resolveProjectRoot();
const envPath = path.join(projectRoot, ".env");

const result = dotenv.config({ path: envPath });
if (result.error && !fs.existsSync(envPath)) {
  console.warn(`[env] No .env at ${envPath} (${result.error.message})`);
} else if (process.env.NODE_ENV === "development") {
  console.log(`[env] Loaded ${envPath}`);
}

export const ENV_PROJECT_ROOT = projectRoot;
