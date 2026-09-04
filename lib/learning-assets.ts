/** Keep downloaded practice separate when the authored content changes. */
export function learningAssetUrl(path: string, revision?: string) {
  if (!revision) return path;
  return `${path}${path.includes("?") ? "&" : "?"}learningRevision=${encodeURIComponent(revision)}`;
}
