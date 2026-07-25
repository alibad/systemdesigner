# Device & Location Tracking

## Overview

The application now tracks device and location information for all registered users to help admins identify and understand their user base.

## What Information is Tracked?

### Per-Device Information
Each unique device/browser combination used by a user is tracked with:

- **Browser**: Chrome, Safari, Firefox, Edge, Opera
- **Operating System**: Windows, macOS, Linux, Android, iOS
- **Device Type**: Desktop, iPhone, iPad, Android, Mobile
- **User Agent**: Full user agent string
- **Mobile Detection**: Whether the device is mobile
- **Timezone**: User's local timezone
- **First Seen**: When the device was first used
- **Last Seen**: When the device was last used
- **Login Count**: Number of times logged in from this device

### User Profile
The user document also stores:

- **Last Device**: Quick reference to the most recently used device
- **Devices Array**: Complete list of all devices used by the user

## Where is This Data Stored?

All device information is stored in Firestore under the `users/{userId}` document:

```typescript
{
  uid: string;
  email: string;
  displayName: string;
  // ... other profile fields ...

  lastDevice: {
    userAgent: string;
    browser: string;
    os: string;
    device: string;
    isMobile: boolean;
  };

  devices: [{
    userAgent: string;
    browser: string;
    os: string;
    device: string;
    isMobile: boolean;
    fingerprint: string; // Device identifier
    firstSeen: Timestamp;
    lastSeen: Timestamp;
    loginCount: number;
    location: {
      timezone: string;
    };
  }];
}
```

## How Device Fingerprinting Works

Device fingerprinting is done client-side using:
- Browser type and version (from user agent)
- Operating system (from user agent)
- Device type (from user agent)
- Timezone

A simple fingerprint is created by combining: `{browser}|{os}|{device}|{timezone}`

This allows the system to recognize when a user logs in from the same device again and update the login count, rather than creating duplicate entries.

## When is Data Captured?

Device information is captured during the `createOrUpdateUserDocument` function, which is called:

1. **On user signup** (via Google OAuth)
2. **On user login** (via Google OAuth)
3. **On session restoration** (when returning to the site)

Anonymous users do NOT have device information tracked (only registered/authenticated users).

## Admin Features

### User List View
The admin user list (`/admin/users`) now includes a "Device/Location" column showing:
- Browser and OS of the last device used
- Device type
- Count of additional devices (e.g., "+2 more")

### User Detail View
The user detail page (`/admin/users/[userId]`) includes a "Devices & Location" section showing:
- All devices used by the user
- Device type icon (desktop or mobile)
- Browser and OS
- Login count per device
- Timezone
- First and last seen timestamps

## Limitations & Future Enhancements

### Current Limitations

1. **No IP Address Tracking**: IP addresses require server-side implementation (not available in client-side code)
2. **No Geolocation**: City, region, and country require an IP geolocation service
3. **Simple Fingerprinting**: The current fingerprinting is basic and may not distinguish between very similar devices

### Potential Enhancements

1. **IP Address & Geolocation**: Implement via Cloud Functions or API route to capture IP and lookup location
2. **Device Names**: Allow users to name their devices (e.g., "Work MacBook", "Personal iPhone")
3. **Security Alerts**: Notify users of logins from new devices
4. **Device Management**: Allow users to revoke device access or see their own device list
5. **Advanced Fingerprinting**: Use more sophisticated browser fingerprinting techniques
6. **Session Management**: Track active sessions per device

## Privacy Considerations

- Device information is collected transparently as part of the authentication process
- Only admins can view other users' device information
- Users can see their own device information (feature not yet implemented in UI)
- Consider adding a privacy policy disclosure about device tracking
- Device data can be deleted when a user account is deleted

## Implementation Files

- **Types**: `lib/firebase-types.ts` - `DeviceInfo` interface
- **Device Detection**: `lib/device-info.ts` - User agent parsing and device detection
- **User Document Update**: `lib/firebase.ts` - `createOrUpdateUserDocument` function
- **Admin UI (List)**: `app/admin/users/page.tsx`
- **Admin UI (Detail)**: `app/admin/users/[userId]/page.tsx`

## Testing

To test device tracking:

1. Sign in with a Google account
2. Go to `/admin/users` (if you're an admin)
3. Find your user in the list - you should see your browser and OS
4. Click on your user to see the detail page
5. Check the "Devices & Location" section for full device information

To test multiple devices:
1. Sign in on different browsers (Chrome, Safari, Firefox)
2. Sign in on mobile device
3. View your user detail page to see all devices listed
