import { readFile } from 'node:fs/promises';

const modelUrl = new URL('../data/image-build-model.json', import.meta.url);
const model = JSON.parse(await readFile(modelUrl, 'utf8'));

for (const design of model.designs) {
  const layerIds = new Set(design.layers.map((layer) => layer.id));
  const coldSeconds = design.layers.reduce(
    (total, layer) => total + layer.durationSeconds,
    0,
  );

  for (const change of model.changes) {
    const invalidated = new Set(design.invalidations[change.id]);
    for (const layerId of invalidated) {
      if (!layerIds.has(layerId)) {
        throw new Error(`${design.id}/${change.id} references unknown layer ${layerId}`);
      }
    }
    const rebuildSeconds = design.layers.reduce(
      (total, layer) => total + (invalidated.has(layer.id) ? layer.durationSeconds : 0),
      0,
    );

    if (rebuildSeconds > coldSeconds) {
      throw new Error(`${design.id}/${change.id} exceeds its cold-build envelope`);
    }

    console.log(
      `${design.id.padEnd(14)} ${change.id.padEnd(13)} `
      + `${String(rebuildSeconds).padStart(3)}s rebuild, `
      + `${design.finalImageMb} MB final image`,
    );
  }
}
