type Product = { id: string; version: number; priceCents: number };

const cacheKey = (id: string) => `product:${id}`;

export async function readProduct(id: string): Promise<Product | null> {
  const cached = await cache.get<Product>(cacheKey(id));
  if (cached) return cached;

  const product = await database.products.findById(id);
  if (!product) return null;

  await cache.set(cacheKey(id), product, { ttlSeconds: 300, jitterSeconds: 30 });
  return product;
}

export async function changePrice(id: string, expectedVersion: number, priceCents: number) {
  const product = await database.transaction(async (tx) => {
    const updated = await tx.products.updateIfVersionMatches({
      id,
      expectedVersion,
      changes: { priceCents },
    });

    if (!updated) throw new Error('The product changed; reload before retrying.');

    await tx.outbox.insert({
      type: 'product.changed',
      key: id,
      version: updated.version,
    });
    return updated;
  });

  await cache.delete(cacheKey(id));
  return product;
}
