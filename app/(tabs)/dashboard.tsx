import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TrendingUp, Users, CalendarDays, Wallet, ChevronRight, FileText } from 'lucide-react-native';
import QuickHelp from '../../components/QuickHelp';
import { supabase } from '../../lib/supabase';
import { fetchVendorOrders } from '../../lib/vendor-api';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';

export default function DashboardScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [vendor, setVendor] = useState<any>(null);
    const [hasNotifications, setHasNotifications] = useState(true); // Mock status
    const [stats, setStats] = useState([
        { label: t('expected_revenue'), value: '₹0', icon: Wallet, color: '#FF6B00' },
        { label: t('active_orders'), value: '0', icon: CalendarDays, color: '#3B82F6' },
        { label: t('total_services'), value: '0', icon: TrendingUp, color: '#10B981' },
    ]);
    const [upcomingBooking, setUpcomingBooking] = useState<any>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchDashboardData();
        setRefreshing(false);
    };

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/(auth)/login');
                return;
            }

            // Fetch Vendor Profile
            const { data: vendorData, error: vError } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (vError) throw vError;

            if (vendorData) {
                setVendor(vendorData);

                // Fetch Services Count
                const { count: serviceCount } = await supabase
                    .from('services')
                    .select('*', { count: 'exact', head: true })
                    .eq('vendor_id', user.id);

                // Calculate Expected Revenue (sum of all quotations)
                const { data: allQuotations } = await supabase
                    .from('quotations')
                    .select('total_amount, amount')
                    .eq('vendor_id', user.id);

                const expectedRevenue = (allQuotations || []).reduce((sum: number, q: { total_amount?: string; amount?: string }) => {
                    return sum + (parseFloat(q.total_amount || q.amount || '0') || 0);
                }, 0);

                // Calculate Real Revenue (sum of approved/accepted quotations)
                const { data: approvedQuotations } = await supabase
                    .from('quotations')
                    .select('total_amount, amount')
                    .eq('vendor_id', user.id)
                    .eq('status', 'accepted');

                const realRevenue = (approvedQuotations || []).reduce((sum: number, q: { total_amount?: string; amount?: string }) => {
                    return sum + (parseFloat(q.total_amount || q.amount || '0') || 0);
                }, 0);

                // Update vendor record with calculated revenues (if different)
                if (vendorData.expected_total_revenues !== expectedRevenue || vendorData.real_revenue_earned !== realRevenue) {
                    await supabase
                        .from('vendors')
                        .update({
                            expected_total_revenues: expectedRevenue,
                            real_revenue_earned: realRevenue
                        })
                        .eq('id', user.id);
                    
                    // Update local vendor data
                    vendorData.expected_total_revenues = expectedRevenue;
                    vendorData.real_revenue_earned = realRevenue;
                    setVendor(vendorData);
                }

                // Fetch orders from backend (allocated orders)
                const { data: backendOrders } = await fetchVendorOrders();
                const activeOrders = (backendOrders || []).filter((o: any) =>
                    ['confirmed', 'pending', 'allocated'].includes(o.status || '')
                );
                const today = new Date().toISOString().split('T')[0];
                const upcomingList = (backendOrders || [])
                    .filter((o: any) => o.event_date && o.event_date >= today && ['confirmed', 'pending', 'allocated'].includes(o.status || ''))
                    .sort((a: any, b: any) => (a.event_date || '').localeCompare(b.event_date || ''));
                const upcomingOrder = upcomingList[0] || null;

                setStats([
                    { label: t('expected_revenue'), value: `₹${Math.floor(expectedRevenue)}`, icon: Wallet, color: '#FF7A00' },
                    { label: t('active_orders'), value: activeOrders.length.toString(), icon: CalendarDays, color: '#3B82F6' },
                    { label: t('total_services'), value: (serviceCount || 0).toString(), icon: TrendingUp, color: '#10B981' },
                ]);

                setUpcomingBooking(upcomingOrder || null);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <ScrollView 
                className="px-6 py-4"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
            >
                <QuickHelp
                    id="dashboard_welcome"
                    title={t('new_to_ekatraa')}
                    description={t('start_by_adding_services')}
                    actionText={t('learn_more')}
                    onAction={() => console.log('Learn More')}
                />

                {/* Welcome Message */}
                <View className="mb-4">
                    <Text className="text-sm font-medium" style={{ color: colors.textSecondary }}>{t('welcome_back')},</Text>
                    <Text className="text-2xl font-extrabold" style={{ color: colors.text }}>{vendor?.business_name || vendor?.owner_name || t('vendor')}</Text>
                </View>

                <View className="rounded-3xl p-6 mb-8 overflow-hidden" style={{ backgroundColor: isDarkMode ? colors.surface : '#1F2937' }}>
                    <View className="z-10">
                        <Text className="text-gray-300 text-sm font-medium">Real Revenue Earned</Text>
                        <Text className="text-white text-4xl font-bold mt-2">₹{vendor?.real_revenue_earned || '0'}.00</Text>
                        <View className="mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                            <Text className="text-gray-400 text-xs font-medium">Expected Total Revenues</Text>
                            <Text className="text-gray-300 text-xl font-bold mt-1">₹{vendor?.expected_total_revenues || '0'}.00</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => router.push({ pathname: '/(tabs)/profile', params: { openPayout: 'true' } })}
                            className="bg-primary self-start px-6 py-2.5 rounded-xl mt-6 shadow-lg shadow-primary/20"
                        >
                            <Text className="text-white font-bold text-sm">{t('payout_methods')}</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/20 rounded-full" />
                </View>

                <Text className="text-xl font-bold mb-4" style={{ color: colors.text }}>{t('quick_actions')}</Text>
                <View className="flex-row flex-wrap justify-between">
                    <TouchableOpacity
                        onPress={() => router.push('/quotations')}
                        className="w-[48%] p-5 rounded-3xl mb-4 shadow-sm"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
                    >
                        <View className="w-12 h-12 rounded-2xl items-center justify-center mb-4 bg-orange-100">
                            <FileText size={24} color={colors.primary} strokeWidth={2.5} />
                        </View>
                        <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>{t('quotations')}</Text>
                        <Text className="text-2xl font-bold mt-1" style={{ color: colors.text }}>{t('manage')}</Text>
                    </TouchableOpacity>

                    {stats.map((stat, index) => (
                        <View key={index} className="w-[48%] p-5 rounded-3xl mb-4 shadow-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>
                            <View className="w-12 h-12 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: `${stat.color}15` }}>
                                <stat.icon size={24} color={stat.color} strokeWidth={2.5} />
                            </View>
                            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>{stat.label}</Text>
                            <Text className="text-2xl font-bold mt-1" style={{ color: colors.text }}>{stat.value}</Text>
                        </View>
                    ))}
                </View>

                <View className="flex-row justify-between items-center mt-6 mb-4">
                    <Text className="text-xl font-bold" style={{ color: colors.text }}>{t('upcoming_orders')}</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
                        <Text className="text-primary font-bold text-sm">{t('view_all')}</Text>
                    </TouchableOpacity>
                </View>

                {upcomingBooking ? (
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/orders')}
                        className="rounded-3xl p-5 mb-8 flex-row items-center shadow-sm"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
                    >
                        <View className="w-16 h-16 rounded-2xl items-center justify-center overflow-hidden" style={{ backgroundColor: colors.background }}>
                            <Image
                                source={{ uri: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=200&h=200&auto=format&fit=crop' }}
                                className="w-full h-full"
                            />
                        </View>
                        <View className="flex-1 ml-4">
                            <Text className="font-extrabold text-lg" style={{ color: colors.text }}>{(upcomingBooking as any).event_name || t('order')}</Text>
                            <Text className="text-sm mt-1 font-medium" style={{ color: colors.textSecondary }}>
                                {(upcomingBooking as any).event_date ? new Date((upcomingBooking as any).event_date).toLocaleDateString() : '—'} • {(upcomingBooking as any).contact_name || ''}
                            </Text>
                        </View>
                        <ChevronRight size={24} color={colors.text} strokeWidth={2.5} />
                    </TouchableOpacity>
                ) : (
                    <View className="rounded-3xl p-10 items-center justify-center mb-12 border border-dashed" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                        <CalendarDays size={40} color={colors.textSecondary} strokeWidth={1.5} />
                        <Text className="mt-3 font-semibold text-base" style={{ color: colors.textSecondary }}>{t('no_upcoming_orders')}</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
