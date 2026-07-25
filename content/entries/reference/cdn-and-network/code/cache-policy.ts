type CachePolicy = {
  visibility: 'public' | 'private';
  edgeSeconds: number;
  browserSeconds: number;
  staleIfErrorSeconds: number;
  immutable: boolean;
};

export function cacheControl(policy: CachePolicy): string {
  const directives = [
    policy.visibility,
    `max-age=${policy.browserSeconds}`,
    `s-maxage=${policy.edgeSeconds}`,
    `stale-if-error=${policy.staleIfErrorSeconds}`,
  ];
  if (policy.immutable) directives.push('immutable');
  return directives.join(', ');
}

export const versionedAsset = cacheControl({
  visibility: 'public',
  edgeSeconds: 31_536_000,
  browserSeconds: 31_536_000,
  staleIfErrorSeconds: 86_400,
  immutable: true,
});
