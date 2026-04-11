import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, MapPin, User } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { fetchVendorOrderDetail, submitVendorQuotation } from '../../lib/vendor-api';
import VendorOrderInvoiceModal from '../../components/VendorOrderInvoiceModal';
import { AppScreenSkeleton } from '../../components/AppSkeleton';
import { supabase } from '../../lib/supabase';
import { resolveStorageImageUrl } from '../../lib/storageImageUrl';
import { getVendorOrderStatusBadge, getVendorOrderBadgeColors } from '../../lib/orderStatusDisplay';

type ServiceMeta = {
    id: string;
    name?: string;
    description?: string | null;
    category_id?: string | null;
    image_url?: string | null;
    category_name?: string | null;
};

export default function VendorOrderDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors, isDarkMode } = useTheme();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<any>(null);
    const [serviceMetaById, setServiceMetaById] = useState<Record<string, ServiceMeta>>({});
    const [imageUrlByServiceId, setImageUrlByServiceId] = useState<Record<string, string>>({});
    const [quotationModalVisible, setQuotationModalVisible] = useState(false);
    const [submittingQuotation, setSubmittingQuotation] = useState(false);
    const [quotationAmount, setQuotationAmount] = useState('');
    const [quotationVenue, setQuotationVenue] = useState('');
    const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);

    const loadOrderDetail = async () => {
        if (!id) return;
        setLoading(true);
        const { data, error } = await fetchVendorOrderDetail(String(id));
        if (error || !data) {
            setLoading(false);
            return;
        }
        setOrder(data);

        const itemServiceIds = [...new Set((data.items || []).map((i: any) => i.service_id).filter(Boolean))] as string[];
        if (itemServiceIds.length === 0) {
            setLoading(false);
            return;
        }

        const { data: services } = await supabase
            .from('offerable_services')
            .select('id, name, description, category_id, image_url')
            .in('id', itemServiceIds);

        const serviceMap: Record<string, ServiceMeta> = {};
        const categoryIds: string[] = [];
        for (const s of services || []) {
            const row = s as ServiceMeta;
            serviceMap[row.id] = row;
            if (row.category_id) categoryIds.push(row.category_id);
        }

        const uniqCategoryIds = [...new Set(categoryIds)];
        const catMap = new Map<string, string>();
        if (uniqCategoryIds.length > 0) {
            const { data: cats } = await supabase.from('categories').select('id, name').in('id', uniqCategoryIds);
            for (const c of cats || []) {
                catMap.set(String((c as { id: string }).id), String((c as { name: string }).name));
            }
        }
        Object.keys(serviceMap).forEach((sid) => {
            const catId = serviceMap[sid].category_id || '';
            serviceMap[sid].category_name = catMap.get(String(catId)) || catId || null;
        });
        setServiceMetaById(serviceMap);

        const imageMap: Record<string, string> = {};
        await Promise.all(
            Object.values(serviceMap).map(async (s) => {
                const resolved = await resolveStorageImageUrl(s.image_url, 86400);
                if (resolved) imageMap[s.id] = resolved;
            })
        );
        setImageUrlByServiceId(imageMap);
        setLoading(false);
    };

    useEffect(() => {
        loadOrderDetail();
    }, [id]);

    const total = useMemo(
        () =>
            Number(order?.total_order_price || 0) ||
            Number(order?.total_amount || 0) ||
            (order?.items || []).reduce((sum: number, i: any) => sum + (Number(i.quantity || 0) * Number(i.unit_price || 0)), 0),
        [order]
    );
    const hasQuotationSubmitted = useMemo(() => {
        const arr = order?.quotations;
        return Array.isArray(arr) && arr.length > 0;
    }, [order]);

    const orderStatus = String(order?.status || '').toLowerCase();
    const invoiceAccepted = String(order?.vendor_invoice?.status || '').toLowerCase() === 'accepted';
    const showFinalInvoiceCta = orderStatus === 'completed' && !invoiceAccepted;

    const detailStatusBadge = order ? getVendorOrderStatusBadge(order) : { label: '', kind: 'order_status' as const };
    const detailStatusColors = getVendorOrderBadgeColors(detailStatusBadge.kind, order?.status, isDarkMode);

    const handleSubmitQuotation = async () => {
        if (!order?.id) return;
        if (!quotationAmount.trim() || Number(quotationAmount) <= 0) {
            showToast({ variant: 'warning', title: 'Amount required', message: 'Please enter a valid quotation amount.' });
            return;
        }
        if (!quotationVenue.trim()) {
            showToast({ variant: 'warning', title: 'Venue required', message: 'Please enter venue address.' });
            return;
        }
        try {
            setSubmittingQuotation(true);
            const firstItem = (order.items || [])[0];
            const { error } = await submitVendorQuotation({
                order_id: order.id,
                service_type: firstItem?.name || order?.event_name || 'Order Service',
                amount: Number(quotationAmount),
                venue_address: quotationVenue,
                valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                confirmation_date: order?.event_date
                    ? new Date(order.event_date).toISOString()
                    : new Date().toISOString(),
                quotation_submitted_at: new Date().toISOString(),
            });
            if (error) throw new Error(error);
            setQuotationModalVisible(false);
            setQuotationAmount('');
            setQuotationVenue('');
            await loadOrderDetail();
            showToast({ variant: 'success', title: 'Quotation submitted', message: 'Your quotation was sent successfully.' });
        } catch (e: any) {
            showToast({ variant: 'error', title: 'Could not submit', message: e?.message || 'Failed to submit quotation' });
        } finally {
            setSubmittingQuotation(false);
        }
    };

    if (loading) {
        return <AppScreenSkeleton cardCount={3} includeHero={false} />;
    }

    if (!order) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <Text style={{ color: colors.textSecondary }}>Unable to load order details.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4 flex-row items-center border-b" style={{ borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()} className="mr-3">
                    <ArrowLeft size={22} color={colors.text} />
                </TouchableOpacity>
                <View className="flex-1 min-w-0">
                    <Text className="text-xl font-bold" style={{ color: colors.text }}>Order Details</Text>
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>ORD-{String(order.id || '').slice(-8).toUpperCase()}</Text>
                </View>
                <View className="px-3 py-1.5 rounded-full ml-2" style={{ backgroundColor: detailStatusColors.bg }}>
                    <Text className="text-[10px] font-bold uppercase" style={{ color: detailStatusColors.fg }} numberOfLines={1}>
                        {detailStatusBadge.label}
                    </Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
                <View className="rounded-2xl p-4 mb-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <View className="flex-row items-center mb-2">
                        <Calendar size={15} color={colors.textSecondary} />
                        <Text className="text-sm ml-2" style={{ color: colors.text }}>
                            Occasion: {order.occasion_name || order.event_name || '—'}
                        </Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                        <Calendar size={15} color={colors.textSecondary} />
                        <Text className="text-sm ml-2" style={{ color: colors.text }}>
                            Date: {order.event_date ? new Date(order.event_date).toLocaleDateString() : '—'}
                        </Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                        <User size={15} color={colors.textSecondary} />
                        <Text className="text-sm ml-2" style={{ color: colors.text }}>
                            {order.contact_name || 'Customer'} {order.contact_mobile ? `• ${order.contact_mobile}` : ''}
                        </Text>
                    </View>
                    <View className="flex-row items-center">
                        <MapPin size={15} color={colors.textSecondary} />
                        <Text className="text-sm ml-2 flex-1" style={{ color: colors.textSecondary }}>
                            {order.location_preference || order.venue_preference || 'No venue provided'}
                        </Text>
                    </View>
                </View>

                <View className="rounded-2xl p-4 mb-4" style={{ backgroundColor: colors.primary + '14', borderWidth: 1, borderColor: colors.primary + '55' }}>
                    <Text className="text-sm font-bold" style={{ color: colors.text }}>Order Summary</Text>
                    <Text className="text-sm mt-2" style={{ color: colors.text }}>
                        Total: ₹{Number(total).toLocaleString()}
                    </Text>
                    <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                        Advance Paid: ₹{Number(order.advance_paid || order.advance_amount || 0).toLocaleString()}
                    </Text>
                    <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                        Balance: ₹{Number(order.balance_due || total - Number(order.advance_paid || order.advance_amount || 0)).toLocaleString()}
                    </Text>
                </View>

                <Text className="text-sm font-bold mb-3" style={{ color: colors.text }}>Services</Text>
                {(order.items || []).map((it: any, idx: number) => {
                    const meta = serviceMetaById[it.service_id] || {};
                    const img = imageUrlByServiceId[it.service_id];
                    return (
                        <View
                            key={it.id || `${it.service_id}-${idx}`}
                            className="rounded-2xl p-4 mb-3"
                            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                        >
                            <View className="flex-row">
                                <View className="w-20 h-20 rounded-xl overflow-hidden mr-3" style={{ backgroundColor: colors.background }}>
                                    {img ? (
                                        <Image source={{ uri: img }} className="w-full h-full" resizeMode="cover" />
                                    ) : (
                                        <View className="w-full h-full items-center justify-center">
                                            <Text className="text-xs" style={{ color: colors.textSecondary }}>No Image</Text>
                                        </View>
                                    )}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-base font-bold" style={{ color: colors.text }}>
                                        {meta.name || it.name || 'Service'}
                                    </Text>
                                    <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                        Category: {meta.category_name || meta.category_id || '—'}
                                    </Text>
                                    <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                        Qty: {it.quantity} • Unit: ₹{Number(it.unit_price || 0).toLocaleString()}
                                    </Text>
                                    <Text className="text-sm mt-1 font-semibold" style={{ color: colors.text }}>
                                        Line Total: ₹{(Number(it.quantity || 0) * Number(it.unit_price || 0)).toLocaleString()}
                                    </Text>
                                </View>
                            </View>
                            {meta.description ? (
                                <Text className="text-xs mt-2" style={{ color: colors.textSecondary }}>
                                    {meta.description}
                                </Text>
                            ) : null}
                        </View>
                    );
                })}

                {!hasQuotationSubmitted && order?.status !== 'cancelled' ? (
                    <TouchableOpacity
                        onPress={() => {
                            setQuotationAmount('');
                            setQuotationVenue(order?.venue_preference || order?.location_preference || '');
                            setQuotationModalVisible(true);
                        }}
                        className="mt-3 py-4 rounded-2xl items-center"
                        style={{ backgroundColor: colors.primary }}
                    >
                        <Text className="text-white font-bold">Submit Quotation</Text>
                    </TouchableOpacity>
                ) : null}

                {showFinalInvoiceCta ? (
                    <TouchableOpacity
                        onPress={() => setInvoiceModalVisible(true)}
                        className="mt-3 py-4 rounded-2xl items-center border-2"
                        style={{ borderColor: colors.primary, backgroundColor: colors.surface }}
                    >
                        <Text className="font-bold" style={{ color: colors.primary }}>
                            {order?.vendor_invoice ? 'Update final invoice' : 'Create final invoice'}
                        </Text>
                        <Text className="text-xs mt-1 px-4 text-center" style={{ color: colors.textSecondary }}>
                            Itemized bill with GST. Customer must accept it in the app before balance payment uses this total.
                        </Text>
                    </TouchableOpacity>
                ) : null}

                {invoiceAccepted && order?.vendor_invoice ? (
                    <View className="mt-3 p-4 rounded-2xl" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                        <Text className="font-bold" style={{ color: colors.text }}>Final invoice accepted</Text>
                        <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                            Total ₹{Number(order.vendor_invoice.total_amount || 0).toLocaleString('en-IN')}
                        </Text>
                    </View>
                ) : null}
            </ScrollView>

            <VendorOrderInvoiceModal
                visible={invoiceModalVisible}
                onClose={() => setInvoiceModalVisible(false)}
                orderId={String(id || '')}
                colors={colors}
                canEdit={!invoiceAccepted}
                onSubmitted={() => loadOrderDetail()}
            />

            <Modal animationType="slide" visible={quotationModalVisible} onRequestClose={() => setQuotationModalVisible(false)}>
                <SafeAreaView className="flex-1" style={{ backgroundColor: colors.surface }}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                        <View className="px-6 py-4 flex-row items-center justify-between border-b" style={{ borderBottomColor: colors.border }}>
                            <Text className="text-xl font-bold" style={{ color: colors.text }}>Submit Quotation</Text>
                            <TouchableOpacity onPress={() => setQuotationModalVisible(false)}>
                                <ArrowLeft size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
                            <View className="mb-4">
                                <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>
                                    Order ID
                                </Text>
                                <Text className="text-base font-bold mt-1" style={{ color: colors.text }}>
                                    ORD-{String(order?.id || '').slice(-8).toUpperCase()}
                                </Text>
                            </View>
                            <View className="mb-4">
                                <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Amount (₹)</Text>
                                <TextInput
                                    value={quotationAmount}
                                    onChangeText={setQuotationAmount}
                                    keyboardType="number-pad"
                                    placeholder="Enter amount"
                                    placeholderTextColor={colors.textSecondary}
                                    className="rounded-2xl px-4 py-4"
                                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text }}
                                />
                            </View>
                            <View className="mb-6">
                                <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Venue Address</Text>
                                <TextInput
                                    value={quotationVenue}
                                    onChangeText={setQuotationVenue}
                                    placeholder="Enter venue address"
                                    placeholderTextColor={colors.textSecondary}
                                    multiline
                                    numberOfLines={4}
                                    className="rounded-2xl px-4 py-4"
                                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, minHeight: 110, textAlignVertical: 'top' }}
                                />
                            </View>
                            <TouchableOpacity
                                onPress={handleSubmitQuotation}
                                disabled={submittingQuotation}
                                className="py-4 rounded-2xl items-center"
                                style={{ backgroundColor: colors.primary, opacity: submittingQuotation ? 0.6 : 1 }}
                            >
                                {submittingQuotation ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold">Submit Quotation</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}
