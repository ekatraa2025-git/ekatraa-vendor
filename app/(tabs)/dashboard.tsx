import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, LayoutGrid, Sparkles, Store, User } from 'lucide-react-native';
import QuickHelp from '../../components/QuickHelp';
import { AppScreenSkeleton } from '../../components/AppSkeleton';
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
    const [upcomingBooking, setUpcomingBooking] = useState<any>(null);

    useEffect(() => {
        fetchDashboardData({ showLoader: true, forceOrders: false });
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchDashboardData({ showLoader: false, forceOrders: true });
        setRefreshing(false);
    };

    const fetchDashboardData = async (opts?: { showLoader?: boolean; forceOrders?: boolean }) => {
        try {
            if (opts?.showLoader !== false) setLoading(true);
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
                const { data: backendOrders } = await fetchVendorOrders(undefined, { force: opts?.forceOrders === true });
                const today = new Date().toISOString().split('T')[0];
                const upcomingList = (backendOrders || [])
                    .filter((o: any) => o.event_date && o.event_date >= today && ['confirmed', 'pending', 'allocated'].includes(o.status || ''))
                    .sort((a: any, b: any) => (a.event_date || '').localeCompare(b.event_date || ''));
                const upcomingOrder = upcomingList[0] || null;

                setUpcomingBooking(upcomingOrder || null);
            } else {
                router.replace('/onboarding/index');
                return;
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            if (opts?.showLoader !== false) setLoading(false);
        }
    };

    if (loading) {
        return <AppScreenSkeleton cardCount={3} includeHero />;
    }

    return (
        <SafeAreaView edges={['left', 'right']} className="flex-1" style={{ backgroundColor: colors.background }}>
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
                <View className="rounded-3xl p-4 mb-6" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <View className="flex-row flex-wrap justify-between">
                        {[
                            { key: 'orders', label: 'Orders', sub: 'Track allocations', icon: LayoutGrid, color: '#3B82F6', route: '/(tabs)/orders' },
                            { key: 'services', label: 'Services', sub: 'Manage catalog', icon: Store, color: '#10B981', route: '/(tabs)/services' },
                            { key: 'calendar', label: 'Calendar', sub: 'Date availability', icon: CalendarDays, color: '#8B5CF6', route: '/(tabs)/calendar' },
                            { key: 'profile', label: 'Profile', sub: 'Business details', icon: User, color: colors.primary, route: '/(tabs)/profile' },
                        ].map((action) => (
                            <TouchableOpacity
                                key={action.key}
                                onPress={() => router.push(action.route as any)}
                                className="w-[48%] p-4 rounded-2xl mb-3"
                                style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}
                            >
                                <View className="w-10 h-10 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: `${action.color}20` }}>
                                    <action.icon size={20} color={action.color} strokeWidth={2.4} />
                                </View>
                                <Text className="font-extrabold text-base" style={{ color: colors.text }}>{action.label}</Text>
                                <Text className="text-[11px] mt-1" style={{ color: colors.textSecondary }}>{action.sub}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View className="flex-row justify-between items-center mt-2 mb-4">
                    <Text className="text-xl font-bold" style={{ color: colors.text }}>{t('upcoming_orders')}</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
                        <Text className="text-primary font-bold text-sm">{t('view_all')}</Text>
                    </TouchableOpacity>
                </View>

                {upcomingBooking ? (
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/orders')}
                        className="rounded-3xl p-5 mb-6 flex-row items-center shadow-sm"
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
                    <View className="rounded-3xl p-10 items-center justify-center mb-6 border border-dashed" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                        <CalendarDays size={40} color={colors.textSecondary} strokeWidth={1.5} />
                        <Text className="mt-3 font-semibold text-base" style={{ color: colors.textSecondary }}>{t('no_upcoming_orders')}</Text>
                    </View>
                )}

                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => router.push('/(tabs)/services')}
                    className="rounded-3xl overflow-hidden mb-10"
                    style={{
                        borderWidth: 1,
                        borderColor: colors.primary + '55',
                        backgroundColor: isDarkMode ? colors.surface : '#FFF7ED',
                    }}
                >
                    <View className="p-5 flex-row items-start">
                        <View
                            className="w-14 h-14 rounded-2xl items-center justify-center"
                            style={{ backgroundColor: colors.primary + '22' }}
                        >
                            <Sparkles size={28} color={colors.primary} strokeWidth={2.2} />
                        </View>
                        <View className="flex-1 ml-4">
                            <Text className="text-xs font-extrabold uppercase tracking-widest" style={{ color: colors.primary }}>
                                {t('dashboard_leads_badge', { defaultValue: 'Grow on Ekatraa' })}
                            </Text>
                            <Text className="text-lg font-extrabold mt-1 leading-6" style={{ color: colors.text }}>
                                {t('dashboard_leads_title', { defaultValue: 'Get matched & get more leads' })}
                            </Text>
                            <Text className="text-sm mt-2 leading-5" style={{ color: colors.textSecondary }}>
                                {t('dashboard_leads_body', {
                                    defaultValue:
                                        'Enrol your best services, keep photos and pricing fresh, and show up when hosts search — turn views into confirmed bookings.',
                                })}
                            </Text>
                            <View className="flex-row items-center mt-4">
                                <Text className="font-extrabold text-base" style={{ color: colors.primary }}>
                                    {t('dashboard_leads_cta', { defaultValue: 'Boost your listings' })}
                                </Text>
                                <ChevronRight size={20} color={colors.primary} strokeWidth={2.5} />
                            </View>
                        </View>
                    </View>
                    <View className="h-1.5" style={{ backgroundColor: colors.primary }} />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
