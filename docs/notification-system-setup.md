# Admin Notification System Setup Guide

## Overview

This guide walks you through setting up the complete admin notification system for System Designer, including the Firebase email extension integration.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │───▶│ Notification     │───▶│ Firebase        │
│   Code          │    │ Service          │    │ Collections     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Email Extension  │
                       │ (firestore-send- │
                       │ email)           │
                       └──────────────────┘
```

## 1. Firebase Email Extension Setup

### Install the Extension

```bash
# Navigate to your Firebase project
firebase ext:install firebase/firestore-send-email --project=your-project-id
```

### Configuration

During installation, configure these parameters:

- **SMTP Connection URI**: Your email provider's SMTP settings
  - Gmail: `smtps://username:password@smtp.gmail.com:465`
  - SendGrid: `smtps://apikey:YOUR_API_KEY@smtp.sendgrid.net:465`
  - Mailgun: `smtps://username:password@smtp.mailgun.org:587`

- **Default FROM address**: `notifications@systemdesigner.net`
- **Default REPLY TO address**: `system-designer@googlegroups.com`
- **Users collection**: `users` (optional, for user email management)
- **Mail collection**: `mail`
- **Templates collection**: `mailTemplates` (optional)

### Email Provider Setup

#### Option 1: Gmail (Development)
1. Enable 2-factor authentication
2. Generate an App Password
3. Use: `smtps://your-email@gmail.com:app-password@smtp.gmail.com:465`

#### Option 2: SendGrid (Recommended for Production)
1. Create SendGrid account
2. Generate API key
3. Use: `smtps://apikey:YOUR_SENDGRID_API_KEY@smtp.sendgrid.net:465`

#### Option 3: Mailgun
1. Create Mailgun account
2. Get SMTP credentials
3. Use: `smtps://username:password@smtp.mailgun.org:587`

## 2. Firestore Security Rules

Add these rules to `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Admin notifications - only admins can read/write the single document
    match /admin/notifications/admin-notifications {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }

    // Admin notification preferences - only the admin user
    match /adminNotificationPreferences/{userId} {
      allow read, write: if request.auth != null &&
        request.auth.uid == userId &&
        get(/databases/$(database)/documents/users/$(userId)).data.isAdmin == true;
    }


    // Email collection - extension manages this automatically
    match /mail/{document} {
      allow create: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
      allow read: if false; // Extension manages reads
    }
  }
}
```

## 3. Environment Variables

Add to your `.env.local`:

```bash
# Firebase configuration (you probably already have these)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id

# Application URL for email links
NEXT_PUBLIC_APP_URL=https://systemdesigner.net

# Email configuration (optional overrides)
NOTIFICATION_FROM_EMAIL=notifications@systemdesigner.net
NOTIFICATION_REPLY_TO=system-designer@googlegroups.com
ADMIN_EMAIL_GROUP=system-designer@googlegroups.com
```

## 4. Firebase Functions (Optional)

For advanced features like email digests, create `functions/src/notifications.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Daily email digest function
export const sendDailyDigest = functions.pubsub
  .schedule('0 9 * * *') // 9 AM daily
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const db = admin.firestore();

    // Get admin users who want daily digests
    const adminsSnapshot = await db.collection('users')
      .where('isAdmin', '==', true)
      .get();

    for (const adminDoc of adminsSnapshot.docs) {
      const adminData = adminDoc.data();

      // Check if they want daily digest
      if (adminData.preferences?.emailNotifications !== false) {

        // Get unread notifications from last 24 hours
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const notificationsSnapshot = await db.collection('adminNotifications')
          .where('createdAt', '>=', yesterday)
          .where('read', '==', false)
          .get();

        if (notificationsSnapshot.size > 0) {
          // Send digest email
          await db.collection('mail').add({
            to: adminData.email,
            message: {
              subject: `[System Designer] Daily Admin Digest - ${notificationsSnapshot.size} notifications`,
              html: generateDigestHTML(notificationsSnapshot.docs),
            }
          });
        }
      }
    }
  });

function generateDigestHTML(notifications: any[]): string {
  // Generate HTML for digest email
  return `
    <h2>Daily Admin Digest</h2>
    <p>You have ${notifications.length} unread notifications:</p>
    ${notifications.map(doc => {
      const data = doc.data();
      return `
        <div style="border: 1px solid #ddd; padding: 16px; margin: 8px 0;">
          <h3>${data.title}</h3>
          <p>${data.message}</p>
          <small>Priority: ${data.priority} | Type: ${data.type}</small>
        </div>
      `;
    }).join('')}
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/notifications">View all notifications</a></p>
  `;
}
```

Deploy functions:
```bash
firebase deploy --only functions
```

## 5. Integration Examples

### Basic Integration

