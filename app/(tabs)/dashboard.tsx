import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TrendingUp, Users, CalendarDays, Wallet, ChevronRight, FileText } from 'lucide-react-native';
import QuickHelp from '../../components/QuickHelp';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

export default function DashboardScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [vendor, setVendor] = useState<any>(null);
    const [hasNotifications, setHasNotifications] = useState(true); // Mock status
    const [stats, setStats] = useState([
        { label: t('total_revenue'), value: '₹0', icon: Wallet, color: '#FF6B00' },
        { label: t('active_bookings'), value: '0', icon: CalendarDays, color: '#3B82F6' },
        { label: t('total_services'), value: '0', icon: TrendingUp, color: '#10B981' },
        { label: t('profile_views'), value: '0', icon: Users, color: '#8B5CF6' },
    ]);
    const [upcomingBooking, setUpcomingBooking] = useState<any>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

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

                setStats([
                    { label: t('total_revenue'), value: `₹${Math.floor(vendorData.total_revenue || 0)}`, icon: Wallet, color: '#FF6B00' },
                    { label: t('active_bookings'), value: (vendorData.active_bookings_count || 0).toString(), icon: CalendarDays, color: '#3B82F6' },
                    { label: t('total_services'), value: (serviceCount || 0).toString(), icon: TrendingUp, color: '#10B981' },
                    { label: t('profile_views'), value: (vendorData.profile_views || 0).toString(), icon: Users, color: '#8B5CF6' },
                ]);

                // Fetch Latest Upcoming Booking
                const today = new Date().toISOString().split('T')[0];
                const { data: latestBooking } = await supabase
                    .from('bookings')
                    .select('*, services(name, image_urls)')
                    .eq('vendor_id', user.id)
                    .eq('status', 'confirmed')
                    .gte('booking_date', today)
                    .order('booking_date', { ascending: true })
                    .order('booking_time', { ascending: true })
                    .limit(1)
                    .maybeSingle();

                if (latestBooking) {
                    setUpcomingBooking(latestBooking);
                }
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#FF6B00" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="px-6 py-4">
                <QuickHelp
                    id="dashboard_welcome"
                    title="New to Ekatraa?"
                    description="Start by adding your services and setting your availability in the calendar."
                    actionText="Learn More"
                    onAction={() => console.log('Learn More')}
                />

                <View className="bg-accent-dark rounded-3xl p-6 mb-8 overflow-hidden">
                    <View className="z-10">
                        <Text className="text-gray-300 text-sm font-medium">{t('total_revenue')}</Text>
                        <Text className="text-white text-4xl font-bold mt-2">₹{vendor?.total_revenue || '0'}.00</Text>
                        <TouchableOpacity className="bg-primary self-start px-6 py-2.5 rounded-xl mt-6 shadow-lg shadow-primary/20">
                            <Text className="text-white font-bold text-sm">Payout Methods</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/20 rounded-full" />
                </View>

                <Text className="text-xl font-bold text-accent-dark mb-4">Quick Actions</Text>
                <View className="flex-row flex-wrap justify-between">
                    <TouchableOpacity
                        onPress={() => router.push('/quotations')}
                        className="w-[48%] bg-white border border-gray-100 p-5 rounded-3xl mb-4 shadow-sm"
                    >
                        <View className="w-12 h-12 rounded-2xl items-center justify-center mb-4 bg-orange-100">
                            <FileText size={24} color="#FF6B00" strokeWidth={2.5} />
                        </View>
                        <Text className="text-accent text-xs font-bold uppercase tracking-wider">Quotations</Text>
                        <Text className="text-2xl font-bold text-accent-dark mt-1">Manage</Text>
                    </TouchableOpacity>

                    {stats.map((stat, index) => (
                        <View key={index} className="w-[48%] bg-white border border-gray-100 p-5 rounded-3xl mb-4 shadow-sm">
                            <View className="w-12 h-12 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: `${stat.color}15` }}>
                                <stat.icon size={24} color={stat.color} strokeWidth={2.5} />
                            </View>
                            <Text className="text-accent text-xs font-bold uppercase tracking-wider">{stat.label}</Text>
                            <Text className="text-2xl font-bold text-accent-dark mt-1">{stat.value}</Text>
                        </View>
                    ))}
                </View>

                <View className="flex-row justify-between items-center mt-6 mb-4">
                    <Text className="text-xl font-bold text-accent-dark">Upcoming Bookings</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/bookings')}>
                        <Text className="text-primary font-bold text-sm">View All</Text>
                    </TouchableOpacity>
                </View>

                {upcomingBooking ? (
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/bookings')}
                        className="bg-white border border-gray-100 rounded-3xl p-5 mb-8 flex-row items-center shadow-sm"
                    >
                        <View className="w-16 h-16 bg-surface rounded-2xl items-center justify-center overflow-hidden">
                            <Image
                                source={{ uri: (upcomingBooking as any).services?.image_urls?.[0] || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=200&h=200&auto=format&fit=crop' }}
                                className="w-full h-full"
                            />
                        </View>
                        <View className="flex-1 ml-4">
                            <Text className="text-accent-dark font-extrabold text-lg">{(upcomingBooking as any).services?.name || 'Booking'}</Text>
                            <Text className="text-accent text-sm mt-1 font-medium">
                                {upcomingBooking.booking_date} • {upcomingBooking.booking_time}
                            </Text>
                        </View>
                        <ChevronRight size={24} color="#000000" strokeWidth={2.5} />
                    </TouchableOpacity>
                ) : (
                    <View className="bg-surface rounded-3xl p-10 items-center justify-center mb-12 border border-dashed border-gray-200">
                        <CalendarDays size={40} color="#9CA3AF" strokeWidth={1.5} />
                        <Text className="text-accent mt-3 font-semibold text-base">No upcoming bookings</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
