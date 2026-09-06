/**
 * Device Info API Route
 *
 * Captures server-side information that client-side code cannot access:
 * - IP Address
 * - Geolocation (via IP lookup)
 *
 * This endpoint is called during user authentication to enrich device data
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers, type UnsafeUnwrappedHeaders } from 'next/headers';

// Free IP geolocation service (no API key required for basic usage)
// Alternatives: ipapi.co, ip-api.com, ipinfo.io (with API key)
const GEOLOCATION_API = 'https://ipapi.co';

interface GeolocationData {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  country_name?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  org?: string; // ISP/Organization
}

/**
 * Extract IP address from request headers
 * Handles various proxy and load balancer scenarios
 */
function getIPAddress(request: NextRequest): string {
  // Try various headers that might contain the real IP
  const headersList = (headers() as unknown as UnsafeUnwrappedHeaders);

  // Vercel/Cloudflare/Common proxies
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list, first one is the client
    return forwardedFor.split(',')[0].trim();
  }

  // Cloudflare
  const cfConnectingIp = headersList.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  // Other common headers
  const realIp = headersList.get('x-real-ip');
  if (realIp) return realIp;

  // Fallback to request IP (may be proxy IP)
  // Next 15 removed request.ip; the proxy header is the remaining source.
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  return ip;
}

/**
 * Lookup geolocation data from IP address
 */
async function getGeolocation(ip: string): Promise<GeolocationData | null> {
  // Don't lookup localhost or private IPs
  if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {
      ip,
      city: 'Local',
      region: 'Local',
      country: 'Local',
      country_name: 'Local Development',
    };
  }

  try {
    // Using ipapi.co - free tier allows 1000 requests/day without API key
    const response = await fetch(`${GEOLOCATION_API}/${ip}/json/`, {
      headers: {
        'User-Agent': 'SystemDesigner-DeviceTracking/1.0',
      },
      // Cache for 1 hour to reduce API calls
      next: { revalidate: 3600 },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      // Log specific rate limit errors
      if (response.status === 429) {
        console.warn(`⚠️ Geolocation API rate limit reached (429). IP-only data will be stored.`);
      } else {
        console.error('Geolocation API error:', response.status, response.statusText);
      }
      return { ip };
    }

    const data = await response.json() as GeolocationData;

    // Check for rate limit or error in response body
    // ipapi.co returns {error: true, reason: "RateLimited"} when quota exceeded
    if ('error' in data && data.error) {
      const reason = (data as any).reason || 'Unknown';
      console.warn(`⚠️ Geolocation API error: ${reason}. Falling back to IP-only data.`);
      return { ip };
    }

    // Additional validation - ensure we got meaningful data
    if (!data.city && !data.country && !data.timezone) {
      console.warn('⚠️ Geolocation API returned empty data. Using IP-only.');
      return { ip };
    }

    return {
      ip: data.ip || ip,
      city: data.city,
      region: data.region,
      country: data.country,
      country_name: data.country_name,
      timezone: data.timezone,
      latitude: data.latitude,
      longitude: data.longitude,
      org: data.org,
    };
  } catch (error) {
    console.error('Error fetching geolocation:', error);
    return { ip };
  }
}

/**
 * POST /api/device-info
 *
 * Request body:
 * {
 *   clientData: {
 *     userAgent: string;
 *     timezone: string;
 *     // ... other client-side data
 *   }
 * }
 *
 * Response:
 * {
 *   ip: string;
 *   location: {
 *     city: string;
 *     region: string;
 *     country: string;
 *     timezone: string;
 *   };
 *   serverTimestamp: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse client data
    const body = await request.json();
    const clientData = body.clientData || {};

    // Get IP address from request
    const ip = getIPAddress(request);

    // Lookup geolocation
    const geoData = await getGeolocation(ip);

    // Combine server-side and client-side data
    const enrichedData = {
      ip: geoData?.ip || ip,
      location: {
        city: geoData?.city,
        region: geoData?.region,
        country: geoData?.country,
        country_name: geoData?.country_name,
        timezone: geoData?.timezone || clientData.timezone, // Fallback to client timezone
        latitude: geoData?.latitude,
        longitude: geoData?.longitude,
        isp: geoData?.org,
      },
      serverTimestamp: new Date().toISOString(),
    };

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error('Error in device-info API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch device information' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/device-info
 *
 * Simple endpoint to get IP and location without additional data
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getIPAddress(request);
    const geoData = await getGeolocation(ip);

    return NextResponse.json({
      ip: geoData?.ip || ip,
      location: {
        city: geoData?.city,
        region: geoData?.region,
        country: geoData?.country,
        country_name: geoData?.country_name,
        timezone: geoData?.timezone,
      },
    });
  } catch (error) {
    console.error('Error in device-info API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch device information' },
      { status: 500 }
    );
  }
}
