import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  id?: string;
  vendor_id: string;
  type: 'booking_update' | 'system_update' | 'quotation' | 'general';
  title: string;
  message: string;
  data?: any;
  read?: boolean;
  created_at?: string;
}

// Request notification permissions
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
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
  
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '0b6b6e3b-dba4-4b7a-a510-da84be32455a',
    });
    token = tokenData.data;
  } catch (error) {
    console.error('Error getting push token:', error);
  }

  return token;
}

// Setup Supabase real-time subscription for notifications
export function setupNotificationSubscription(
  vendorId: string,
  onNotification: (notification: NotificationData) => void
) {
  if (!vendorId) {
    console.warn('No vendor ID provided for notification subscription');
    return () => {};
  }

  const channel = supabase
    .channel(`vendor-notifications-${vendorId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'vendor_notifications',
        filter: `vendor_id=eq.${vendorId}`,
      },
      (payload) => {
        const notification = payload.new as NotificationData;
        onNotification(notification);
        
        // Show local notification
        Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.message,
            data: notification.data || {},
            sound: true,
          },
          trigger: null, // Show immediately
        });
      }
    )
    .subscribe();

  return () => {
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
