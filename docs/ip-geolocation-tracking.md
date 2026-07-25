# IP Address & Geolocation Tracking

## Overview

The application now includes **server-side IP address and geolocation tracking** via a Next.js API route. This enhancement provides much richer user identification data beyond what's available client-side.

## Architecture

### Client-Server Flow

```
┌─────────────┐
│   Browser   │
│  (Client)   │
└──────┬──────┘
       │
       │ 1. User logs in / signs up
       │
       ▼
┌─────────────────────────────────────┐
│ lib/firebase.ts                     │
│ createOrUpdateUserDocument()        │
└──────┬──────────────────────────────┘
       │
       │ 2. Calls getEnrichedDeviceInfo()
       │
       ▼
┌─────────────────────────────────────┐
│ lib/device-info.ts                  │
│ getEnrichedDeviceInfo()             │
└──────┬──────────────────────────────┘
       │
       │ 3. POST /api/device-info
       │
       ▼
┌─────────────────────────────────────┐
│ app/api/device-info/route.ts        │
│ - Extract IP from headers           │
│ - Lookup geolocation via ipapi.co   │
│ - Return enriched data              │
└──────┬──────────────────────────────┘
       │
       │ 4. Returns: { ip, location: {...} }
       │
       ▼
┌─────────────────────────────────────┐
│ Firestore: users/{userId}           │
│ devices[].ipAddress                 │
│ devices[].location { city, region,  │
│   country, timezone, lat, lng }     │
└─────────────────────────────────────┘
```

## API Route: `/api/device-info`

### Location
`app/api/device-info/route.ts`

### Endpoints

#### POST `/api/device-info`
Captures and enriches device information with IP and geolocation.

**Request:**
```json
{
  "clientData": {
    "userAgent": "Mozilla/5.0...",
    "timezone": "America/Los_Angeles"
  }
}
```

**Response:**
```json
{
  "ip": "123.45.67.89",
  "location": {
    "city": "San Francisco",
    "region": "California",
    "country": "US",
    "country_name": "United States",
    "timezone": "America/Los_Angeles",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "isp": "Comcast Cable"
  },
  "serverTimestamp": "2025-01-15T12:34:56.789Z"
}
```

#### GET `/api/device-info`
Simple endpoint to check IP and location without additional client data.

**Response:**
```json
{
  "ip": "123.45.67.89",
  "location": {
    "city": "San Francisco",
    "region": "California",
    "country": "US",
    "country_name": "United States",
    "timezone": "America/Los_Angeles"
  }
}
```

### IP Address Extraction

The API route extracts the client's IP address from various headers to handle different hosting environments:

1. **`x-forwarded-for`** - Most common header set by proxies/load balancers (Vercel, AWS, etc.)
2. **`cf-connecting-ip`** - Cloudflare-specific header
3. **`x-real-ip`** - Alternative header used by some proxies
4. **Fallback** - Direct request IP (may be proxy IP)

**Important:** In development (localhost), the IP will be `127.0.0.1` or `::1` and will be displayed as "Local".

### Geolocation Service

#### Default: ipapi.co (Free)
- **Free tier**: 1,000 requests/day (no API key required)
- **Provides**: City, region, country, timezone, coordinates, ISP
- **Caching**: Responses cached for 1 hour to reduce API calls
- **Rate limiting**: Handled gracefully with fallback to IP-only data

#### Alternative Services

You can easily swap in other services by modifying the `getGeolocation()` function:

