import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Lazy load expo-notifications to avoid errors in Expo Go on Android
// The error message from expo-notifications is expected in Expo Go on Android
// and doesn't break functionality - notifications work via Supabase real-time
let Notifications: any = null;
let notificationsAvailable = false;
let cachedExpoPushToken: string | null = null;
let notificationsConfigured = false;

// Function to safely load notifications module
function loadNotificationsModule() {
  if (Notifications !== null) {
    return; // Already attempted
  }

  try {
    // Suppress the specific expo-notifications error for Expo Go on Android
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const message = String(args[0] || '');
      // Suppress the expo-notifications Android Expo Go error message
      if (message.includes('expo-notifications') && 
          (message.includes('Android Push notifications') || 
           message.includes('was removed from Expo Go'))) {
        // Silently ignore this expected error
        return;
      }
      originalError.apply(console, args);
    };

    // Try to require the module
    if (typeof require !== 'undefined') {
      Notifications = require('expo-notifications');
      notificationsAvailable = true;
      
      configureNotificationHandler();
    }

    // Restore original console.error
    console.error = originalError;
  } catch (error) {
    // Module not available (Expo Go on Android)
    notificationsAvailable = false;
    Notifications = null;
  }
}

// Load notifications module lazily when first needed
loadNotificationsModule();

function configureNotificationHandler() {
  if (!notificationsAvailable || !Notifications || notificationsConfigured) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationsConfigured = true;
  } catch {
    notificationsConfigured = false;
  }
}

export function canUseVendorNotifications(): boolean {
  return !!notificationsAvailable && !!Notifications;
}

export interface NotificationData {
  id?: string;
  vendor_id: string;
  type: 'order_update' | 'system_update' | 'quotation' | 'general';
  title: string;
  message: string;
  data?: any;
  read?: boolean;
  created_at?: string;
}

// Request notification permissions
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // If notifications are not available (Expo Go on Android), return null
  if (!canUseVendorNotifications()) {
    return null;
  }

  let token: string | null = null;

  try {
    configureNotificationHandler();
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      } catch (error) {
        // Android push notifications not available in Expo Go - this is expected
        console.warn('Android notification channel setup skipped (Expo Go limitation)');
        return null;
      }
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Get projectId from Constants if available, otherwise skip token generation
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (projectId) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        });
        token = tokenData.data;
      } catch (error) {
        // Push token generation failed (likely Expo Go on Android)
        console.warn('Push token generation skipped:', error);
        return null;
      }
    } else {
      console.warn('No projectId found, skipping push token generation');
    }
  } catch (error) {
    // Handle any other errors gracefully
    console.warn('Notification registration error:', error);
    return null;
  }

  cachedExpoPushToken = token;
  return token;
}

export function getCachedExpoPushToken(): string | null {
  return cachedExpoPushToken;
}

export function setupForegroundNotificationListener(
  onReceive: (notification: { title?: string; message?: string; data?: Record<string, unknown> }) => void
) {
  if (!canUseVendorNotifications() || typeof onReceive !== 'function') {
    return () => {};
  }
  try {
    const subscription = Notifications.addNotificationReceivedListener((event: any) => {
      const content = event?.request?.content || {};
      onReceive({
        title: content?.title,
        message: content?.body,
        data: content?.data || {},
      });
    });
    return () => {
      try {
        subscription?.remove?.();
      } catch {
        /* no-op */
      }
    };
  } catch {
    return () => {};
  }
}

// Setup Supabase real-time subscription for notifications
export function setupNotificationSubscription(
  vendorId: string,
  onNotification: (notification: NotificationData) => void
) {
  if (!vendorId) {
    console.warn('No vendor ID provided for notification subscription');
    return () => { };
  }

  console.log('[Notifications] Setting up subscription for vendor_id:', vendorId);
  
  const channel = supabase
    .channel(`vendor-notifications-${vendorId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'vendor_notifications',
        filter: `vendor_id=eq.${encodeURIComponent(String(vendorId))}`,
      },
      (payload: any) => {
        console.log('[Notifications] Received notification:', payload);
        const notification = payload.new as NotificationData;
        console.log('[Notifications] Processing notification:', notification);
        onNotification(notification);

        // Show local notification (works even without push tokens via Supabase real-time)
        // Only attempt if notifications are available
        if (notificationsAvailable && Notifications) {
          try {
            Notifications.scheduleNotificationAsync({
              content: {
                title: notification.title,
                body: notification.message,
                data: notification.data || {},
                sound: 'default',
              },
              trigger: null, // Show immediately
            }).catch((error: unknown) => {
              // Silently handle if local notifications fail (e.g., Expo Go on Android)
              console.warn('Local notification failed:', error);
            });
          } catch (error) {
            // Silently handle if notifications are not available
            console.warn('Notification scheduling failed:', error);
          }
        }
      }
    )
    .subscribe((status: string) => {
      console.log('[Notifications] Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[Notifications] Successfully subscribed to channel');
      } else if (status === 'CHANNEL_ERROR') {
        // This is expected in some cases (e.g., network issues, Supabase connection problems)
        // Log as warning instead of error to reduce noise in console
        console.warn('[Notifications] Channel subscription error - notifications may not work in real-time. This is usually a temporary connection issue.');
      }
    });

  return () => {
    console.log('[Notifications] Unsubscribing from channel');
    supabase.removeChannel(channel);
  };
}

// Fetch unread notifications
export async function fetchNotifications(vendorId: string): Promise<NotificationData[]> {
  if (!vendorId) return [];

  const { data, error } = await supabase
    .from('vendor_notifications')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return (data || []) as NotificationData[];
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('vendor_notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }

  return true;
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(vendorId: string): Promise<boolean> {
  const { error } = await supabase
    .from('vendor_notifications')
    .update({ read: true })
    .eq('vendor_id', vendorId)
    .eq('read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }

  return true;
}
