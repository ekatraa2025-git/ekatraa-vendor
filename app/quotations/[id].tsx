import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Calendar, FileText, Download, Share2, CheckCircle2, XCircle, Clock, MapPin, ReceiptText } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';

export default function QuotationDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [quotation, setQuotation] = useState<any>(null);
    const [imageUrlCache, setImageUrlCache] = useState<{[key: string]: string}>({});

    useEffect(() => {
        fetchQuotation();
    }, [id]);

    // Helper function to get signed URL from file path or existing URL
    const getImageUrl = async (urlOrPath: string | null | undefined): Promise<string> => {
        if (!urlOrPath) return '';
        
        try {
            // If it's already a full URL (signed or public), return as-is
            if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
                return urlOrPath;
            }

            // Check cache first
            if (imageUrlCache[urlOrPath]) {
                return imageUrlCache[urlOrPath];
            }

            // Extract filename from path (handle both full paths and just filenames)
            let fileName = urlOrPath;
            if (urlOrPath.includes('/')) {
                fileName = urlOrPath.split('/').pop() || urlOrPath;
            }
            
            // Generate signed URL (valid for 24 hours for better caching)
            const { data, error } = await supabase.storage
                .from('ekatraa2025')
                .createSignedUrl(fileName, 86400); // 24 hours expiry for faster loading

            if (error) {
                console.error('[SIGNED URL ERROR]', error);
                // Fallback to public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('ekatraa2025')
                    .getPublicUrl(fileName);
                setImageUrlCache(prev => ({ ...prev, [urlOrPath]: publicUrl }));
                return publicUrl;
            }

            setImageUrlCache(prev => ({ ...prev, [urlOrPath]: data.signedUrl }));
            return data.signedUrl;
        } catch (error) {
            console.error('[GET IMAGE URL ERROR]', error);
            return urlOrPath; // Return original if all fails
        }
    };

    // Component to handle image loading with signed URLs
    const QuotationImage = ({ imageUrl }: { imageUrl: string | null | undefined }) => {
        const [displayUrl, setDisplayUrl] = useState<string>('');

        useEffect(() => {
            const loadImage = async () => {
                if (!imageUrl || imageUrl.startsWith('file') || imageUrl.startsWith('content')) {
                    setDisplayUrl('');
                    return;
                }
                const url = await getImageUrl(imageUrl);
                setDisplayUrl(url || '');
            };
            loadImage();
        }, [imageUrl]);

        if (!displayUrl) return null;

        return (
            <Image 
                source={{ uri: displayUrl }} 
                className="w-full h-full" 
                resizeMode="cover"
                onError={(e) => console.error('[IMAGE ERROR]', e.nativeEvent.error)}
            />
        );
    };

    const fetchQuotation = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('quotations')
                .select('*')
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
            <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color="#FF6B00" />
            </SafeAreaView>
        );
    }

    if (!quotation) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <Text className="text-accent">Quotation not found.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
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
                    <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-4">Quotation Header</Text>
                    <View className="space-y-2">
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold text-accent">Customer Name</Text>
                            <Text className="text-sm font-bold text-accent-dark">{quotation.customer_name || 'N/A'}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold text-accent">Quotation Date</Text>
                            <Text className="text-sm font-bold text-accent-dark">
                                {quotation.quotation_date ? new Date(quotation.quotation_date).toLocaleString() : 'N/A'}
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold text-accent">Delivery Date</Text>
                            <Text className="text-sm font-bold text-accent-dark">
                                {quotation.delivery_date ? new Date(quotation.delivery_date).toLocaleString() : 'N/A'}
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold text-accent">Venue Address</Text>
                            <Text className="text-sm font-bold text-accent-dark flex-1 text-right ml-2" numberOfLines={2}>
                                {quotation.venue_address || 'N/A'}
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold text-accent">Service Type</Text>
                            <Text className="text-sm font-bold text-accent-dark">{quotation.service_name || quotation.service_type || 'Service'}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold text-accent">Amount</Text>
                            <Text className="text-sm font-bold text-accent-dark">₹{quotation.total_amount || quotation.amount || '0'}</Text>
                        </View>
                    </View>
                </View>

                {quotation.specifications && (
                    <View className="mb-6">
                        <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3 ml-1">a. Detailed Product Specifications</Text>
                        <View className="bg-surface rounded-3xl p-4 mb-3">
                            <Text className="text-accent-dark text-sm leading-6 font-medium">
                                {quotation.specifications}
                            </Text>
                        </View>
                        {quotation.attachments?.specifications && Array.isArray(quotation.attachments.specifications) && quotation.attachments.specifications.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {quotation.attachments.specifications.map((url: string, index: number) => (
                                    <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
                                        <QuotationImage imageUrl={url} />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {quotation.quantity_requirements && (
                    <View className="mb-6">
                        <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3 ml-1">b. Quantity Requirements</Text>
                        <View className="bg-surface rounded-3xl p-4 mb-3">
                            <Text className="text-accent-dark text-sm leading-6 font-medium">
                                {quotation.quantity_requirements}
                            </Text>
                        </View>
                        {quotation.attachments?.quantityRequirements && Array.isArray(quotation.attachments.quantityRequirements) && quotation.attachments.quantityRequirements.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {quotation.attachments.quantityRequirements.map((url: string, index: number) => (
                                    <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
                                        <QuotationImage imageUrl={url} />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {quotation.quality_standards && (
                    <View className="mb-6">
                        <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3 ml-1">c. Quality Standards</Text>
                        <View className="bg-surface rounded-3xl p-4 mb-3">
                            <Text className="text-accent-dark text-sm leading-6 font-medium">
                                {quotation.quality_standards}
                            </Text>
                        </View>
                        {quotation.attachments?.qualityStandards && Array.isArray(quotation.attachments.qualityStandards) && quotation.attachments.qualityStandards.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {quotation.attachments.qualityStandards.map((url: string, index: number) => (
                                    <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
                                        <QuotationImage imageUrl={url} />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {quotation.delivery_terms && (
                    <View className="mb-6">
                        <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3 ml-1">d. Delivery Terms</Text>
                        <View className="bg-surface rounded-3xl p-4 mb-3">
                            <Text className="text-accent-dark text-sm leading-6 font-medium">
                                {quotation.delivery_terms}
                            </Text>
                        </View>
                        {quotation.attachments?.deliveryTerms && Array.isArray(quotation.attachments.deliveryTerms) && quotation.attachments.deliveryTerms.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {quotation.attachments.deliveryTerms.map((url: string, index: number) => (
                                    <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
                                        <QuotationImage imageUrl={url} />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {quotation.payment_terms && (
                    <View className="mb-6">
                        <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3 ml-1">e. Payment Terms (Beyond 20% Advance)</Text>
                        <View className="bg-surface rounded-3xl p-4 mb-3">
                            <Text className="text-accent-dark text-sm leading-6 font-medium">
                                {quotation.payment_terms}
                            </Text>
                        </View>
                        {quotation.attachments?.paymentTerms && Array.isArray(quotation.attachments.paymentTerms) && quotation.attachments.paymentTerms.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {quotation.attachments.paymentTerms.map((url: string, index: number) => (
                                    <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
                                        <QuotationImage imageUrl={url} />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* Legacy attachments support */}
                {quotation.attachments && Array.isArray(quotation.attachments) && quotation.attachments.length > 0 && (
                    <View className="mb-8">
                        <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-4 ml-1">Reference Documents</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {quotation.attachments.map((url: string, index: number) => (
                                <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
                                    <Image 
                                        source={{ uri: url && !url.startsWith('file') && !url.startsWith('content') ? url : undefined }} 
                                        className="w-full h-full" 
                                        resizeMode="cover"
                                        onError={(e) => console.error('[IMAGE ERROR] Legacy:', e.nativeEvent.error)}
                                    />
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View className="bg-white border-2 border-gray-100 rounded-3xl p-6 mb-6">
                    <Text className="text-[10px] font-bold text-accent uppercase tracking-widest mb-4">Terms & Conditions</Text>
                    <View className="space-y-2">
                        <View className="flex-row items-center">
                            <CheckCircle2 size={16} color={quotation.vendor_tc_accepted ? '#10B981' : '#9CA3AF'} />
                            <Text className="text-sm font-medium text-accent-dark ml-2">
                                Vendor T&C: {quotation.vendor_tc_accepted ? 'Accepted' : 'Not Accepted'}
                            </Text>
                        </View>
                        <View className="flex-row items-center">
                            <CheckCircle2 size={16} color={quotation.customer_tc_accepted ? '#10B981' : '#9CA3AF'} />
                            <Text className="text-sm font-medium text-accent-dark ml-2">
                                Customer T&C: {quotation.customer_tc_accepted ? 'Accepted' : 'Not Accepted'}
                            </Text>
                        </View>
                    </View>
                </View>

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