**ip-api.com (Free, no API key)**
```typescript
const response = await fetch(`http://ip-api.com/json/${ip}`);
// Free: 45 requests/minute
// Provides: Similar data to ipapi.co
```

**ipinfo.io (Requires API key)**
```typescript
const response = await fetch(`https://ipinfo.io/${ip}?token=YOUR_API_KEY`);
// Free tier: 50,000 requests/month
// More reliable than free services
```

**MaxMind GeoIP2 (Requires account)**
- Most accurate commercial solution
- Requires local database or API subscription
- Best for high-traffic applications

## Data Storage

### Firestore Structure

Each device in the `devices` array now includes:

```typescript
{
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  isMobile: boolean;
  fingerprint: string;
  ipAddress: string;        // NEW: IP address
  firstSeen: Timestamp;
  lastSeen: Timestamp;
  loginCount: number;
  location: {               // NEW: Geolocation data
    city: string;
    region: string;
    country: string;
    country_name: string;
    timezone: string;
    latitude: number;
    longitude: number;
    isp: string;
  }
}
```

## Admin UI Updates

### User List (`/admin/users`)
The "Device/Location" column now shows location if available:
- Browser • OS (e.g., "Chrome • macOS")
- Device type
- **NEW:** Location hint (coming soon in tooltip/hover)

### User Detail (`/admin/users/[userId]`)
The "Devices & Location" section now displays:
- **IP Address** - Client's IP address (monospace font)
- **Location** - City, Region, Country (e.g., "San Francisco, California, United States")
- **Timezone** - User's timezone
- **ISP** - Internet Service Provider name

## Privacy & Security

### GDPR Compliance
IP addresses are considered Personal Identifiable Information (PII) under GDPR. Consider:

1. **Privacy Policy**: Disclose that you collect IP addresses
2. **User Consent**: Add consent mechanism if required by jurisdiction
3. **Data Retention**: Implement IP address anonymization/deletion after X days
4. **User Rights**: Allow users to request deletion of their IP addresses

### Security Best Practices

1. **Admin-Only Access**: Only admins can view IP addresses
2. **Encrypted Storage**: Firestore encrypts data at rest
3. **Rate Limiting**: Consider adding rate limiting to the API route
4. **IP Anonymization**: Consider anonymizing IPs after 90 days (optional)

### Example: IP Anonymization

Add to your Firestore rules or use a Cloud Function:

```typescript
// Anonymize IP after 90 days
function anonymizeOldIPs() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  devices.forEach(device => {
    if (device.firstSeen.toDate() < ninetyDaysAgo) {
      device.ipAddress = 'anonymized';
      device.location = { timezone: device.location.timezone }; // Keep only timezone
    }
  });
}
```

## Production Considerations

### Rate Limiting

The free ipapi.co service has a 1,000 requests/day limit. For production:

1. **Caching**: API responses are cached for 1 hour
2. **Fallback**: System gracefully falls back to client-side data if API fails
3. **Monitoring**: Monitor API usage in production
4. **Paid Service**: Consider upgrading to a paid service for high-traffic sites

### Error Handling

The implementation includes comprehensive error handling:

- **API Failures**: Falls back to client-side data (timezone only)
- **Rate Limits**: Logs warning and continues without geolocation
- **Network Errors**: Catches and logs errors, returns basic device info

### Testing

#### Local Development
- IP will be `127.0.0.1` or `::1`
- Location will show as "Local Development"
- Timezone will be captured from browser

#### Production Testing
1. Deploy to Vercel/production
2. Sign in from different locations
3. Check admin panel for accurate IP/location data
4. Test from VPN to verify different locations

#### Test Endpoints

```bash
# Get your current IP and location
curl https://yourdomain.com/api/device-info

# Test with specific client data
curl -X POST https://yourdomain.com/api/device-info \
  -H "Content-Type: application/json" \
  -d '{"clientData":{"timezone":"America/New_York"}}'
```

## Future Enhancements

1. **VPN Detection**: Flag potential VPN/proxy usage
2. **Fraud Detection**: Detect suspicious login patterns (multiple countries in short time)
3. **Security Alerts**: Notify users of logins from new locations
4. **User Dashboard**: Show users their own device/location history
5. **Advanced Analytics**: Geographic distribution of users, popular regions
6. **IP Blocklisting**: Block known malicious IPs or regions

## Troubleshooting

### "IP shows as 127.0.0.1"
- **Cause**: Running locally
- **Solution**: Deploy to production or test with ngrok/localtunnel

### "Location not showing"
- **Cause**: API rate limit reached or network error
- **Solution**: Check browser console for errors, verify ipapi.co is accessible

### "Wrong location displayed"
- **Cause**: IP geolocation is approximate, not precise
- **Solution**: This is expected behavior; IP geolocation has ~city-level accuracy

### "Rate limit errors in production"
- **Cause**: Exceeded 1,000 requests/day on free tier
- **Solution**: Upgrade to paid ipinfo.io or implement more aggressive caching

## Configuration

### Switching Geolocation Providers

Edit `app/api/device-info/route.ts`:

```typescript
// Change this constant
const GEOLOCATION_API = 'https://ipapi.co';

// To one of these:
// 'http://ip-api.com'           // Free, 45 req/min
// 'https://ipinfo.io'           // Requires API key
// 'https://api.ipgeolocation.io' // Requires API key
```

### Adjusting Cache Duration

```typescript
// In getGeolocation()
next: { revalidate: 3600 } // 1 hour (default)
next: { revalidate: 86400 } // 24 hours (less API calls)
next: { revalidate: 300 }   // 5 minutes (more accurate)
```

## Cost Analysis

### Free Services
- **ipapi.co**: 1,000 requests/day = ~30K requests/month (free)
- **ip-api.com**: Unlimited non-commercial use (with rate limit)

### Paid Services (for scaling)
- **ipinfo.io**: $149/month for 250K requests
- **ipgeolocation.io**: $15/month for 150K requests
- **MaxMind**: $50/month for unlimited lookups (requires database hosting)

### Recommendation
- **<30K users/month**: Use free ipapi.co
- **30K-100K users**: Use ipinfo.io or ipgeolocation.io
- **>100K users**: Use MaxMind database for cost efficiency

## Related Documentation
- [Device Tracking Overview](./device-tracking.md)
- [Firebase Types](../lib/firebase-types.ts)
- [API Route Implementation](../app/api/device-info/route.ts)
