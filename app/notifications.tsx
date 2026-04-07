import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bell, Check, Clock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { NotificationData } from '../lib/notifications';
import BottomNav from '../components/BottomNav';

export default function NotificationsScreen() {
    const router = useRouter();
    const { colors, isDarkMode } = useTheme();
    const { notifications, unreadCount, loading, refreshNotifications, markAsRead, markAllAsRead } = useNotifications();
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshNotifications();
        setRefreshing(false);
    };

    const handleMarkAsRead = async (notification: NotificationData) => {
        if (notification.id && !notification.read) {
            await markAsRead(notification.id);
        }
    };

    const handleNotificationPress = async (notification: NotificationData) => {
        await handleMarkAsRead(notification);
        const orderId = notification.data?.order_id;
        if (orderId) {
            router.push({ pathname: '/orders/[id]', params: { id: String(orderId) } });
        }
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'order_update':
                return '📅';
            case 'quotation':
                return '💰';
            case 'system_update':
                return '⚙️';
            default:
                return '🔔';
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    };

    const unreadNotifications = notifications.filter(n => !n.read);
    const readNotifications = notifications.filter(n => n.read);

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4 flex-row items-center justify-between border-b" style={{ borderBottomColor: colors.border }}>
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <ChevronLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Notifications</Text>
                        {unreadCount > 0 && (
                            <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                {unreadCount} unread
                            </Text>
                        )}
                    </View>
                </View>
                {unreadCount > 0 && (
                    <TouchableOpacity
                        onPress={handleMarkAllAsRead}
                        className="px-4 py-2 rounded-full"
                        style={{ backgroundColor: colors.primary + '20' }}
                    >
                        <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                            Mark all read
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                className="flex-1"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                {loading && notifications.length === 0 ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <Bell size={48} color={colors.textSecondary} />
                        <Text className="text-base mt-4" style={{ color: colors.textSecondary }}>
                            Loading notifications...
                        </Text>
                    </View>
                ) : notifications.length === 0 ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <Bell size={48} color={colors.textSecondary} />
                        <Text className="text-xl font-bold mt-4" style={{ color: colors.text }}>
                            No notifications
                        </Text>
                        <Text className="text-sm mt-2 px-8 text-center" style={{ color: colors.textSecondary }}>
                            You're all caught up! New notifications will appear here.
                        </Text>
                    </View>
                ) : (
                    <View className="px-6 py-4">
                        {unreadNotifications.length > 0 && (
                            <>
                                <Text className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: colors.textSecondary }}>
                                    New ({unreadNotifications.length})
                                </Text>
                                {unreadNotifications.map((notification) => (
                                    <TouchableOpacity
                                        key={notification.id}
                                        onPress={() => handleNotificationPress(notification)}
                                        activeOpacity={0.7}
                                        className="mb-3 p-4 rounded-2xl border-2"
                                        style={{
                                            backgroundColor: colors.surface,
                                            borderColor: colors.primary + '40',
                                        }}
                                    >
                                        <View className="flex-row items-start">
                                            <View className="w-12 h-12 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.primary + '20' }}>
                                                <Text className="text-2xl">{getNotificationIcon(notification.type)}</Text>
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-start justify-between mb-1">
                                                    <Text className="font-bold text-base flex-1" style={{ color: colors.text }}>
                                                        {notification.title}
                                                    </Text>
                                                    <View className="w-2 h-2 rounded-full ml-2" style={{ backgroundColor: colors.primary }} />
                                                </View>
                                                <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                                                    {notification.message}
                                                </Text>
                                                <View className="flex-row items-center mt-2">
                                                    <Clock size={12} color={colors.textSecondary} />
                                                    <Text className="text-xs ml-1" style={{ color: colors.textSecondary }}>
                                                        {formatDate(notification.created_at)}
                                                    </Text>
                                                </View>
                                                {(notification.data?.occasion_name || notification.data?.event_date || notification.data?.status) ? (
                                                    <View className="flex-row flex-wrap mt-2 gap-2">
                                                        {notification.data?.occasion_name ? (
                                                            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: colors.background }}>
                                                                <Text className="text-[10px] font-semibold" style={{ color: colors.textSecondary }}>
                                                                    {String(notification.data.occasion_name)}
                                                                </Text>
                                                            </View>
                                                        ) : null}
                                                        {notification.data?.event_date ? (
                                                            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: colors.background }}>
                                                                <Text className="text-[10px] font-semibold" style={{ color: colors.textSecondary }}>
                                                                    {new Date(String(notification.data.event_date)).toLocaleDateString()}
                                                                </Text>
                                                            </View>
                                                        ) : null}
                                                        {notification.data?.status ? (
                                                            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: colors.background }}>
                                                                <Text className="text-[10px] font-semibold" style={{ color: colors.textSecondary }}>
                                                                    {String(notification.data.status)}
                                                                </Text>
                                                            </View>
                                                        ) : null}
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}

                        {readNotifications.length > 0 && (
                            <>
                                {unreadNotifications.length > 0 && (
                                    <View className="my-4" style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
                                )}
                                <Text className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: colors.textSecondary }}>
                                    Earlier ({readNotifications.length})
                                </Text>
                                {readNotifications.map((notification) => (
                                    <TouchableOpacity
                                        key={notification.id}
                                        onPress={() => handleNotificationPress(notification)}
                                        activeOpacity={0.7}
                                        className="mb-3 p-4 rounded-2xl"
                                        style={{ backgroundColor: colors.surface }}
                                    >
                                        <View className="flex-row items-start">
                                            <View className="w-12 h-12 rounded-xl items-center justify-center mr-3 opacity-60" style={{ backgroundColor: colors.primary + '20' }}>
                                                <Text className="text-2xl">{getNotificationIcon(notification.type)}</Text>
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-start justify-between mb-1">
                                                    <Text className="font-bold text-base flex-1 opacity-70" style={{ color: colors.text }}>
                                                        {notification.title}
                                                    </Text>
                                                    <Check size={16} color={colors.textSecondary} className="ml-2 opacity-50" />
                                                </View>
                                                <Text className="text-sm mt-1 opacity-70" style={{ color: colors.textSecondary }}>
                                                    {notification.message}
                                                </Text>
                                                <View className="flex-row items-center mt-2">
                                                    <Clock size={12} color={colors.textSecondary} />
                                                    <Text className="text-xs ml-1 opacity-70" style={{ color: colors.textSecondary }}>
                                                        {formatDate(notification.created_at)}
                                                    </Text>
                                                </View>
                                                {(notification.data?.occasion_name || notification.data?.event_date || notification.data?.status) ? (
                                                    <View className="flex-row flex-wrap mt-2 gap-2">
                                                        {notification.data?.occasion_name ? (
                                                            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: colors.background }}>
                                                                <Text className="text-[10px] font-semibold" style={{ color: colors.textSecondary }}>
                                                                    {String(notification.data.occasion_name)}
                                                                </Text>
                                                            </View>
                                                        ) : null}
                                                        {notification.data?.event_date ? (
                                                            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: colors.background }}>
                                                                <Text className="text-[10px] font-semibold" style={{ color: colors.textSecondary }}>
                                                                    {new Date(String(notification.data.event_date)).toLocaleDateString()}
                                                                </Text>
                                                            </View>
                                                        ) : null}
                                                        {notification.data?.status ? (
                                                            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: colors.background }}>
                                                                <Text className="text-[10px] font-semibold" style={{ color: colors.textSecondary }}>
                                                                    {String(notification.data.status)}
                                                                </Text>
                                                            </View>
                                                        ) : null}
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}
                        
                        {/* Bottom spacing for nav */}
                        <View style={{ height: 120 }} />
                    </View>
                )}
            </ScrollView>
            
            {/* Bottom Navigation */}
            <BottomNav />
        </SafeAreaView>
    );
}
