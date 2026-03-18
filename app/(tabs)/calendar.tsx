import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { Clock, AlertCircle, CheckCircle2, ChevronDown, Store } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { fetchVendorOrders } from '../../lib/vendor-api';
import { useTheme } from '../../context/ThemeContext';

export default function CalendarScreen() {
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [markedDates, setMarkedDates] = useState<any>({});
    const [daySchedule, setDaySchedule] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [serviceAvailability, setServiceAvailability] = useState<any>({});
    const [showServiceAvailability, setShowServiceAvailability] = useState(false);
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    useEffect(() => {
        fetchCalendarData();
        fetchVendorServices();
    }, []);

    useEffect(() => {
        if (selectedDate) {
            fetchServiceAvailability(selectedDate);
        }
    }, [selectedDate]);

    const fetchCalendarData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch allocated orders from backend
            const { data: orders } = await fetchVendorOrders();
            const activeOrders = (orders || []).filter((o: any) =>
                ['confirmed', 'pending', 'allocated'].includes(o.status || '')
            );

            // Fetch Blocks
            const { data: blocks } = await supabase
                .from('unavailability_blocks')
                .select('*')
                .eq('vendor_id', user.id);

            const newMarkedDates: any = {};

            activeOrders?.forEach((o: any) => {
                if (o.event_date) {
                    const dateStr = typeof o.event_date === 'string' ? o.event_date.split('T')[0] : o.event_date;
                    if (dateStr) newMarkedDates[dateStr] = { marked: true, dotColor: '#EF4444' };
                }
            });

            blocks?.forEach((b: any) => {
                if (b.block_date) {
                    newMarkedDates[b.block_date] = { marked: true, dotColor: '#4B5563', disabled: true };
                }
            });

            setMarkedDates(newMarkedDates);
        } catch (error) {
            console.error('Error fetching calendar data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchVendorServices = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('services')
                .select('*')
                .eq('vendor_id', user.id)
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (error) throw error;
            setServices(data || []);
        } catch (error) {
            console.error('Error fetching services for calendar:', error);
        }
    };

    const fetchServiceAvailability = async (date: string) => {
        try {
            setLoadingAvailability(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('service_date_availability')
                .select('*')
                .eq('vendor_id', user.id)
                .eq('availability_date', date);

            if (error) {
                // Silently handle table not found - table may not be created yet
                if (error.code === 'PGRST205' || error.message?.includes('service_date_availability')) {
                    setServiceAvailability({});
                    return;
                }
                throw error;
            }

            const availabilityMap: any = {};
            (data || []).forEach((item: any) => {
                availabilityMap[item.service_id] = item.is_available;
            });
            setServiceAvailability(availabilityMap);
        } catch (error: any) {
            // Only log non-table-missing errors
            if (error?.code !== 'PGRST205') {
                console.error('Error fetching service availability:', error);
            }
        } finally {
            setLoadingAvailability(false);
        }
    };

    const toggleServiceAvailability = async (serviceId: string, isCurrentlyAvailable: boolean) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const newAvailability = !isCurrentlyAvailable;

            // Optimistic update
            setServiceAvailability((prev: any) => ({
                ...prev,
                [serviceId]: newAvailability
            }));

            const { error } = await supabase
                .from('service_date_availability')
                .upsert({
                    vendor_id: user.id,
                    service_id: serviceId,
                    availability_date: selectedDate,
                    is_available: newAvailability
                }, {
                    onConflict: 'vendor_id,service_id,availability_date'
                });

            if (error) {
                // Silently handle table not found
                if (error.code === 'PGRST205' || error.message?.includes('service_date_availability')) {
                    // Revert optimistic update - table not yet created
                    setServiceAvailability((prev: any) => ({
                        ...prev,
                        [serviceId]: isCurrentlyAvailable
                    }));
                    return;
                }
                console.error('Error toggling availability:', error);
                // Revert optimistic update
                setServiceAvailability((prev: any) => ({
                    ...prev,
                    [serviceId]: isCurrentlyAvailable
                }));
            }
        } catch (error: any) {
            if (error?.code !== 'PGRST205') {
                console.error('Error toggling service availability:', error);
            }
        }
    };

    const markUnavailable = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('unavailability_blocks')
                .insert([{
                    vendor_id: user.id,
                    block_date: selectedDate,
                    start_time: '00:00:00',
                    end_time: '23:59:59',
                    reason: 'Manual block',
                    is_full_day: true
                }]);

            if (error) throw error;
            fetchCalendarData();
        } catch (error) {
            console.error('Error marking unavailable:', error);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color="#FF6B00" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4">
                <Text className="text-2xl font-bold" style={{ color: colors.text }}>Availability</Text>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>Manage your order calendar</Text>
            </View>

            <ScrollView className="flex-1">
                <View className="px-6 mb-6">
                    <RNCalendar
                        onDayPress={(day: any) => setSelectedDate(day.dateString)}
                        markedDates={{
                            ...markedDates,
                            [selectedDate]: { ...markedDates[selectedDate], selected: true, selectedColor: '#FF6B00' }
                        }}
                        theme={{
                            backgroundColor: colors.surface,
                            calendarBackground: colors.surface,
                            textSectionTitleColor: colors.textSecondary,
                            selectedDayBackgroundColor: '#FF6B00',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#FF6B00',
                            dayTextColor: colors.text,
                            textDisabledColor: colors.textSecondary,
                            dotColor: '#FF6B00',
                            selectedDotColor: '#ffffff',
                            arrowColor: '#FF6B00',
                            monthTextColor: colors.text,
                            indicatorColor: '#FF6B00',
                            textDayFontWeight: '600',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '600',
                            textDayFontSize: 14,
                            textMonthFontSize: 18,
                            textDayHeaderFontSize: 12,
                        }}
                        style={{
                            borderRadius: 24,
                            padding: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                        }}
                    />
                </View>

                <View className="px-6 mb-8">
                    <Text className="text-lg font-bold mb-4" style={{ color: colors.text }}>Schedule for {selectedDate}</Text>

                    {markedDates[selectedDate]?.dotColor === '#EF4444' ? (
                        <View className="rounded-3xl p-6 flex-row items-center" style={{ backgroundColor: isDarkMode ? '#7F1D1D' : '#FEE2E2', borderWidth: 1, borderColor: isDarkMode ? '#991B1B' : '#FECACA' }}>
                            <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                                <AlertCircle size={24} color="#EF4444" />
                            </View>
                            <View className="flex-1 ml-4">
                                <Text className="font-bold" style={{ color: isDarkMode ? '#FCA5A5' : '#991B1B' }}>Fully Booked</Text>
                                <Text className="text-xs" style={{ color: isDarkMode ? '#FCA5A5' : '#B91C1C' }}>Confirmed order for this day</Text>
                            </View>
                        </View>
                    ) : markedDates[selectedDate]?.disabled ? (
                        <View className="rounded-3xl p-6 flex-row items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                            <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                <AlertCircle size={24} color={colors.textSecondary} />
                            </View>
                            <View className="flex-1 ml-4">
                                <Text className="font-bold" style={{ color: colors.text }}>Unavailable</Text>
                                <Text className="text-xs" style={{ color: colors.textSecondary }}>Manual unavailability block</Text>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity className="rounded-3xl p-6 flex-row items-center mb-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                            <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                <Clock size={24} color="#FF6B00" />
                            </View>
                            <View className="flex-1 ml-4">
                                <Text className="font-bold" style={{ color: colors.text }}>Working Day</Text>
                                <Text className="text-xs" style={{ color: colors.textSecondary }}>Accepting orders for this date</Text>
                            </View>
                            <CheckCircle2 size={24} color="#10B981" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Service Availability Section */}
                <View className="px-6 mb-6">
                    <TouchableOpacity 
                        onPress={() => setShowServiceAvailability(!showServiceAvailability)}
                        activeOpacity={0.8}
                        className="rounded-3xl p-5 flex-row items-center justify-between"
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                    >
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: '#FF6B00' + '15' }}>
                                <Store size={20} color="#FF6B00" />
                            </View>
                            <View className="ml-3">
                                <Text className="font-bold" style={{ color: colors.text }}>Service Availability</Text>
                                <Text className="text-xs" style={{ color: colors.textSecondary }}>
                                    Manage per-service availability for {selectedDate}
                                </Text>
                            </View>
                        </View>
                        <ChevronDown 
                            size={20} 
                            color={colors.textSecondary} 
                            style={{ transform: [{ rotate: showServiceAvailability ? '180deg' : '0deg' }] }} 
                        />
                    </TouchableOpacity>

                    {showServiceAvailability && (
                        <View className="mt-3">
                            {loadingAvailability ? (
                                <View className="py-8 items-center">
                                    <ActivityIndicator size="small" color="#FF6B00" />
                                </View>
                            ) : services.length === 0 ? (
                                <View className="py-8 items-center rounded-2xl" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                                    <Store size={32} color={colors.textSecondary} />
                                    <Text className="font-medium mt-3" style={{ color: colors.textSecondary }}>No active services</Text>
                                    <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>Add services in the Services tab first</Text>
                                </View>
                            ) : (
                                services.map((service: any) => {
                                    const isAvailable = serviceAvailability[service.id] !== false;
                                    return (
                                        <View 
                                            key={service.id}
                                            className="rounded-2xl p-4 mb-2 flex-row items-center justify-between"
                                            style={{ 
                                                backgroundColor: colors.surface, 
                                                borderWidth: 1, 
                                                borderColor: isAvailable ? '#10B981' + '40' : colors.border
                                            }}
                                        >
                                            <View className="flex-1 mr-4">
                                                <Text className="font-bold" style={{ color: colors.text }} numberOfLines={1}>{service.name}</Text>
                                                <View className="flex-row items-center mt-1">
                                                    <Text className="text-[10px] uppercase font-bold tracking-widest" style={{ color: colors.textSecondary }}>
                                                        {service.category || 'Service'}
                                                    </Text>
                                                    <Text className="text-xs ml-3 font-semibold" style={{ color: '#FF6B00' }}>₹{service.price_amount}</Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => toggleServiceAvailability(service.id, isAvailable)}
                                                className="flex-row items-center"
                                            >
                                                <Text className="text-[10px] font-bold mr-2 uppercase" style={{ color: isAvailable ? '#10B981' : '#EF4444' }}>
                                                    {isAvailable ? 'Available' : 'Unavailable'}
                                                </Text>
                                                <View 
                                                    className="w-12 h-7 rounded-full justify-center"
                                                    style={{ backgroundColor: isAvailable ? '#10B981' : colors.border }}
                                                >
                                                    <View 
                                                        className="w-5 h-5 rounded-full"
                                                        style={{ 
                                                            backgroundColor: 'white',
                                                            marginLeft: isAvailable ? 24 : 4,
                                                        }}
                                                    />
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    )}
                </View>

                <View className="px-6 pb-12">
                    <TouchableOpacity
                        onPress={markUnavailable}
                        className="py-4 rounded-2xl items-center justify-center"
                        style={{ backgroundColor: colors.text }}
                    >
                        <Text className="font-bold" style={{ color: isDarkMode ? colors.background : '#FFFFFF' }}>Mark as Unavailable</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