```typescript
// In any component
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';

function MyComponent() {
  const { triggerFeedback } = useNotificationTriggers();

  const handleSubmit = async (feedbackData) => {
    // Your existing logic...

    // Add notification trigger
    await triggerFeedback({
      id: feedbackDoc.id,
      feedback: feedbackData.feedback,
      category: feedbackData.category,
      userEmail: user?.email,
    });
  };
}
```

### Error Boundary Integration

```typescript
// In your error boundary
import { NotificationService } from '@/lib/notification-service';

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Trigger system alert for critical errors
    NotificationService.notifySystemAlert({
      type: 'error',
      title: 'React Error Boundary Triggered',
      message: error.message,
      errorCode: 'REACT_ERROR_BOUNDARY',
    });
  }
}
```

### Custom Notifications

```typescript
// Direct notification creation
import { NotificationService } from '@/lib/notification-service';

await NotificationService.notify({
  type: 'user_activity',
  priority: 'medium',
  title: 'Custom Event Occurred',
  message: 'Something important happened in your application',
  source: 'custom-feature',
  tags: ['custom', 'important'],
  deliveryMethod: ['in_app', 'email'],
  actions: [
    {
      label: 'View Details',
      url: '/admin/custom-feature',
      type: 'view'
    }
  ]
});
```

## 6. Testing

### Test Email Delivery

```typescript
// Create a test notification
import { NotificationService } from '@/lib/notification-service';

await NotificationService.notify({
  type: 'system_health',
  priority: 'low',
  title: 'Test Notification',
  message: 'This is a test notification to verify email delivery',
  source: 'test',
  deliveryMethod: ['in_app', 'email']
});
```

### Verify Firestore Collections

Check these collections in Firebase Console:
- `admin/notifications` - Should contain a single document with ID `admin-notifications` containing all notifications in an array
- `mail` - Should contain email documents (processed by extension)

## 7. Monitoring

### Email Delivery Status

Monitor in Firebase Console:
1. Go to Extensions → Trigger Email from Firestore
2. Check logs for email delivery status
3. Monitor the `mail` collection for processing status

### Notification Analytics

Create admin dashboard widgets:
```typescript
// Example: Recent notification metrics
const getNotificationMetrics = async () => {
  const notifications = await NotificationService.getRecentNotifications(100);

  return {
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    byPriority: {
      urgent: notifications.filter(n => n.priority === 'urgent').length,
      high: notifications.filter(n => n.priority === 'high').length,
      medium: notifications.filter(n => n.priority === 'medium').length,
      low: notifications.filter(n => n.priority === 'low').length,
    },
    byType: notifications.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
};
```

## 8. Troubleshooting

### Email Not Sending

1. **Check Extension Logs**:
   ```bash
   firebase functions:log --only ext-firestore-send-email
   ```

2. **Verify SMTP Settings**: Test your SMTP connection independently

3. **Check Firestore Rules**: Ensure the extension can read/write to `mail` collection

4. **Verify Email Format**: Ensure your email documents match the expected format

### Notifications Not Appearing

1. **Check Firestore Rules**: Ensure admins can read `admin/notifications`
2. **Verify Admin Status**: Ensure user has `isAdmin: true` in users collection
3. **Check Console Logs**: Look for JavaScript errors in browser console

### Performance Issues

1. **Limit Notification Queries**: Use pagination for large notification lists
2. **Index Firestore Fields**: Create indexes for frequently queried fields
3. **Batch Operations**: Use batch writes for bulk notification operations

## 9. Email Templates (Optional)

Create reusable email templates in the `mailTemplates` collection:

```typescript
// Example template document
{
  name: 'admin-notification',
  subject: '[System Designer Admin] {{title}}',
  html: `
    <html>
      <body>
        <h1>{{title}}</h1>
        <p>{{message}}</p>
        {{#if actions}}
          <div>
            {{#each actions}}
              <a href="{{url}}" style="background: #0066cc; color: white; padding: 10px; text-decoration: none;">
                {{label}}
              </a>
            {{/each}}
          </div>
        {{/if}}
      </body>
    </html>
  `,
  text: '{{title}}\n\n{{message}}'
}
```

## 10. Production Checklist

- [ ] Firebase email extension installed and configured
- [ ] Email provider (SendGrid/Mailgun) set up for production
- [ ] Firestore security rules deployed
- [ ] Environment variables configured
- [ ] Admin users have `isAdmin: true` in Firestore
- [ ] Notification center integrated into admin UI
- [ ] Error tracking integrated into error boundaries
- [ ] Key user actions trigger appropriate notifications
- [ ] Email delivery tested and working
- [ ] Monitoring and alerting set up

## Next Steps

1. **Customize Notification Triggers**: Add notifications for your specific business events
2. **Create Email Templates**: Design branded email templates for better user experience
3. **Add Analytics**: Track notification engagement and effectiveness
4. **Set Up Monitoring**: Monitor email delivery rates and notification response times
5. **User Preferences**: Allow admins to customize their notification preferences

---

This notification system provides a solid foundation for keeping admins informed about system activity while being flexible enough to grow with your application's needs.