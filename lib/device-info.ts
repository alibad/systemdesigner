/**
 * Device Information Utilities
 *
 * Parse user agent and browser information for user tracking
 * Includes server-side enrichment via API route for IP and geolocation
 */

export interface ParsedDeviceInfo {
  userAgent: string;
  browser?: string;
  os?: string;
  device?: string;
  isMobile: boolean;
}

export interface EnrichedDeviceInfo extends ParsedDeviceInfo {
  ip?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    country_name?: string;
    timezone?: string;
    latitude?: number;
    longitude?: number;
    isp?: string;
  };
}

/**
 * Parse user agent string to extract device information
 */
export function parseUserAgent(userAgent: string): ParsedDeviceInfo {
  const ua = userAgent.toLowerCase();

  // Detect browser
  let browser: string | undefined;
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera';
  }

  // Detect OS
  let os: string | undefined;
  if (ua.includes('win')) {
    os = 'Windows';
  } else if (ua.includes('mac')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    os = 'iOS';
  }

  // Detect device type
  let device: string | undefined;
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);

  if (ua.includes('iphone')) {
    device = 'iPhone';
  } else if (ua.includes('ipad')) {
    device = 'iPad';
  } else if (ua.includes('android')) {
    device = 'Android';
  } else if (isMobile) {
    device = 'Mobile';
  } else {
    device = 'Desktop';
  }

  return {
    userAgent,
    browser,
    os,
    device,
    isMobile
  };
}

/**
 * Get current device information from browser
 */
export function getCurrentDeviceInfo(): ParsedDeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: 'unknown',
      isMobile: false
    };
  }

  return parseUserAgent(navigator.userAgent);
}

/**
 * Get timezone information
 */
export function getTimezone(): string {
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return 'Unknown';
}

/**
 * Generate a unique device fingerprint based on available information
 * Note: This is a simple fingerprint, not cryptographically secure
 */
export function generateDeviceFingerprint(deviceInfo: ParsedDeviceInfo): string {
  const parts = [
    deviceInfo.browser || 'unknown',
    deviceInfo.os || 'unknown',
    deviceInfo.device || 'unknown',
    getTimezone()
  ];

  return parts.join('|');
}

/**
 * Fetch enriched device information including IP and geolocation
 * This calls the server-side API route to get information not available client-side
 */
export async function getEnrichedDeviceInfo(): Promise<EnrichedDeviceInfo> {
  const baseDeviceInfo = getCurrentDeviceInfo();
  const timezone = getTimezone();

  try {
    // Call server-side API to get IP and geolocation
    const response = await fetch('/api/device-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientData: {
          userAgent: baseDeviceInfo.userAgent,
          timezone,
        },
      }),
    });

    if (!response.ok) {
      console.warn('Failed to fetch enriched device info, using client-side data only');
      return {
        ...baseDeviceInfo,
        location: { timezone },
      };
    }

    const serverData = await response.json();

    return {
      ...baseDeviceInfo,
      ip: serverData.ip,
      location: {
        ...serverData.location,
        // Ensure client timezone is included if server didn't provide one
        timezone: serverData.location?.timezone || timezone,
      },
    };
  } catch (error) {
    console.error('Error fetching enriched device info:', error);
    // Fallback to client-side data only
    return {
      ...baseDeviceInfo,
      location: { timezone },
    };
  }
}
