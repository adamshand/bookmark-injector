export function nextPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Expected a major.minor.patch version, got ${version}`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}
