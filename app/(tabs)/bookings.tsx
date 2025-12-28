import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, MapPin, Check, X, ChevronRight, Edit3, MessageSquare } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function BookingsScreen() {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState<any[]>([]);
    const [filter, setFilter] = useState('all');
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingBooking, setEditingBooking] = useState<any>(null);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('bookings')
                .select('*, services(name)')
                .eq('vendor_id', user.id)
                .order('booking_date', { ascending: false });

            if (error) throw error;
            setBookings(data || []);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateBookingStatus = async (id: string, status: string, notes?: string) => {
        try {
            setUpdating(true);
            const { error } = await supabase
                .from('bookings')
                .update({ status, notes: notes || editingBooking?.notes })
                .eq('id', id);

            if (error) throw error;
            setBookings(bookings.map(b => b.id === id ? { ...b, status, notes: notes || b.notes } : b));
            setEditModalVisible(false);
            if (status !== editingBooking?.status) {
                Alert.alert('Success', `Booking marked as ${status}`);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update booking');
        } finally {
            setUpdating(false);
        }
    };

    const filteredBookings = bookings.filter(b => {
        if (filter === 'all') return true;
        return b.status === filter;
    });

    const renderBookingCard = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => {
                setEditingBooking(item);
                setEditModalVisible(true);
            }}
            className="bg-white border border-gray-100 rounded-[32px] p-6 mb-6 shadow-sm"
        >
            <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 mr-4">
                    <Text className="text-accent text-[10px] uppercase font-bold tracking-widest">{item.services?.name || 'Service'}</Text>
                    <Text className="text-xl font-bold text-accent-dark mt-1" numberOfLines={1}>{item.customer_name}</Text>
                </View>
                <View className={`px-3 py-1 rounded-full ${item.status === 'confirmed' ? 'bg-green-50' :
                    item.status === 'pending' ? 'bg-orange-50' :
                        item.status === 'completed' ? 'bg-blue-50' : 'bg-gray-50'
                    }`}>
                    <Text className={`text-[10px] font-bold uppercase ${item.status === 'confirmed' ? 'text-green-600' :
                        item.status === 'pending' ? 'text-orange-600' :
                            item.status === 'completed' ? 'text-blue-600' : 'text-gray-600'
                        }`}>{item.status}</Text>
                </View>
            </View>

            <View className="space-y-3">
                <View className="flex-row items-center">
                    <Calendar size={16} color="#9CA3AF" />
                    <Text className="text-accent-dark text-sm ml-2 font-medium">
                        {item.booking_date}
                    </Text>
                </View>
                <View className="flex-row items-center mt-2">
                    <Clock size={16} color="#9CA3AF" />
                    <Text className="text-accent-dark text-sm ml-2 font-medium">
                        {item.booking_time}
                    </Text>
                </View>
                <View className="flex-row items-center mt-2">
                    <MapPin size={16} color="#9CA3AF" />
                    <Text className="text-accent text-sm ml-2" numberOfLines={1}>Customer: {item.customer_phone}</Text>
                </View>
                {item.notes && (
                    <View className="flex-row items-start mt-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <MessageSquare size={14} color="#9CA3AF" className="mt-0.5" />
                        <Text className="text-accent text-xs ml-2 flex-1" numberOfLines={2}>{item.notes}</Text>
                    </View>
                )}
            </View>

            {item.status === 'pending' && (
                <View className="flex-row mt-6 pt-6 border-t border-gray-50">
                    <TouchableOpacity
                        onPress={() => updateBookingStatus(item.id, 'cancelled')}
                        className="flex-1 flex-row items-center justify-center py-3 bg-gray-50 rounded-2xl mr-2"
                    >
                        <X size={18} color="#4B5563" />
                        <Text className="text-accent font-bold ml-2">Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => updateBookingStatus(item.id, 'confirmed')}
                        className="flex-1 flex-row items-center justify-center py-3 bg-primary rounded-2xl ml-2"
                    >
                        <Check size={18} color="white" />
                        <Text className="text-white font-bold ml-2">Accept</Text>
                    </TouchableOpacity>
                </View>
            )}

            {item.status === 'confirmed' && (
                <TouchableOpacity
                    onPress={() => updateBookingStatus(item.id, 'completed')}
                    className="mt-6 pt-6 border-t border-gray-50 flex-row items-center justify-center"
                >
                    <Check size={18} color="#10B981" />
                    <Text className="text-green-600 font-bold ml-2">Mark as Completed</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#FF6B00" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4">
                <Text className="text-2xl font-bold text-accent-dark">Bookings</Text>
                <Text className="text-accent text-xs">Manage client requests</Text>
            </View>

            <View className="px-6 mb-6">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {['all', 'pending', 'confirmed', 'completed'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setFilter(f)}
                            className={`px-6 py-2.5 rounded-full mr-3 border ${filter === f ? 'bg-accent-dark border-accent-dark' : 'bg-white border-gray-100'
                                }`}
                        >
                            <Text className={`font-bold text-xs capitalize ${filter === f ? 'text-white' : 'text-accent'
                                }`}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={filteredBookings}
                renderItem={renderBookingCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 24 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={() => (
                    <View className="flex-1 items-center justify-center py-20">
                        <Text className="text-accent font-medium">No {filter} bookings</Text>
                    </View>
                )}
            />

            <Modal
                animationType="slide"
                transparent={true}
                visible={editModalVisible}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-[40px] p-8 pb-12">
                        <View className="flex-row justify-between items-center mb-8">
                            <Text className="text-2xl font-bold text-accent-dark">Booking Details</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <X size={24} color="#4B5563" />
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-6">
                            <View>
                                <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">Customer Name</Text>
                                <Text className="text-black font-semibold text-lg">{editingBooking?.customer_name}</Text>
                            </View>

                            <View className="mt-4">
                                <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">Booking Notes</Text>
                                <TextInput
                                    value={editingBooking?.notes}
                                    onChangeText={(t) => setEditingBooking({ ...editingBooking, notes: t })}
                                    multiline
                                    numberOfLines={4}
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-medium text-sm"
                                    placeholder="Add notes about this booking..."
                                    style={{ height: 100, textAlignVertical: 'top' }}
                                />
                            </View>
                        </View>

                        <View className="flex-row mt-10">
                            {editingBooking?.status === 'pending' && (
                                <>
                                    <TouchableOpacity
                                        onPress={() => updateBookingStatus(editingBooking.id, 'cancelled', editingBooking.notes)}
                                        className="flex-1 bg-gray-100 py-5 rounded-2xl mr-2 items-center"
                                    >
                                        <Text className="text-accent font-bold">Decline</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => updateBookingStatus(editingBooking.id, 'confirmed', editingBooking.notes)}
                                        className="flex-1 bg-primary py-5 rounded-2xl ml-2 items-center"
                                    >
                                        <Text className="text-white font-bold">Accept</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            {editingBooking?.status === 'confirmed' && (
                                <TouchableOpacity
                                    onPress={() => updateBookingStatus(editingBooking.id, 'completed', editingBooking.notes)}
                                    className="flex-1 bg-green-500 py-5 rounded-2xl items-center"
                                >
                                    <Text className="text-white font-bold">Mark as Completed</Text>
                                </TouchableOpacity>
                            )}
                            {(editingBooking?.status === 'completed' || editingBooking?.status === 'cancelled') && (
                                <TouchableOpacity
                                    onPress={() => updateBookingStatus(editingBooking.id, editingBooking.status, editingBooking.notes)}
                                    className="flex-1 bg-accent-dark py-5 rounded-2xl items-center"
                                >
                                    <Text className="text-white font-bold">Save Notes</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
