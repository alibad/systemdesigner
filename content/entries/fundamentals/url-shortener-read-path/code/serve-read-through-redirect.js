const inflightLoads = new Map();

export async function redirect(request, dependencies) {
  const code = normalizeCode(request.params.code);
  const cached = await dependencies.cache.get(code);
  const mapping = cached ?? await loadOnce(code, dependencies);

  if (!mapping || mapping.state === 'expired' || mapping.state === 'disabled') {
    return { status: mapping ? 410 : 404 };
  }

  dependencies.analytics.publish({
    eventId: request.id,
    type: 'short_link_opened',
    code,
    occurredAt: new Date().toISOString(),
  }).catch((error) => dependencies.logger.warn({ error, code }, 'analytics publish failed'));

  return {
    status: mapping.redirectStatus,
    headers: {
      location: mapping.destination,
      'cache-control': mapping.responseCacheControl,
    },
  };
}

async function loadOnce(code, dependencies) {
  const existingLoad = inflightLoads.get(code);
  if (existingLoad) return existingLoad;

  const load = dependencies.store
    .getMapping(code, { timeoutMs: 45 })
    .then(async (mapping) => {
      const entry = mapping ?? { state: 'missing' };
      await dependencies.cache.set(code, entry, {
        ttlSeconds: mapping ? jitter(300, 0.15) : 15,
      });
      return mapping;
    })
    .finally(() => inflightLoads.delete(code));

  inflightLoads.set(code, load);
  return load;
}

function normalizeCode(value) {
  if (!/^[A-Za-z0-9_-]{4,16}$/.test(value)) {
    throw new Error('invalid short code');
  }
  return value;
}

function jitter(seconds, ratio) {
  const spread = seconds * ratio;
  return Math.round(seconds - spread + Math.random() * spread * 2);
}
