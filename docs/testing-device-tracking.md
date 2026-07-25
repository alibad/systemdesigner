# Testing Device Tracking Locally

## Quick Test Options

### Option 1: Test Page (Recommended) ⭐

Visit the built-in test page:

```
http://localhost:3000/api/device-info/test
```

This page lets you:
- ✅ Test GET endpoint
- ✅ Test POST endpoint with client data
- ✅ Test the full authentication flow
- ✅ See formatted results with explanations
- ✅ View raw JSON responses

**Screenshot of what you'll see:**
- Your IP address (127.0.0.1 locally, real IP in production)
- Browser, OS, device type
- Location data (if available)
- Clear explanation of what each field means

---

### Option 2: cURL Commands (Quick & Simple)

```bash
# Test 1: GET endpoint (simplest)
curl http://localhost:3000/api/device-info

# Expected output (local):
# {
#   "ip": "127.0.0.1",
#   "location": {
#     "city": "Local",
#     "region": "Local",
#     "country": "Local",
#     "country_name": "Local Development"
#   }
# }

# Test 2: POST endpoint with client data
curl -X POST http://localhost:3000/api/device-info \
  -H "Content-Type: application/json" \
  -d '{"clientData":{"timezone":"America/Los_Angeles"}}'

# Expected output (local):
# {
#   "ip": "127.0.0.1",
#   "location": {
#     "city": "Local",
#     "region": "Local",
#     "country": "Local",
#     "country_name": "Local Development",
#     "timezone": "America/Los_Angeles"
#   },
#   "serverTimestamp": "2025-01-15T12:34:56.789Z"
# }
```

---

### Option 3: Browser Console (Interactive)

Open your browser console and run:

```javascript
// Test 1: Simple GET
fetch('/api/device-info')
  .then(r => r.json())
  .then(console.log);

// Test 2: POST with client data
fetch('/api/device-info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientData: {
      userAgent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  })
})
  .then(r => r.json())
  .then(console.log);

// Test 3: Full flow (actual function used during login)
import('/lib/device-info.js')
  .then(m => m.getEnrichedDeviceInfo())
  .then(console.log);
```

---

### Option 4: Test Real Login Flow

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Sign in with Google:**
   - Go to `http://localhost:3000`
   - Click "Sign In with Google"
   - Complete authentication

3. **Check Firestore:**
   - Open Firebase Console → Firestore
   - Navigate to `users/{your-uid}`
   - Look for `devices` array
   - You should see:
     ```json
     {
       "devices": [{
         "browser": "Chrome",
         "os": "macOS",
         "device": "Desktop",
         "ipAddress": "127.0.0.1",
         "location": {
           "city": "Local",
           "region": "Local",
           "country": "Local",
           "country_name": "Local Development",
           "timezone": "America/Los_Angeles"
         },
         "loginCount": 1,
         "firstSeen": "...",
         "lastSeen": "..."
       }]
     }
     ```

4. **Check Admin Panel:**
   - Go to `http://localhost:3000/admin/users`
   - Find your user
   - Click to view details
   - Look for "Devices & Location" section

---

## Testing with Real IP (Not Localhost)

### Method 1: Deploy to Vercel (Easiest)

1. **Deploy your app:**
   ```bash
   git add .
   git commit -m "Add device tracking"
   git push
   ```

2. **Test on production:**
   - Visit `https://yourdomain.vercel.app/api/device-info/test`
   - Sign in with your account
   - Check admin panel

**You'll see:**
- ✅ Real IP address (not 127.0.0.1)
- ✅ Real city, region, country
- ✅ Real ISP name
- ✅ Accurate timezone
- ✅ GPS coordinates

---

### Method 2: Use ngrok (Local Testing with Real IP)

**What is ngrok?** Creates a public URL for your localhost so it acts like production.

1. **Install ngrok:**
   ```bash
   # macOS
   brew install ngrok

   # Or download from https://ngrok.com/download
   ```

2. **Start your dev server:**
   ```bash
   npm run dev
   ```

3. **Create ngrok tunnel:**
   ```bash
   ngrok http 3000
   ```

4. **You'll see:**
   ```
   Session Status    online
   Forwarding        https://abc123.ngrok.io -> http://localhost:3000
   ```

5. **Test with the ngrok URL:**
   - Visit `https://abc123.ngrok.io/api/device-info/test`
   - You'll get REAL IP and location data!

**Note:** ngrok gives you a real public IP, so ipapi.co will return actual geolocation!

---

### Method 3: Use Vercel Preview Deployments

1. **Create a branch:**
   ```bash
   git checkout -b test-device-tracking
   git push origin test-device-tracking
   ```

2. **Vercel creates preview:**
   - Automatic preview URL: `https://systemdesigner-git-test-device-tracking-yourusername.vercel.app`

3. **Test on preview:**
   - Visit preview URL
   - Sign in
   - Check device tracking

**Benefit:** Real production environment, doesn't affect your main site!

---

## What to Look For During Testing

### ✅ Success Indicators

**Local Testing (localhost):**
- IP shows as `127.0.0.1` or `::1`
- Location shows as "Local Development"
- Browser, OS, device detected correctly
- Timezone is accurate
- No errors in console

**Production Testing (Vercel/ngrok):**
- Real IP address shown (check it matches your actual IP)
- City/region/country are accurate
- ISP name is shown
- Coordinates are roughly correct (within ~50km)
- No errors in console

### ⚠️ Warning Signs (Expected)

