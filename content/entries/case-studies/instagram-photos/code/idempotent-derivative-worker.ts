type DerivativeJob = {
  photoId: string;
  sourceVersion: number;
  profileVersion: number;
  originalKey: string;
  originalChecksum: string;
};

type Services = {
  manifests: {
    find(key: string): Promise<{ status: 'published' | 'blocked' } | null>;
    commitIfAbsent(input: {
      key: string;
      derivatives: Array<{ key: string; checksum: string }>;
      moderation: 'eligible' | 'review' | 'blocked';
    }): Promise<boolean>;
  };
  objects: {
    readVerified(key: string, checksum: string): Promise<Uint8Array>;
    putIfAbsent(key: string, bytes: Uint8Array): Promise<string>;
  };
  images: {
    render(bytes: Uint8Array, profileVersion: number): Promise<Array<{ name: string; bytes: Uint8Array }>>;
  };
  moderation: {
    classify(bytes: Uint8Array): Promise<'eligible' | 'review' | 'blocked'>;
  };
  events: {
    publishOnce(key: string, event: { type: 'media.version.ready'; photoId: string; manifestKey: string }): Promise<void>;
  };
};

export async function processDerivativeJob(job: DerivativeJob, services: Services) {
  const versionKey = `${job.photoId}:s${job.sourceVersion}:p${job.profileVersion}`;
  const existing = await services.manifests.find(versionKey);
  if (existing) return existing;

  const original = await services.objects.readVerified(job.originalKey, job.originalChecksum);
  const [renders, moderation] = await Promise.all([
    services.images.render(original, job.profileVersion),
    services.moderation.classify(original),
  ]);

  const derivatives = await Promise.all(
    renders.map(async (render) => {
      const key = `photos/${job.photoId}/${versionKey}/${render.name}`;
      const checksum = await services.objects.putIfAbsent(key, render.bytes);
      return { key, checksum };
    }),
  );

  const electedPublisher = await services.manifests.commitIfAbsent({
    key: versionKey,
    derivatives,
    moderation,
  });

  if (electedPublisher && moderation === 'eligible') {
    await services.events.publishOnce(versionKey, {
      type: 'media.version.ready',
      photoId: job.photoId,
      manifestKey: versionKey,
    });
  }

  return { status: moderation };
}
