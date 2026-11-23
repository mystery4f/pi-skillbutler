/**
 * Installs the local git hooks when husky is installed, and does nothing otherwise.
 *
 * pi installs this plugin from git with `npm install --omit=dev`, which still runs
 * `prepare` while husky (a devDependency) is absent, so a bare `husky` call fails the
 * whole install. A shell fallback like `husky || true` is not portable either: `true`
 * is not a cmd.exe builtin.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// husky's own entry point: spawning the .bin shim would need a shell on Windows.
const entry = "node_modules/husky/bin.js";

if (existsSync(entry)) execFileSync(process.execPath, [entry], { stdio: "inherit" });
