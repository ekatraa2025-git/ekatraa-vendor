import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';

export default function CalendarScreen() {
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [markedDates, setMarkedDates] = useState<any>({});
    const [daySchedule, setDaySchedule] = useState<any[]>([]);

    useEffect(() => {
        fetchCalendarData();
    }, []);

    const fetchCalendarData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Bookings
            const { data: bookings } = await supabase
                .from('bookings')
                .select('*')
                .eq('vendor_id', user.id)
                .eq('status', 'confirmed');

            // Fetch Blocks
            const { data: blocks } = await supabase
                .from('unavailability_blocks')
                .select('*')
                .eq('vendor_id', user.id);

            const newMarkedDates: any = {};

            bookings?.forEach(b => {
                if (b.booking_date) {
                    newMarkedDates[b.booking_date] = { marked: true, dotColor: '#EF4444' };
                }
            });

            blocks?.forEach(b => {
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
                <Text className="text-2xl font-bold text-accent-dark">Availability</Text>
                <Text className="text-accent text-xs">Manage your booking calendar</Text>
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
                            backgroundColor: '#ffffff',
                            calendarBackground: '#ffffff',
                            textSectionTitleColor: '#9CA3AF',
                            selectedDayBackgroundColor: '#FF6B00',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#FF6B00',
                            dayTextColor: '#1F2937',
                            textDisabledColor: '#D1D5DB',
                            dotColor: '#FF6B00',
                            selectedDotColor: '#ffffff',
                            arrowColor: '#FF6B00',
                            monthTextColor: '#1F2937',
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
                            borderColor: '#F3F4F6',
                        }}
                    />
                </View>

                <View className="px-6 mb-8">
                    <Text className="text-lg font-bold text-accent-dark mb-4">Schedule for {selectedDate}</Text>

                    {markedDates[selectedDate]?.dotColor === '#EF4444' ? (
                        <View className="bg-red-50 border border-red-100 rounded-3xl p-6 flex-row items-center">
                            <View className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-gray-100">
                                <AlertCircle size={24} color="#EF4444" />
                            </View>
                            <View className="flex-1 ml-4">
                                <Text className="text-red-950 font-bold">Fully Booked</Text>
                                <Text className="text-red-800/60 text-xs">Confirmed booking for this day</Text>
                            </View>
                        </View>
                    ) : markedDates[selectedDate]?.disabled ? (
                        <View className="bg-gray-50 border border-gray-100 rounded-3xl p-6 flex-row items-center">
                            <View className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-gray-100">
                                <AlertCircle size={24} color="#4B5563" />
                            </View>
                            <View className="flex-1 ml-4">
                                <Text className="text-accent-dark font-bold">Unavailable</Text>
                                <Text className="text-accent text-xs">Manual unavailability block</Text>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity className="bg-surface border border-gray-50 rounded-3xl p-6 flex-row items-center mb-4">
                            <View className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-gray-100">
                                <Clock size={24} color="#FF6B00" />
                            </View>
                            <View className="flex-1 ml-4">
                                <Text className="text-accent-dark font-bold">Working Day</Text>
                                <Text className="text-accent text-xs">Accepting bookings for this date</Text>
                            </View>
                            <CheckCircle2 size={24} color="#10B981" />
                        </TouchableOpacity>
                    )}
                </View>

                <View className="px-6 pb-12">
                    <TouchableOpacity
                        onPress={markUnavailable}
                        className="bg-accent-dark py-4 rounded-2xl items-center justify-center"
                    >
                        <Text className="text-white font-bold">Mark as Unavailable</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
