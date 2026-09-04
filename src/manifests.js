export function firefoxManifest(chromeManifest) {
  return {
    ...chromeManifest,
    background: {
      scripts: [chromeManifest.background.service_worker],
    },
  };
}
