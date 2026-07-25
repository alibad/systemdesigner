# Device Tracking Setup Guide

## Quick Start

This guide explains how the device tracking and IP geolocation features work in your application.

## ✅ What's Already Set Up

### 1. Device Detection (Client-Side) ✅
**Files:**
- `lib/device-info.ts` - Device detection utilities
- `lib/firebase-types.ts` - TypeScript interfaces for DeviceInfo

**Features:**
- Browser detection (Chrome, Safari, Firefox, Edge, Opera)
- OS detection (Windows, macOS, Linux, Android, iOS)
- Device type (Desktop, iPhone, iPad, Android, Mobile)
- Mobile detection
- Timezone capture

### 2. IP & Geolocation (Server-Side) ✅
**Files:**
- `app/api/device-info/route.ts` - Next.js API route

**Features:**
- IP address extraction from request headers
- Geolocation lookup via ipapi.co (free, no API key needed)
- City, region, country, timezone, coordinates, ISP
- Caching (1 hour) to reduce API calls
- Graceful fallback if API fails

### 3. User Document Storage ✅
**Files:**
- `lib/firebase.ts` - `createOrUpdateUserDocument()` function

**Features:**
- Automatic device tracking on login/signup
- Multiple device support with deduplication
- Per-device login count tracking
- IP address and geolocation storage

### 4. Admin UI ✅
**Files:**
- `app/admin/users/page.tsx` - User list with device info
- `app/admin/users/[userId]/page.tsx` - Detailed device view

**Features:**
- Device/Location column in user list
- Full device history in user detail page
- IP addresses, locations, timezones, ISP info

## 🚀 How It Works

### User Flow

1. **User signs in** via Google OAuth
2. **Client-side detection** captures browser, OS, device type
3. **Server-side enrichment** calls `/api/device-info` to get IP and geolocation
4. **Device fingerprint** is created from browser + OS + device + timezone
5. **Firestore update**:
   - If device exists (same fingerprint): Update `lastSeen` and increment `loginCount`
   - If new device: Add to `devices` array with full info
6. **Admin can view** all device/location data in admin panel

### Data Flow Diagram

```
User Login
    ↓
getCurrentDeviceInfo()
    ↓ (browser, os, device)
    ↓
POST /api/device-info
    ↓ (extract IP from headers)
    ↓
ipapi.co lookup
    ↓ (city, region, country, coordinates)
    ↓
Return enriched data
    ↓
createOrUpdateUserDocument()
    ↓
Firestore: users/{uid}/devices[]
    ↓
Admin UI displays all info
```

## 🔧 Configuration

### Default Settings (No Changes Needed)

The system is **ready to use out of the box** with these defaults:

- **Geolocation service**: ipapi.co (free, 1,000 requests/day)
- **Cache duration**: 1 hour
- **Device fingerprinting**: Browser + OS + Device + Timezone

### Optional: Upgrade Geolocation Service

If you exceed 1,000 requests/day or want more reliability:

#### Option 1: ipinfo.io (Recommended for production)

1. Sign up at https://ipinfo.io
2. Get your API token
3. Update `app/api/device-info/route.ts`:

```typescript
// Add your API token
const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

// Update the API URL
const response = await fetch(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`);
```

4. Add to `.env.local`:
```
IPINFO_TOKEN=your_token_here
```

#### Option 2: ip-api.com (Free alternative)

Update `app/api/device-info/route.ts`:
```typescript
const response = await fetch(`http://ip-api.com/json/${ip}`);
```

**Note:** Free version has a 45 requests/minute limit.

### Optional: Adjust Cache Duration

In `app/api/device-info/route.ts`, modify:

```typescript
next: { revalidate: 3600 } // 1 hour (default)

// Change to:
next: { revalidate: 86400 } // 24 hours (fewer API calls)
// or
next: { revalidate: 300 }   // 5 minutes (more real-time)
```

## 📊 Monitoring

### Check API Usage

1. **Monitor free tier usage** at https://ipapi.co/account
2. **Check Vercel logs** for API route errors
3. **Look for geolocation warnings** in browser console during testing

### Expected Usage

- **Per user login**: 1 API call to `/api/device-info`
- **Cached for**: 1 hour (repeated logins use cached data)
- **Typical usage**: 500-1000 unique logins per day = 500-1000 API calls/day

### Rate Limit Handling

If you hit the 1,000/day limit:
- System automatically falls back to client-side data (timezone only)
- IP address still captured (from request headers)
- Geolocation data will be empty until limit resets

## 🧪 Testing

### Local Development

```bash
# Start dev server
npm run dev

