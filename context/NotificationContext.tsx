import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setupNotificationSubscription, fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead, NotificationData } from '../lib/notifications';
import { supabase } from '../lib/supabase';

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
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);

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
    });

    return unsubscribe;
  }, [vendorId]);

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
