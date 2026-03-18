import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FileText, Plus, ChevronRight, Search, Filter, Clock, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import BottomNav from '../../components/BottomNav';

export default function QuotationsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [quotations, setQuotations] = useState<any[]>([]);

    useEffect(() => {
        fetchQuotations();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchQuotations();
        setRefreshing(false);
    };

    const fetchQuotations = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('quotations')
                .select('*')
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
        switch (status?.toLowerCase()) {
            case 'pending': return '#F59E0B';
            case 'submitted': return '#3B82F6';
            case 'accepted': return '#10B981';
            case 'confirmed': return '#10B981';
            case 'rejected': return '#EF4444';
            case 'declined': return '#EF4444';
            case 'expired': return '#6B7280';
            case 'cancelled': return '#6B7280';
            default: return '#6B7280';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'submitted':
            case 'accepted':
            case 'confirmed':
                return <CheckCircle2 size={14} color={getStatusColor(status)} />;
            case 'rejected':
            case 'declined':
                return <AlertCircle size={14} color={getStatusColor(status)} />;
            default:
                return <Clock size={14} color={getStatusColor(status)} />;
        }
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4 flex-row justify-between items-center">
                <View>
                    <Text className="text-3xl font-extrabold" style={{ color: colors.text }}>Quotations</Text>
                    <Text className="font-medium mt-1" style={{ color: colors.textSecondary }}>Manage your service bids</Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/quotations/create')}
                    className="w-12 h-12 bg-primary rounded-2xl items-center justify-center shadow-lg shadow-primary/30"
                >
                    <Plus size={24} color="white" strokeWidth={3} />
                </TouchableOpacity>
            </View>

            <View className="px-6 mb-6">
                <View className="flex-row rounded-2xl px-4 py-3 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Search size={20} color={colors.textSecondary} />
                    <Text className="ml-3 flex-1 font-medium" style={{ color: colors.textSecondary }}>Search quotations...</Text>
                    <Filter size={20} color="#FF6B00" />
                </View>
            </View>

            <ScrollView 
                className="px-6 pb-8" 
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#FF6B00']}
                        tintColor="#FF6B00"
                    />
                }
            >
                {loading ? (
                    <View className="py-20">
                        <ActivityIndicator size="large" color="#FF6B00" />
                    </View>
                ) : quotations.length > 0 ? (
                    quotations.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => router.push(`/quotations/${item.id}`)}
                            className="rounded-3xl p-5 mb-4 shadow-sm"
                            style={{ backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border }}
                        >
                            <View className="flex-row justify-between items-start mb-4">
                                <View className="px-3 py-1.5 rounded-full border" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                                    <Text className="text-[10px] font-bold tracking-widest uppercase" style={{ color: colors.textSecondary }}>
                                        #QT-{item.id?.slice(0, 8)?.toUpperCase() || 'N/A'}
                                    </Text>
                                </View>
                                <View
                                    className="px-3 py-1.5 rounded-full flex-row items-center"
                                    style={{ backgroundColor: `${getStatusColor(item.status)}15` }}
                                >
                                    {getStatusIcon(item.status)}
                                    <Text
                                        className="text-[10px] font-extrabold uppercase tracking-widest ml-1.5"
                                        style={{ color: getStatusColor(item.status) }}
                                    >
                                        {item.status || 'pending'}
                                    </Text>
                                </View>
                            </View>

                            <Text className="text-xl font-extrabold mb-2" style={{ color: colors.text }}>{item.service_name || item.service_type || 'Service'}</Text>
                            
                            {item.customer_name && (
                                <Text className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Customer: {item.customer_name}</Text>
                            )}

                            <View className="flex-row items-center mb-2">
                                <Clock size={14} color={colors.textSecondary} />
                                <Text className="text-xs font-bold ml-1" style={{ color: colors.textSecondary }}>
                                    Quotation: {item.quotation_date ? new Date(item.quotation_date).toLocaleDateString() : 'N/A'}
                                </Text>
                            </View>

                            {item.delivery_date && (
                                <View className="flex-row items-center mb-2">
                                    <Clock size={14} color="#9CA3AF" />
                                    <Text className="text-xs font-bold ml-1" style={{ color: colors.textSecondary }}>
                                        Delivery: {new Date(item.delivery_date).toLocaleDateString()}
                                    </Text>
                                </View>
                            )}

                            {item.venue_address && (
                                <View className="mb-2">
                                    <Text className="text-xs font-medium" numberOfLines={1} style={{ color: colors.textSecondary }}>
                                        Venue: {item.venue_address}
                                    </Text>
                                </View>
                            )}

                            <View className="h-[1px] w-full mb-4" style={{ backgroundColor: colors.border }} />

                            <View className="flex-row justify-between items-center">
                                <View>
                                    <Text className="text-[10px] font-bold uppercase" style={{ color: colors.textSecondary }}>Amount</Text>
                                </View>
                                <View>
                                    <Text className="text-primary font-extrabold text-lg">₹{item.total_amount || item.amount || '0'}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View className="py-20 items-center justify-center">
                        <View className="w-20 h-20 bg-surface rounded-full items-center justify-center mb-4">
                            <FileText size={40} color="#9CA3AF" strokeWidth={1.5} />
                        </View>
                        <Text className="font-extrabold text-xl" style={{ color: colors.text }}>No Quotations Yet</Text>
                        <Text className="text-center mt-2 px-10" style={{ color: colors.textSecondary }}>
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
                
                {/* Bottom spacing for nav */}
                <View style={{ height: 120 }} />
            </ScrollView>
            
            {/* Bottom Navigation */}
            <BottomNav />
        </SafeAreaView>
    );
}
