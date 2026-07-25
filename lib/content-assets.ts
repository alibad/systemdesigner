import { promises as fs } from 'node:fs';
import path from 'node:path';

const ASSET_DIRECTORIES = new Set(['code', 'quiz', 'data']);

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.cjs': 'text/javascript',
  '.cpp': 'text/x-c++src',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.go': 'text/x-go',
  '.gql': 'application/graphql',
  '.html': 'text/html',
  '.java': 'text/x-java-source',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.jsx': 'text/javascript',
  '.md': 'text/markdown',
  '.mdx': 'text/markdown',
  '.mjs': 'text/javascript',
  '.php': 'application/x-httpd-php',
  '.proto': 'text/plain',
  '.py': 'text/x-python',
  '.sh': 'application/x-sh',
  '.sql': 'application/sql',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
};

export interface ContentAsset {
  content: string;
  filePath: string;
}

export class InvalidContentAssetPathError extends Error {
  constructor() {
    super('Invalid content asset path');
    this.name = 'InvalidContentAssetPathError';
  }
}

export class ContentAssetNotFoundError extends Error {
  constructor() {
    super('Content asset not found');
    this.name = 'ContentAssetNotFoundError';
  }
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  if (!(error instanceof Error) || !('code' in error)) return false;
  return error.code === 'ENOENT' || error.code === 'ENOTDIR';
}

function isContainedPath(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function validatePathSegments(pathSegments: readonly string[]): void {
  if (pathSegments.length < 4 || !ASSET_DIRECTORIES.has(pathSegments[2])) {
    throw new InvalidContentAssetPathError();
  }

  for (const segment of pathSegments) {
    if (
      segment.length === 0 ||
      segment === '.' ||
      segment === '..' ||
      segment.includes('\0') ||
      segment.includes('/') ||
      segment.includes('\\') ||
      path.isAbsolute(segment)
    ) {
      throw new InvalidContentAssetPathError();
    }
  }
}

async function readFromEntries(
  projectRoot: string,
  pathSegments: readonly string[],
): Promise<ContentAsset | null> {
  const [section, slug, ...assetPath] = pathSegments;
  const basePath = path.resolve(projectRoot, 'content', 'entries');
  const lessonPath = path.resolve(basePath, section, slug);
  const candidatePath = path.resolve(lessonPath, ...assetPath);

  if (!isContainedPath(basePath, lessonPath) || !isContainedPath(lessonPath, candidatePath)) {
    throw new InvalidContentAssetPathError();
  }

  try {
    const [realBasePath, realLessonPath, realCandidatePath] = await Promise.all([
      fs.realpath(basePath),
      fs.realpath(lessonPath),
      fs.realpath(candidatePath),
    ]);

    if (
      !isContainedPath(realBasePath, realLessonPath) ||
      !isContainedPath(realLessonPath, realCandidatePath)
    ) {
      throw new InvalidContentAssetPathError();
    }

    const assetStats = await fs.stat(realCandidatePath);
    if (!assetStats.isFile()) return null;

    return {
      content: await fs.readFile(realCandidatePath, 'utf8'),
      filePath: realCandidatePath,
    };
  } catch (error) {
    if (error instanceof InvalidContentAssetPathError) throw error;
    if (isMissingPathError(error)) return null;
    throw new ContentAssetNotFoundError();
  }
}

export async function readContentAsset(
  pathSegments: readonly string[],
  projectRoot = process.cwd(),
): Promise<ContentAsset> {
  validatePathSegments(pathSegments);

  const asset = await readFromEntries(projectRoot, pathSegments);
  if (asset) return asset;

  throw new ContentAssetNotFoundError();
}

export function getContentAssetMimeType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'text/plain';
}

export function getContentAssetCacheControl(
  nodeEnv = process.env.NODE_ENV,
  vercelEnv = process.env.VERCEL_ENV,
): string {
  if (nodeEnv === 'production') return 'public, max-age=0, must-revalidate';
  if (vercelEnv === 'preview' || vercelEnv === 'staging') {
    return 'public, max-age=3600, must-revalidate';
  }
  return 'public, max-age=300, must-revalidate';
}
