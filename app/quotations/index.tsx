import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FileText, Plus, ChevronRight, Search, Filter, Clock, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

export default function QuotationsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [quotations, setQuotations] = useState<any[]>([]);

    useEffect(() => {
        fetchQuotations();
    }, []);

    const fetchQuotations = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('quotations')
                .select('*, customers(full_name, avatar_url)')
                .eq('vendor_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setQuotations(data || []);
        } catch (error) {
            console.error('Error fetching quotations:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return '#F59E0B';
            case 'accepted': return '#10B981';
            case 'rejected': return '#EF4444';
            case 'expired': return '#6B7280';
            default: return '#6B7280';
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 flex-row justify-between items-center">
                <View>
                    <Text className="text-3xl font-extrabold text-accent-dark">Quotations</Text>
                    <Text className="text-accent font-medium mt-1">Manage your service bids</Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/quotations/create')}
                    className="w-12 h-12 bg-primary rounded-2xl items-center justify-center shadow-lg shadow-primary/30"
                >
                    <Plus size={24} color="white" strokeWidth={3} />
                </TouchableOpacity>
            </View>

            <View className="px-6 mb-6">
                <View className="flex-row bg-surface rounded-2xl px-4 py-3 items-center border border-gray-100">
                    <Search size={20} color="#9CA3AF" />
                    <Text className="text-gray-400 ml-3 flex-1 font-medium">Search quotations...</Text>
                    <Filter size={20} color="#FF6B00" />
                </View>
            </View>

            <ScrollView className="px-6 pb-8" showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View className="py-20">
                        <ActivityIndicator size="large" color="#FF6B00" />
                    </View>
                ) : quotations.length > 0 ? (
                    quotations.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => router.push(`/quotations/${item.id}`)}
                            className="bg-white border-2 border-gray-100 rounded-3xl p-5 mb-4 shadow-sm"
                        >
                            <View className="flex-row justify-between items-start mb-4">
                                <View className="bg-surface px-3 py-1.5 rounded-full border border-gray-50">
                                    <Text className="text-[10px] font-bold text-accent tracking-widest uppercase">
                                        #QT-{item.id.slice(0, 8).toUpperCase()}
                                    </Text>
                                </View>
                                <View
                                    className="px-3 py-1 rounded-full"
                                    style={{ backgroundColor: `${getStatusColor(item.status)}15` }}
                                >
                                    <Text
                                        className="text-[10px] font-extrabold uppercase tracking-widest"
                                        style={{ color: getStatusColor(item.status) }}
                                    >
                                        {item.status}
                                    </Text>
                                </View>
                            </View>

                            <Text className="text-xl font-extrabold text-accent-dark mb-2">{item.service_name}</Text>

                            <View className="flex-row items-center mb-4">
                                <Clock size={14} color="#9CA3AF" />
                                <Text className="text-accent text-xs font-bold ml-1">
                                    {new Date(item.valid_until).toLocaleDateString()}
                                </Text>
                            </View>

                            <View className="h-[1px] bg-gray-50 w-full mb-4" />

                            <View className="flex-row justify-between items-center">
                                <View className="flex-row items-center">
                                    <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center overflow-hidden mr-2">
                                        {item.customers?.avatar_url ? (
                                            <Image source={{ uri: item.customers.avatar_url }} className="w-full h-full" />
                                        ) : (
                                            <FileText size={16} color="#9CA3AF" />
                                        )}
                                    </View>
                                    <View>
                                        <Text className="text-accent-dark font-bold text-xs">{item.customers?.full_name || 'Anonymous Client'}</Text>
                                        <Text className="text-accent text-[10px]">Recipient</Text>
                                    </View>
                                </View>
                                <View>
                                    <Text className="text-primary font-extrabold text-lg">₹{item.total_amount}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View className="py-20 items-center justify-center">
                        <View className="w-20 h-20 bg-surface rounded-full items-center justify-center mb-4">
                            <FileText size={40} color="#9CA3AF" strokeWidth={1.5} />
                        </View>
                        <Text className="text-accent-dark font-extrabold text-xl">No Quotations Yet</Text>
                        <Text className="text-accent text-center mt-2 px-10">
                            Create professional quotations and send them to your clients directly.
                        </Text>
                        <TouchableOpacity
                            onPress={() => router.push('/quotations/create')}
                            className="bg-primary px-8 py-4 rounded-2xl mt-8 shadow-lg shadow-primary/20"
                        >
                            <Text className="text-white font-extrabold text-base">Create Your First</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