**These are NORMAL and not errors:**
- IP shows as `127.0.0.1` locally
- Location shows as "Local" locally
- City is approximate (not exact address)
- ISP might be generic ("Comcast" vs "Comcast Cable Communications LLC")

### ❌ Error Signs (Need Investigation)

**These indicate a problem:**
- No IP address at all (should at least show 127.0.0.1)
- 500 error when calling API
- `undefined` or `null` everywhere
- Browser console errors
- User can't log in (critical!)

---

## Simulating Different Scenarios

### Test 1: Rate Limit Simulation

**Modify `/app/api/device-info/route.ts` temporarily:**

```typescript
async function getGeolocation(ip: string): Promise<GeolocationData | null> {
  // TESTING: Simulate rate limit
  return { ip }; // Returns IP only, no location data

  // ... rest of function (comment this out)
}
```

**Expected behavior:**
- ✅ IP still captured
- ✅ Timezone still captured
- ❌ City/region/country missing
- ⚠️ Console shows: "Geolocation API returned empty data"

**Don't forget to revert this change!**

---

### Test 2: Network Failure Simulation

**Modify `/app/api/device-info/route.ts` temporarily:**

```typescript
async function getGeolocation(ip: string): Promise<GeolocationData | null> {
  // TESTING: Simulate network failure
  throw new Error('Simulated network error');

  // ... rest of function
}
```

**Expected behavior:**
- ✅ IP still captured
- ✅ Browser/OS/device still captured
- ✅ Timezone still captured (from client)
- ❌ No geolocation data
- ⚠️ Console shows error message

**Don't forget to revert this change!**

---

### Test 3: Multiple Devices

**Simulate different devices:**

1. **Desktop Chrome:**
   - Sign in from Chrome
   - Check admin panel → should show "Chrome • macOS/Windows"

2. **Mobile Safari:**
   - Open your phone
   - Visit your site
   - Sign in
   - Check admin panel → should show "Safari • iOS" + new device entry

3. **Desktop Firefox:**
   - Sign in from Firefox
   - Check admin panel → should show 3 devices now

**Expected result:**
- ✅ Each device appears separately
- ✅ Login count increments on repeated logins
- ✅ Different fingerprints for each device
- ✅ "lastSeen" updates on repeated logins

---

## Debugging Common Issues

### Issue 1: "IP shows as undefined"

**Cause:** Headers not being read correctly

**Debug:**
```typescript
// Add to /api/device-info/route.ts
console.log('Headers:', Object.fromEntries(headers().entries()));
```

**Solution:** Check if running behind a proxy, adjust header reading logic

---

### Issue 2: "Location data not showing in production"

**Cause:** Rate limit reached or API error

**Debug:**
1. Check Vercel logs for warnings
2. Test API endpoint directly: `curl https://yourdomain.com/api/device-info`
3. Check ipapi.co status: https://status.ipapi.co

**Solution:**
- Wait for rate limit reset (midnight UTC)
- Or upgrade to paid geolocation service

---

### Issue 3: "Device fingerprint creating duplicates"

**Cause:** Fingerprint changes (browser update, timezone change)

**Expected behavior:** This is normal! Each unique fingerprint = new device

**Solution:** Consider implementing device merging in future

---

## Verification Checklist

Use this checklist to verify everything works:

### Local Testing
- [ ] `npm run dev` starts without errors
- [ ] Visit `/api/device-info/test` page loads
- [ ] Click "Test GET" button - returns IP (127.0.0.1)
- [ ] Click "Test POST" button - includes timezone
- [ ] Click "Test Full Flow" - includes browser/OS
- [ ] Sign in with Google account works
- [ ] Check Firestore - `devices` array exists
- [ ] Check admin panel - user appears
- [ ] User detail page shows device info
- [ ] No errors in browser console
- [ ] No errors in terminal/server logs

### Production Testing
- [ ] Deploy to Vercel succeeds
- [ ] Visit production test page
- [ ] Test GET shows real IP (not 127.0.0.1)
- [ ] Test POST includes city/region/country
- [ ] Sign in on production
- [ ] Check admin panel - shows real location
- [ ] Test from mobile device
- [ ] Multiple devices show separately
- [ ] Login count increments correctly
- [ ] Check Vercel logs - no errors

---

## Quick Testing Commands

**Copy-paste these for quick testing:**

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Test API
curl http://localhost:3000/api/device-info | jq .

# Test with ngrok (if installed)
ngrok http 3000
# Then visit: https://YOUR-NGROK-URL.ngrok.io/api/device-info/test

# Deploy to Vercel
vercel --prod
```

**Browser console quick tests:**

```javascript
// Test 1: API endpoint
fetch('/api/device-info').then(r => r.json()).then(console.table)

// Test 2: Full flow
import('/lib/device-info.js').then(m => m.getEnrichedDeviceInfo()).then(console.table)

// Test 3: Check if running locally
console.log(window.location.hostname === 'localhost' ? '🏠 Local' : '🌐 Production')
```

---

## Next Steps After Testing

Once testing is complete:

1. ✅ Verify test page works (`/api/device-info/test`)
2. ✅ Deploy to production
3. ✅ Test real user flow (sign in, check admin panel)
4. ✅ Monitor Vercel logs for warnings
5. ✅ Track usage (should stay under 1,000/day initially)
6. ✅ Consider adding monitoring alerts
7. ✅ Update privacy policy (if needed)
8. ✅ Document for your team

---

**Happy Testing! 🚀**

If you encounter issues not covered here, check:
- [Rate Limit Handling Guide](./rate-limit-handling.md)
- [Full IP & Geolocation Documentation](./ip-geolocation-tracking.md)
