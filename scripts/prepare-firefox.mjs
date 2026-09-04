import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { firefoxManifest } from "../src/manifests.js";

const destination = new URL("../dist/firefox/", import.meta.url);
const root = new URL("../", import.meta.url);

await rm(destination, { force: true, recursive: true });
await mkdir(destination, { recursive: true });

for (const directory of ["build", "icons", "options", "styles"]) {
  await cp(new URL(`${directory}/`, root), new URL(`${directory}/`, destination), {
    recursive: true,
  });
}
// Keep the full-resolution icon as a repository source asset, not packaged payload.
await rm(new URL("icons/bookmark-injector.png", destination));

for (const file of ["CHANGELOG.md", "LICENSE", "README.md"]) {
  await cp(new URL(file, root), new URL(file, destination));
}

const chromeManifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
await writeFile(
  new URL("manifest.json", destination),
  `${JSON.stringify(firefoxManifest(chromeManifest), null, 2)}\n`,
);
