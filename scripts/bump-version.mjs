import { readFile, writeFile } from "node:fs/promises";

import { nextPatch } from "../src/version.js";

const root = new URL("../", import.meta.url);
const manifestPath = new URL("manifest.json", root);
const packagePath = new URL("package.json", root);
const lockPath = new URL("package-lock.json", root);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const lock = JSON.parse(await readFile(lockPath, "utf8"));

if (manifest.version !== packageJson.version || lock.version !== packageJson.version) {
  throw new Error(
    `Version files disagree: manifest=${manifest.version}, package=${packageJson.version}, lock=${lock.version}`,
  );
}

const version = nextPatch(packageJson.version);
manifest.version = version;
packageJson.version = version;
lock.version = version;
if (lock.packages?.[""]) {
  lock.packages[""].version = version;
}

await Promise.all([
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`),
  writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`),
]);

console.log(`Bumped extension version to ${version}`);
