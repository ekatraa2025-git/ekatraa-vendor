import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { setupNotificationSubscription, fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead, NotificationData, setupForegroundNotificationListener } from '../lib/notifications';
import { notificationToastVariant, useToast } from './ToastContext';

interface NotificationContextType {
  notifications: NotificationData[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children, vendorId }: { children: React.ReactNode; vendorId: string | null }) {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const recentEventRef = useRef(new Map<string, number>());

  const markRecentEvent = useCallback((key: string | null | undefined) => {
    if (!key) return false;
    const now = Date.now();
    const previous = recentEventRef.current.get(key);
    if (previous && now - previous < 6000) return true;
    recentEventRef.current.set(key, now);
    if (recentEventRef.current.size > 100) {
      const staleBefore = now - 60000;
      recentEventRef.current.forEach((ts, k) => {
        if (ts < staleBefore) recentEventRef.current.delete(k);
      });
    }
    return false;
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchNotifications(vendorId);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Setup real-time subscription
  useEffect(() => {
    if (!vendorId) {
      console.log('[NotificationContext] No vendorId, skipping subscription');
      return;
    }

    console.log('[NotificationContext] Setting up notification subscription for vendorId:', vendorId);
    
    const unsubscribe = setupNotificationSubscription(vendorId, (notification) => {
      console.log('[NotificationContext] New notification received:', notification);
      setNotifications((prev) => [notification, ...prev]);
      const eventKey = notification.id ? `notif:${notification.id}` : `notif:${notification.title}:${notification.message}`;
      if (markRecentEvent(eventKey)) return;
      showToast({
        variant: notificationToastVariant(notification.type),
        title: notification.title || 'Notification',
        message: notification.message,
        duration: 4500,
      });
    });

    return unsubscribe;
  }, [vendorId, showToast, markRecentEvent]);

  useEffect(() => {
    const unsubscribe = setupForegroundNotificationListener(({ title, message, data }) => {
      const dataAny = data as any;
      const eventId = dataAny?.notification_id || dataAny?.id;
      const eventKey = eventId ? `push:${eventId}` : `push:${title}:${message}`;
      if (markRecentEvent(eventKey)) return;
      showToast({
        variant: 'info',
        title: title || 'Notification',
        message: message || '',
        duration: 4500,
      });
    });
    return unsubscribe;
  }, [showToast, markRecentEvent]);

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = async () => {
    if (!vendorId) return;
    await markAllNotificationsAsRead(vendorId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refreshNotifications: loadNotifications,
        markAsRead: handleMarkAsRead,
        markAllAsRead: handleMarkAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