# Visit admin panel
http://localhost:3000/admin/users

# Sign in with your Google account
# Check your user in the list - device info will show "Local Development"
```

**Note:** In development, IP will show as `127.0.0.1` and location as "Local Development".

### Production Testing

1. **Deploy to Vercel** (or your hosting platform)
2. **Sign in** from production URL
3. **Check admin panel** at `https://yourdomain.com/admin/users`
4. **Verify**: Your real IP and location should appear

### Test from Multiple Devices

1. Sign in from **different browsers** (Chrome, Safari, Firefox)
2. Sign in from **mobile device** (phone/tablet)
3. Sign in from **different locations** (home, work, coffee shop)
4. Check admin panel - you should see separate entries for each device

### Test API Endpoint Directly

```bash
# Check your IP and location
curl https://yourdomain.com/api/device-info

# Should return:
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

## 🔒 Privacy Compliance

### GDPR Requirements

If your users are in the EU, consider:

1. **Privacy Policy**: Add disclosure about IP address collection
2. **Cookie Consent**: May need consent for IP tracking (consult legal)
3. **Data Deletion**: Implement user data deletion on request
4. **Data Export**: Allow users to export their data

### Recommended Privacy Policy Text

```
Device and Location Information
We collect information about the devices you use to access our service,
including IP addresses and approximate geographic location based on your
IP address. This helps us provide security, prevent fraud, and improve
our service.

You can request deletion of this information by contacting us at
privacy@yourdomain.com.
```

## 🐛 Troubleshooting

### Problem: IP shows as "127.0.0.1" or "::1"

**Cause:** Running on localhost

**Solution:** This is expected in development. Deploy to production or use ngrok/localtunnel for testing.

### Problem: Location not appearing

**Causes:**
1. Rate limit reached (>1,000 requests/day)
2. Network error
3. ipapi.co service down

**Solutions:**
1. Check browser console for errors
2. Check `/api/device-info` endpoint directly
3. Switch to alternative geolocation service

### Problem: Wrong location displayed

**Cause:** IP geolocation is approximate (city-level accuracy)

**Solution:** This is expected. IP-based geolocation has ~50-100km accuracy. For precise location, you'd need GPS (which requires user permission).

### Problem: Duplicate device entries

**Cause:** Device fingerprint changed (e.g., browser updated, timezone changed)

**Solution:** This is expected. Each unique fingerprint creates a new device entry. Consider implementing device management UI for users to merge devices.

## 📈 Scaling Considerations

### Current Setup (Free Tier)
- **Traffic**: Up to ~30,000 unique logins/month
- **Cost**: $0
- **Service**: ipapi.co free tier

### When to Upgrade

#### Small Business (30K-100K logins/month)
**Recommended:** ipinfo.io Standard plan
- **Cost:** $149/month
- **Limits:** 250,000 requests/month
- **Setup:** Add API key to environment variables

#### Medium Business (100K-500K logins/month)
**Recommended:** ipgeolocation.io
- **Cost:** $49/month
- **Limits:** 600,000 requests/month
- **Setup:** Similar to ipinfo.io

#### Large Scale (>500K logins/month)
**Recommended:** MaxMind GeoIP2
- **Cost:** $50/month for database license
- **Limits:** Unlimited (self-hosted database)
- **Setup:** Requires database hosting and lookup implementation

## 🎯 Next Steps

### Basic Setup (Complete) ✅
- ✅ Device detection working
- ✅ IP capture working
- ✅ Geolocation lookup working
- ✅ Admin UI showing data

### Optional Enhancements

1. **User-facing device management**
   - Let users see their own devices
   - Allow users to name devices ("Work laptop", "Personal phone")
   - Allow users to revoke device access

2. **Security features**
   - Email alerts for new device logins
   - Flag suspicious login patterns (multiple countries in short time)
   - Two-factor authentication prompts for new devices

3. **Analytics dashboards**
   - Geographic distribution of users
   - Popular browsers/OS
   - Mobile vs desktop usage

4. **Advanced tracking**
   - VPN/Proxy detection
   - Device reputation scoring
   - Session management per device

## 📚 Additional Resources

- [Full Device Tracking Documentation](./device-tracking.md)
- [IP & Geolocation Deep Dive](./ip-geolocation-tracking.md)
- [Privacy & GDPR Compliance Guide](./gdpr-compliance.md) *(coming soon)*

## 💬 Support

If you encounter issues:
1. Check browser console for errors
2. Review Vercel/hosting platform logs
3. Test `/api/device-info` endpoint directly
4. Check this documentation for troubleshooting tips

---

**Last Updated:** January 2025
