# Notifications and Translations Setup

## Notifications System

The vendor app now supports real-time notifications via Supabase for:
- **Booking Updates**: Automatically sent when booking status changes (confirmed, cancelled, completed, etc.)
- **System Updates**: Can be triggered from the backend admin panel
- **Quotation Updates**: For quotation-related notifications
- **General Notifications**: For any other vendor-specific notifications

### Setup Instructions

1. **Create the notifications table in Supabase:**
   - Run the SQL script from `ekatraa_backend/database/vendor_notifications.sql` in your Supabase SQL Editor
   - This creates the table with proper RLS policies

2. **Install dependencies:**
   ```bash
   cd ekatraa_vendor
   npm install
   ```

3. **Configure backend URL (optional):**
   - Add `EXPO_PUBLIC_API_URL` to `app.json` extra section if your backend is hosted
   - Example: `"EXPO_PUBLIC_API_URL": "https://your-backend-url.com"`

### How It Works

- Notifications are automatically received via Supabase real-time subscriptions
- When a notification is received, a local push notification is shown
- Notifications are stored in the `vendor_notifications` table
- The app tracks unread notification count

### Using Notifications in Code

```typescript
import { useNotifications } from '../context/NotificationContext';

function MyComponent() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  
  // Access notifications
  // Mark as read when user views
}
```

### Sending Notifications from Backend

**For booking updates:** Already integrated - notifications are sent automatically when booking status changes.

**For system updates:** Use the utility function:

```typescript
import { sendNotificationToVendor, sendSystemUpdateToAllVendors } from '@/lib/notifications';

// Send to specific vendor
await sendNotificationToVendor({
  vendor_id: 'vendor-uuid',
  type: 'system_update',
  title: 'System Maintenance',
  message: 'Scheduled maintenance on Jan 15, 2026',
  data: { maintenance_date: '2026-01-15' }
});

// Send to all vendors
await sendSystemUpdateToAllVendors(
  'Important Update',
  'New features have been added to the vendor app!'
);
```

Or use the API endpoint:

```bash
POST /api/admin/notifications
{
  "vendor_id": "uuid",
  "type": "system_update",
  "title": "System Update",
  "message": "Your message here",
  "data": {}
}
```

## Translations System

The vendor app now loads translations from the backend, allowing you to edit language files through the admin panel.

### Setup Instructions

1. **Backend translations are already set up:**
   - Navigate to `/admin/translations` in the backend
   - Edit translations for English, Hindi, and Odia
   - Changes are automatically reflected in the vendor app

2. **Configure backend URL:**
   - Add `EXPO_PUBLIC_API_URL` to `app.json` extra section
   - The app will fetch translations from `${EXPO_PUBLIC_API_URL}/api/translations`

3. **How it works:**
   - App loads default translations on startup
   - Then fetches latest translations from backend
   - Backend translations override defaults
   - Translations are cached in the app

### Adding New Translation Keys

1. Go to `/admin/translations` in the backend
2. Click "Add Translation"
3. Enter the key (e.g., `welcome_message`)
4. Enter translations for all three languages
5. Save

The vendor app will automatically use the new translations on next app load or when translations are refreshed.

### Using Translations in Code

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return <Text>{t('welcome_message')}</Text>;
}
```

## Notes

- Notifications require the `vendor_notifications` table to be created in Supabase
- Real-time subscriptions only work when the app is running
- Translations are loaded on app startup and can be refreshed
- All existing code and logic remain unchanged
