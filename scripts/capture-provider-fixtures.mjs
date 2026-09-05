// Optional fixture maintenance. Normal tests do not require Docker or network.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const exec = promisify(execFile);
const docker = async (...args) => (await exec("docker", args, { timeout: 180000, maxBuffer: 4 * 1024 * 1024 })).stdout.trim();
const images = {
  linkding: "sissbruecker/linkding@sha256:0c0a9a04c7ebd644293c37f98710872fe7cdff0ea1ff7fd9be4d235e4c4678d2",
  readeck: "codeberg.org/readeck/readeck@sha256:32bd82e457a3a9a3fffb161f55cfebf0fd7ffbc87ddf2fe7a321361905348f0a",
};
const name = `bookmark-contract-${randomUUID().slice(0, 8)}`;
const linkding = `${name}-linkding`;
const readeck = `${name}-readeck`;
const destination = new URL("../test/fixtures/providers/", import.meta.url);

async function ready(command) {
  const until = Date.now() + 90000;
  let failure;
  while (Date.now() < until) {
    try { await command(); return; } catch (error) { failure = error; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw failure;
}

try {
  await docker("network", "create", "--internal", name);
  await docker("run", "-d", "--name", linkding, "--network", name,
    "-e", "LD_SUPERUSER_NAME=fixture", "-e", "LD_SUPERUSER_PASSWORD=fixture-password",
    images.linkding);
  await docker("run", "-d", "--name", readeck, "--network", name, images.readeck);
  await ready(() => docker("exec", linkding, "python", "-c",
    "import urllib.request; urllib.request.urlopen('http://localhost:9090/',timeout=3)"));
  await ready(() => docker("exec", readeck, "readeck", "healthcheck"));
  await docker("exec", readeck, "readeck", "user", "-u", "fixture", "-p", "fixture-password", "-group", "admin");
  await docker("restart", readeck);
  await ready(() => docker("exec", readeck, "readeck", "healthcheck"));
  const script = await readFile(new URL("fixtures/capture-provider-responses.py", import.meta.url), "utf8");
  // Execute the setup inside the isolated network using Linkding's bundled Python.
  const raw = await docker("exec", linkding, "python", "-c", script, readeck);
  const responses = JSON.parse(raw);
  for (const [file, response] of Object.entries(responses)) {
    const expected = file.includes("unauthorized") ? 401 : 200;
    if (response.status !== expected) throw new Error(`${file}: expected HTTP ${expected}, got ${response.status}`);
  }
  await mkdir(destination, { recursive: true });
  for (const [file, response] of Object.entries(responses)) {
    await writeFile(new URL(file, destination), `${JSON.stringify(response, null, 2)}\n`);
  }
  console.log(`Captured ${Object.keys(responses).length} sanitized responses from Linkding 1.46.2 and Readeck 0.23.2.`);
} finally {
  // Remove only resources created by this invocation, including anonymous data volumes.
  await docker("rm", "-fv", linkding, readeck).catch(() => {});
  await docker("network", "rm", name).catch(() => {});
}
