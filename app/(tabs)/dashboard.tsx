import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TrendingUp, Users, CalendarDays, Wallet, Bell, ChevronRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function DashboardScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [vendor, setVendor] = useState<any>(null);
    const [stats, setStats] = useState([
        { label: 'Total Revenue', value: '₹0', icon: Wallet, color: '#FF6B00' },
        { label: 'Active Bookings', value: '0', icon: CalendarDays, color: '#3B82F6' },
        { label: 'Total Services', value: '0', icon: TrendingUp, color: '#10B981' },
        { label: 'Profile Views', value: '0', icon: Users, color: '#8B5CF6' },
    ]);
    const [upcomingBooking, setUpcomingBooking] = useState<any>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

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

                setStats([
                    { label: 'Total Revenue', value: `₹${Math.floor(vendorData.total_revenue || 0)}`, icon: Wallet, color: '#FF6B00' },
                    { label: 'Active Bookings', value: (vendorData.active_bookings_count || 0).toString(), icon: CalendarDays, color: '#3B82F6' },
                    { label: 'Total Services', value: (serviceCount || 0).toString(), icon: TrendingUp, color: '#10B981' },
                    { label: 'Profile Views', value: (vendorData.profile_views || 0).toString(), icon: Users, color: '#8B5CF6' },
                ]);

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
                <View className="flex-row justify-between items-center mb-8">
                    <View className="flex-row items-center">
                        <Image
                            source={require('../../assets/icon.png')}
                            className="w-12 h-12 rounded-xl mr-4"
                            resizeMode="contain"
                        />
                        <View>
                            <Text className="text-accent text-sm font-medium">Welcome back,</Text>
                            <Text className="text-2xl font-bold text-accent-dark">{vendor?.business_name || 'Vendor'}</Text>
                        </View>
                    </View>
                    <TouchableOpacity className="w-12 h-12 bg-surface rounded-2xl items-center justify-center border border-gray-100">
                        <Bell size={24} color="#1F2937" />
                        <View className="absolute top-2 right-2 w-3 h-3 bg-secondary rounded-full border-2 border-white" />
                    </TouchableOpacity>
                </View>

                <View className="bg-accent-dark rounded-3xl p-6 mb-8 overflow-hidden">
                    <View className="z-10">
                        <Text className="text-gray-300 text-sm font-medium">Total Revenue</Text>
                        <Text className="text-white text-4xl font-bold mt-2">₹{vendor?.total_revenue || '0'}.00</Text>
                        <TouchableOpacity className="bg-primary self-start px-6 py-2.5 rounded-xl mt-6 shadow-lg shadow-primary/20">
                            <Text className="text-white font-bold text-sm">Payout Methods</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/20 rounded-full" />
                </View>

                <Text className="text-lg font-bold text-accent-dark mb-4">Quick Stats</Text>
                <View className="flex-row flex-wrap justify-between">
                    {stats.map((stat, index) => (
                        <View key={index} className="w-[48%] bg-surface border border-gray-50 p-5 rounded-3xl mb-4 shadow-sm">
                            <View className="w-10 h-10 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: `${stat.color}15` }}>
                                <stat.icon size={20} color={stat.color} />
                            </View>
                            <Text className="text-accent text-xs font-semibold uppercase tracking-wider">{stat.label}</Text>
                            <Text className="text-xl font-bold text-accent-dark mt-1">{stat.value}</Text>
                        </View>
                    ))}
                </View>

                <View className="flex-row justify-between items-center mt-4 mb-4">
                    <Text className="text-lg font-bold text-accent-dark">Upcoming Bookings</Text>
                    <TouchableOpacity>
                        <Text className="text-primary font-bold text-sm">View All</Text>
                    </TouchableOpacity>
                </View>

                {upcomingBooking ? (
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/bookings')}
                        className="bg-white border border-gray-100 rounded-3xl p-4 mb-8 flex-row items-center shadow-sm"
                    >
                        <View className="w-16 h-16 bg-surface rounded-2xl items-center justify-center overflow-hidden">
                            <Image
                                source={{ uri: (upcomingBooking as any).services?.image_urls?.[0] || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=200&h=200&auto=format&fit=crop' }}
                                className="w-full h-full"
                            />
                        </View>
                        <View className="flex-1 ml-4">
                            <Text className="text-accent-dark font-bold">{(upcomingBooking as any).services?.name || 'Booking'}</Text>
                            <Text className="text-accent text-xs mt-1">
                                {upcomingBooking.booking_date} • {upcomingBooking.booking_time}
                            </Text>
                        </View>
                        <ChevronRight size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                ) : (
                    <View className="bg-surface rounded-3xl p-8 items-center justify-center mb-8 border border-dashed border-gray-200">
                        <CalendarDays size={32} color="#9CA3AF" />
                        <Text className="text-accent mt-2 font-medium">No upcoming bookings</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
