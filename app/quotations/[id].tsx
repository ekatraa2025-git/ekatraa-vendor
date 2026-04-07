import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Calendar, FileText, Download, Share2, CheckCircle2, XCircle, Clock, MapPin, ReceiptText } from 'lucide-react-native';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';
import { resolveStorageImageUrl } from '../../lib/storageImageUrl';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import BottomNav from '../../components/BottomNav';

export default function QuotationDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colors, isDarkMode } = useTheme();
    const { showToast, showConfirm } = useToast();
    const [loading, setLoading] = useState(true);
    const [quotation, setQuotation] = useState<any>(null);
    const [vendor, setVendor] = useState<any>(null);
    const [imageUrlCache, setImageUrlCache] = useState<{[key: string]: string}>({});

    useEffect(() => {
        fetchQuotation();
    }, [id]);

    const getImageUrl = async (urlOrPath: string | null | undefined): Promise<string> => {
        if (!urlOrPath) return '';
        if (urlOrPath.startsWith('file') || urlOrPath.startsWith('content')) {
            return urlOrPath;
        }
        if (imageUrlCache[urlOrPath]) {
            return imageUrlCache[urlOrPath];
        }
        const resolved = await resolveStorageImageUrl(urlOrPath, 86400);
        setImageUrlCache((prev) => ({ ...prev, [urlOrPath]: resolved }));
        return resolved;
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
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('quotations')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setQuotation(data);

            // Fetch vendor data for receipt
            const { data: vendorData } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', user.id)
                .single();
            
            setVendor(vendorData);
        } catch (error) {
            console.error('Error fetching quotation details:', error);
            showToast({ variant: 'error', title: 'Could not load', message: 'Could not load quotation details.' });
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Quotation for ${quotation.service_name || quotation.service_type}\nAmount: ₹${quotation.total_amount || quotation.amount || '0'}\nValid until: ${quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString() : 'N/A'}\nCheck it out on Ekatraa App!`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const generateReceipt = async () => {
        if (!quotation || !vendor) {
            showToast({ variant: 'error', title: 'Missing data', message: 'Quotation or vendor data not available.' });
            return;
        }

        try {
            const receiptId = `REC-${quotation.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
            const date = new Date().toLocaleDateString('en-IN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

            // Generate receipt content
            const receiptContent = `
═══════════════════════════════════════
           EKATRAA RECEIPT
═══════════════════════════════════════

Receipt ID: ${receiptId}
Date: ${date}

VENDOR INFORMATION:
${vendor.business_name || 'N/A'}
${vendor.address || ''}
${vendor.phone || ''}

QUOTATION DETAILS:
Service: ${quotation.service_name || quotation.service_type || 'N/A'}
Customer: ${quotation.customer_name || 'N/A'}
Quotation Date: ${quotation.quotation_date ? new Date(quotation.quotation_date).toLocaleDateString() : 'N/A'}
Delivery Date: ${quotation.delivery_date ? new Date(quotation.delivery_date).toLocaleDateString() : 'N/A'}

AMOUNT:
Total Amount: ₹${quotation.total_amount || quotation.amount || '0'}

STATUS: ${quotation.status?.toUpperCase() || 'PENDING'}

═══════════════════════════════════════
Thank you for choosing Ekatraa!
═══════════════════════════════════════
            `.trim();

            // Share receipt as text (works on all platforms)
            await Share.share({
                message: receiptContent,
                title: `Receipt_${receiptId}.txt`,
            });
            
            showToast({ variant: 'success', title: 'Receipt ready', message: 'You can save it from the share menu.' });
        } catch (error: any) {
            console.error('Error generating receipt:', error);
            showToast({ variant: 'error', title: 'Receipt failed', message: error.message || 'Failed to generate receipt.' });
        }
    };

    const handleCancelQuotation = () => {
        if (!quotation?.id) return;
        showConfirm({
            title: 'Cancel quotation',
            message: 'Are you sure you want to withdraw this quotation?',
            confirmLabel: 'Yes, cancel',
            destructive: true,
            onConfirm: async () => {
                try {
                    const {
                        data: { user },
                    } = await supabase.auth.getUser();
                    if (!user) {
                        showToast({ variant: 'error', title: 'Not signed in', message: 'Please log in again.' });
                        return;
                    }
                    const { error } = await supabase
                        .from('quotations')
                        .update({ status: 'declined' })
                        .eq('id', quotation.id)
                        .eq('vendor_id', user.id);
                    if (error) throw error;
                    await fetchQuotation();
                    showToast({ variant: 'success', title: 'Quotation withdrawn', message: 'Your bid was cancelled.' });
                } catch (e: any) {
                    showToast({ variant: 'error', title: 'Could not cancel', message: e?.message || 'Please try again.' });
                }
            },
        });
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
                <Text style={{ color: colors.text }}>Quotation not found.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4 flex-row justify-between items-center">
                <TouchableOpacity onPress={() => router.back()}>
                    <ChevronLeft size={28} color={isDarkMode ? colors.text : '#000000'} />
                </TouchableOpacity>
                <View className="flex-row">
                    <TouchableOpacity onPress={handleShare} className="mr-4">
                        <Share2 size={24} color={isDarkMode ? colors.text : '#000000'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={generateReceipt}>
                        <ReceiptText size={24} color={isDarkMode ? colors.text : '#000000'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1 px-6 pb-20" showsVerticalScrollIndicator={false}>
                <View className="items-center mb-8">
                    <View className={`w-20 h-20 rounded-3xl items-center justify-center mb-4 ${quotation.status === 'accepted' ? 'bg-green-100' : 'bg-orange-100'}`}>
                        <FileText size={40} color={isDarkMode ? colors.text : (quotation.status === 'accepted' ? '#059669' : '#FF6B00')} />
                    </View>
                    <Text className="text-3xl font-extrabold" style={{ color: colors.text }}>₹{quotation.total_amount || quotation.amount || '0'}</Text>
                    <View className="flex-row items-center mt-2">
                        <View className={`w-2 h-2 rounded-full mr-2 ${quotation.status === 'accepted' ? 'bg-green-500' : 'bg-orange-500'}`} />
                        <Text className={`text-xs font-extrabold uppercase tracking-widest ${quotation.status === 'accepted' ? 'text-green-600' : 'text-orange-600'}`}>
                            {quotation.status} Quotation
                        </Text>
                    </View>
                </View>

                <View className="rounded-3xl p-6 mb-6" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Text className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: colors.textSecondary }}>Quotation Header</Text>
                    <View className="space-y-2">
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>Customer Name</Text>
                            <Text className="text-sm font-bold" style={{ color: colors.text }}>{quotation.customer_name || 'N/A'}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>Quotation Date</Text>
                            <Text className="text-sm font-bold" style={{ color: colors.text }}>
                                {quotation.quotation_date ? new Date(quotation.quotation_date).toLocaleString() : 'N/A'}
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>Delivery Date</Text>
                            <Text className="text-sm font-bold" style={{ color: colors.text }}>
                                {quotation.delivery_date ? new Date(quotation.delivery_date).toLocaleString() : 'N/A'}
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>Venue Address</Text>
                            <Text className="text-sm font-bold flex-1 text-right ml-2" numberOfLines={2} style={{ color: colors.text }}>
                                {quotation.venue_address || 'N/A'}
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>Service Type</Text>
                            <Text className="text-sm font-bold" style={{ color: colors.text }}>{quotation.service_name || quotation.service_type || 'Service'}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>Amount</Text>
                            <Text className="text-sm font-bold" style={{ color: colors.text }}>₹{quotation.total_amount || quotation.amount || '0'}</Text>
                        </View>
                    </View>
                </View>

                {quotation.specifications && (
                    <View className="mb-6">
                        <Text className="text-[10px] font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: colors.text }}>a. Detailed Product Specifications</Text>
                        <View className="rounded-3xl p-4 mb-3" style={{ backgroundColor: colors.surface }}>
                            <Text className="text-sm leading-6 font-medium" style={{ color: colors.text }}>
                                {quotation.specifications}
                            </Text>
                        </View>
                        {quotation.attachments?.specifications && Array.isArray(quotation.attachments.specifications) && quotation.attachments.specifications.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {quotation.attachments.specifications.map((url: string, index: number) => (
                                    <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                        <QuotationImage imageUrl={url} />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {quotation.quantity_requirements && (
                    <View className="mb-6">
                        <Text className="text-[10px] font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: colors.text }}>b. Quantity Requirements</Text>
                        <View className="rounded-3xl p-4 mb-3" style={{ backgroundColor: colors.surface }}>
                            <Text className="text-sm leading-6 font-medium" style={{ color: colors.text }}>
                                {quotation.quantity_requirements}
                            </Text>
                        </View>
                        {quotation.attachments?.quantityRequirements && Array.isArray(quotation.attachments.quantityRequirements) && quotation.attachments.quantityRequirements.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {quotation.attachments.quantityRequirements.map((url: string, index: number) => (
                                    <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                        <QuotationImage imageUrl={url} />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {quotation.quality_standards && (
                    <View className="mb-6">
                        <Text className="text-[10px] font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: colors.text }}>c. Quality Standards</Text>
                        <View className="rounded-3xl p-4 mb-3" style={{ backgroundColor: colors.surface }}>
                            <Text className="text-sm leading-6 font-medium" style={{ color: colors.text }}>
                                {quotation.quality_standards}
                            </Text>
                        </View>
                        {quotation.attachments?.qualityStandards && Array.isArray(quotation.attachments.qualityStandards) && quotation.attachments.qualityStandards.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {quotation.attachments.qualityStandards.map((url: string, index: number) => (
                                    <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                        <QuotationImage imageUrl={url} />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {quotation.delivery_terms && (
                    <View className="mb-6">
                        <Text className="text-[10px] font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: colors.text }}>d. Delivery Terms</Text>
                        <View className="rounded-3xl p-4 mb-3" style={{ backgroundColor: colors.surface }}>
                            <Text className="text-sm leading-6 font-medium" style={{ color: colors.text }}>
                                {quotation.delivery_terms}
                            </Text>
                        </View>
                        {quotation.attachments?.deliveryTerms && Array.isArray(quotation.attachments.deliveryTerms) && quotation.attachments.deliveryTerms.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {quotation.attachments.deliveryTerms.map((url: string, index: number) => (
                                    <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                        <QuotationImage imageUrl={url} />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {quotation.payment_terms && (
                    <View className="mb-6">
                        <Text className="text-[10px] font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: colors.text }}>e. Payment Terms (Beyond 20% Advance)</Text>
                        <View className="rounded-3xl p-4 mb-3" style={{ backgroundColor: colors.surface }}>
                            <Text className="text-sm leading-6 font-medium" style={{ color: colors.text }}>
                                {quotation.payment_terms}
                            </Text>
                        </View>
                        {quotation.attachments?.paymentTerms && Array.isArray(quotation.attachments.paymentTerms) && quotation.attachments.paymentTerms.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {quotation.attachments.paymentTerms.map((url: string, index: number) => (
                                    <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
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
                        <Text className="text-[10px] font-bold uppercase tracking-widest mb-4 ml-1" style={{ color: colors.text }}>Reference Documents</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {quotation.attachments.map((url: string, index: number) => (
                                <View key={index} className="mr-3 w-32 h-32 rounded-2xl overflow-hidden" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
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

                <View className="rounded-3xl p-6 mb-6" style={{ backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border }}>
                    <Text className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: colors.text }}>Terms & Conditions</Text>
                    <View className="space-y-2">
                        <View className="flex-row items-center">
                            <CheckCircle2 size={16} color={isDarkMode ? (quotation.vendor_tc_accepted ? '#10B981' : colors.textSecondary) : (quotation.vendor_tc_accepted ? '#10B981' : '#9CA3AF')} />
                            <Text className="text-sm font-medium ml-2" style={{ color: colors.text }}>
                                Vendor T&C: {quotation.vendor_tc_accepted ? 'Accepted' : 'Not Accepted'}
                            </Text>
                        </View>
                        <View className="flex-row items-center">
                            <CheckCircle2 size={16} color={isDarkMode ? (quotation.customer_tc_accepted ? '#10B981' : colors.textSecondary) : (quotation.customer_tc_accepted ? '#10B981' : '#9CA3AF')} />
                            <Text className="text-sm font-medium ml-2" style={{ color: colors.text }}>
                                Customer T&C: {quotation.customer_tc_accepted ? 'Accepted' : 'Not Accepted'}
                            </Text>
                        </View>
                    </View>
                </View>

                {(quotation.status === 'pending' || quotation.status === 'submitted' || quotation.status === 'rejected') && (
                    <View className="flex-row space-x-4 mb-10">
                        <TouchableOpacity
                            className="flex-1 bg-red-50 py-5 rounded-2xl items-center border border-red-100"
                            onPress={handleCancelQuotation}
                        >
                            <Text className="text-red-600 font-extrabold text-base">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 bg-black py-5 rounded-2xl items-center shadow-lg"
                            onPress={() => router.push(`/quotations/create?edit=${quotation.id}`)}
                        >
                            <Text className="text-white font-extrabold text-base">Edit Bid</Text>
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
