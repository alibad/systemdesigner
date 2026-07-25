/**
 * Environment-aware utility functions
 */

/**
 * Get the base URL for the application based on environment
 * - Production: https://systemdesigner.net
 * - Development: http://localhost:3000
 * - Preview: Uses VERCEL_URL if available
 */
export function getBaseUrl(): string {
  // Browser environment
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server environment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === 'production') {
    return 'https://systemdesigner.net';
  }

  return 'http://localhost:3000';
}

/**
 * Parse a URL that might be absolute or relative
 * @param url The URL to parse (can be relative or absolute)
 * @returns A URL object with the correct base
 */
export function parseUrl(url: string): URL {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return new URL(url);
  }
  return new URL(url, getBaseUrl());
}
