import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Calendar, FileText, Download, Share2, CheckCircle2, XCircle, Clock, MapPin, ReceiptText } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function QuotationDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [quotation, setQuotation] = useState<any>(null);

    useEffect(() => {
        fetchQuotation();
    }, [id]);

    const fetchQuotation = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('quotations')
                .select('*, customers(full_name, avatar_url, phone)')
                .eq('id', id)
                .single();

            if (error) throw error;
            setQuotation(data);
        } catch (error) {
            console.error('Error fetching quotation details:', error);
            Alert.alert('Error', 'Could not load quotation details.');
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Quotation for ${quotation.service_name}\nAmount: ₹${quotation.total_amount}\nValid until: ${new Date(quotation.valid_until).toLocaleDateString()}\nCheck it out on Ekatraa App!`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#FF6B00" />
            </SafeAreaView>
        );
    }

    if (!quotation) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <Text className="text-accent">Quotation not found.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 flex-row justify-between items-center">
                <TouchableOpacity onPress={() => router.back()}>
                    <ChevronLeft size={28} color="#000000" />
                </TouchableOpacity>
                <View className="flex-row">
                    <TouchableOpacity onPress={handleShare} className="mr-4">
                        <Share2 size={24} color="#000000" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Receipt', 'Receipt generation logic would go here.')}>
                        <ReceiptText size={24} color="#000000" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1 px-6 pb-20" showsVerticalScrollIndicator={false}>
                <View className="items-center mb-8">
                    <View className={`w-20 h-20 rounded-3xl items-center justify-center mb-4 ${quotation.status === 'accepted' ? 'bg-green-100' : 'bg-orange-100'}`}>
                        <FileText size={40} color={quotation.status === 'accepted' ? '#059669' : '#FF6B00'} />
                    </View>
                    <Text className="text-3xl font-extrabold text-accent-dark">₹{quotation.total_amount}</Text>
                    <View className="flex-row items-center mt-2">
                        <View className={`w-2 h-2 rounded-full mr-2 ${quotation.status === 'accepted' ? 'bg-green-500' : 'bg-orange-500'}`} />
                        <Text className={`text-xs font-extrabold uppercase tracking-widest ${quotation.status === 'accepted' ? 'text-green-600' : 'text-orange-600'}`}>
                            {quotation.status} Quotation
                        </Text>
                    </View>
                </View>

                <View className="bg-surface rounded-3xl p-6 mb-6 border border-gray-100">
                    <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-4">Service Details</Text>
                    <Text className="text-xl font-extrabold text-accent-dark mb-2">{quotation.service_name}</Text>
                    <View className="flex-row items-center mb-2">
                        <Calendar size={14} color="#9CA3AF" />
                        <Text className="text-accent text-xs font-bold ml-1">Valid until: {new Date(quotation.valid_until).toLocaleDateString()}</Text>
                    </View>
                </View>

                <View className="bg-white border-2 border-gray-100 rounded-3xl p-6 mb-6">
                    <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-4">Client Information</Text>
                    <View className="flex-row items-center">
                        <View className="w-12 h-12 rounded-2xl bg-gray-100 items-center justify-center mr-4">
                            <Text className="text-xl font-bold text-accent-dark">
                                {quotation.customers?.full_name?.[0] || 'C'}
                            </Text>
                        </View>
                        <View>
                            <Text className="text-lg font-extrabold text-accent-dark">{quotation.customers?.full_name || 'Anonymous Client'}</Text>
                            <Text className="text-accent text-xs font-bold">{quotation.customers?.phone || 'No phone provided'}</Text>
                        </View>
                    </View>
                </View>

                <View className="mb-8">
                    <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-4 ml-1">Legal Terms & Conditions</Text>
                    <View className="bg-surface rounded-3xl p-6">
                        <Text className="text-accent-dark text-sm leading-6 font-medium">
                            {quotation.legal_terms}
                        </Text>
                    </View>
                </View>

                {quotation.attachments && quotation.attachments.length > 0 && (
                    <View className="mb-8">
                        <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-4 ml-1">Reference Documents</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {quotation.attachments.map((url: string, index: number) => (
                                <TouchableOpacity key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
                                    <Image source={{ uri: url }} className="w-full h-full" resizeMode="cover" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {quotation.status === 'pending' && (
                    <View className="flex-row space-x-4 mb-10">
                        <TouchableOpacity
                            className="flex-1 bg-red-50 py-5 rounded-2xl items-center border border-red-100"
                            onPress={() => Alert.alert('Cancel', 'Are you sure you want to cancel this quotation?', [{ text: 'Cancel' }, { text: 'Yes', style: 'destructive' }])}
                        >
                            <Text className="text-red-600 font-extrabold text-base">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 bg-black py-5 rounded-2xl items-center shadow-lg"
                            onPress={() => Alert.alert('Edit', 'Editing logic would go here.')}
                        >
                            <Text className="text-white font-extrabold text-base">Edit Bid</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
