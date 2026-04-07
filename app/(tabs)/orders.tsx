import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput, Image, KeyboardAvoidingView, Platform, RefreshControl, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, MapPin, Check, X, MessageSquare, ReceiptText, UploadCloud, Play, Trash2, EyeOff, RotateCcw } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useFocusEffect, useRouter } from 'expo-router';
import { fetchVendorOrders, submitVendorQuotation, requestOrderCompletion, confirmOrderCompletion, requestOrderStart, confirmOrderStart } from '../../lib/vendor-api';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { getVendorOrderStatusBadge, getVendorOrderBadgeColors } from '../../lib/orderStatusDisplay';
import { loadHiddenOrderIds, saveHiddenOrderIds } from '../../lib/hiddenCompletedOrders';

export default function OrdersScreen() {
    const router = useRouter();
    const { colors, isDarkMode } = useTheme();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [vendor, setVendor] = useState<any>(null);
    const [filter, setFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState<'upcoming' | 'today' | '7d' | '30d' | 'all'>('all');
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [quotationModalVisible, setQuotationModalVisible] = useState(false);
    const [quotationOrder, setQuotationOrder] = useState<any>(null);
    const [savingQuotation, setSavingQuotation] = useState(false);
    const [quotationDateVisible, setQuotationDateVisible] = useState(false);
    const [deliveryDateVisible, setDeliveryDateVisible] = useState(false);
    const [validUntilVisible, setValidUntilVisible] = useState(false);
    const [quotationDate, setQuotationDate] = useState(new Date());
    const [deliveryDate, setDeliveryDate] = useState(new Date());
    const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const [quotationStep, setQuotationStep] = useState<1 | 2 | 3>(1);

    const [completionModalVisible, setCompletionModalVisible] = useState(false);
    const [completionOrder, setCompletionOrder] = useState<any>(null);
    const [completionOtp, setCompletionOtp] = useState('');
    const [completionLoading, setCompletionLoading] = useState(false);
    const [completionStep, setCompletionStep] = useState<'request' | 'enter_otp'>('request');

    const [startModalVisible, setStartModalVisible] = useState(false);
    const [startOrder, setStartOrder] = useState<any>(null);
    const [startOtp, setStartOtp] = useState('');
    const [startLoading, setStartLoading] = useState(false);
    const [startStep, setStartStep] = useState<'request' | 'enter_otp'>('request');

    const [quotationForm, setQuotationForm] = useState({
        serviceId: '',
        serviceName: '',
        amount: '',
        venueAddress: '',
        specifications: '',
        quantityRequirements: '',
        qualityStandards: '',
        deliveryTerms: '',
        paymentTerms: '',
        vendorTcAccepted: false,
    });

    const [quotationAttachments, setQuotationAttachments] = useState<{ [key: string]: string[] }>({
        specifications: [],
        quantityRequirements: [],
        qualityStandards: [],
        deliveryTerms: [],
        paymentTerms: [],
    });

    const [hiddenOrderIds, setHiddenOrderIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchVendor();
    }, []);

    useEffect(() => {
        loadHiddenOrderIds().then(setHiddenOrderIds);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchOrders();
        }, [filter])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchOrders(), fetchVendor()]);
        setRefreshing(false);
    };

    const fetchVendor = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('vendors').select('*').eq('id', user.id).maybeSingle();
            setVendor(data);
        }
    };

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const apiFilter = filter === 'all' ? undefined : filter === 'active' ? undefined : filter;
            const { data, error } = await fetchVendorOrders(apiFilter);
            if (error) {
                console.warn('[Orders] Fetch error:', error);
                showToast({ variant: 'error', title: 'Could not load orders', message: error });
                setOrders([]);
            } else {
                let list = data || [];
                if (filter === 'active') {
                    list = list.filter((o: any) =>
                        ['allocated', 'pending', 'confirmed', 'in_progress'].includes(o.status || '')
                    );
                }
                setOrders(list);
                setLastSyncAt(new Date());
            }
        } catch (error: any) {
            console.error('Error fetching orders:', error);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async (field: string) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            const newUris = result.assets.map(asset => asset.uri);
            setQuotationAttachments(prev => ({
                ...prev,
                [field]: [...prev[field], ...newUris],
            }));
        }
    };

    const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };

    const uploadImage = async (uri: string, prefix: string = 'quotation') => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        let fileData: ArrayBuffer;
        if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://')) {
            const base64 = await readAsStringAsync(uri, { encoding: 'base64' as any });
            fileData = base64ToArrayBuffer(base64);
        } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
            const response = await fetch(uri);
            const blob = await response.blob();
            fileData = await blob.arrayBuffer();
        } else {
            throw new Error('Unsupported URI format');
        }

        const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const { error } = await supabase.storage
            .from('ekatraa2025')
            .upload(fileName, fileData, { contentType: 'image/jpeg', upsert: false });

        if (error) throw error;
        return fileName;
    };

    const handleSubmitQuotation = async () => {
        if (!quotationOrder || !quotationForm.amount || !quotationForm.venueAddress) {
            showToast({ variant: 'warning', title: 'Missing info', message: 'Please fill in amount and venue address.' });
            return;
        }

        if (!quotationForm.vendorTcAccepted) {
            showToast({ variant: 'warning', title: 'Terms required', message: 'Please accept the terms and conditions to proceed.' });
            return;
        }

        try {
            setSavingQuotation(true);

            const uploadedAttachments: Record<string, string[]> = {};
            for (const [field, uris] of Object.entries(quotationAttachments)) {
                uploadedAttachments[field] = [];
                for (const uri of uris) {
                    if (uri && (uri.startsWith('file:') || uri.startsWith('content:'))) {
                        try {
                            const fn = await uploadImage(uri, `quotation-${field}`);
                            uploadedAttachments[field].push(fn);
                        } catch {
                            // continue
                        }
                    } else if (uri) {
                        uploadedAttachments[field].push(uri);
                    }
                }
            }

            const { data, error } = await submitVendorQuotation({
                order_id: quotationOrder.id,
                service_type: quotationForm.serviceName || (quotationOrder?.items?.[0]?.name || 'Order Service'),
                amount: parseFloat(quotationForm.amount) || 0,
                venue_address: quotationForm.venueAddress,
                specifications: quotationForm.specifications || undefined,
                quantity_requirements: quotationForm.quantityRequirements || undefined,
                quality_standards: quotationForm.qualityStandards || undefined,
                delivery_terms: quotationForm.deliveryTerms || undefined,
                payment_terms: quotationForm.paymentTerms || undefined,
                attachments: Object.keys(uploadedAttachments).some(k => uploadedAttachments[k].length > 0) ? uploadedAttachments : undefined,
                valid_until: validUntil.toISOString(),
                confirmation_date: deliveryDate.toISOString(),
                quotation_submitted_at: quotationDate.toISOString(),
            });

            if (error) throw new Error(error);

            setQuotationModalVisible(false);
            fetchOrders();
            showToast({
                variant: 'success',
                title: 'Quotation submitted',
                message: 'It will appear in the customer\'s order details.',
            });
        } catch (error: any) {
            showToast({ variant: 'error', title: 'Could not submit', message: error.message || 'Failed to submit quotation' });
        } finally {
            setSavingQuotation(false);
        }
    };

    const generateReceipt = async (order: any) => {
        if (!order || !vendor) {
            showToast({ variant: 'error', title: 'Missing data', message: 'Order or vendor data not available.' });
            return;
        }

        const receiptId = `REC-${order.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
        const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        const itemsList = (order.items || []).map((i: any) => `${i.name || 'Item'} x ${i.quantity}`).join('\n');

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

ORDER DETAILS:
Occasion: ${order.occasion_name || order.event_name || 'N/A'}
Customer: ${order.contact_name || 'Valued Customer'}
Event Date: ${order.event_date ? new Date(order.event_date).toLocaleDateString() : 'N/A'}
Location: ${order.location_preference || order.venue_preference || 'N/A'}

ITEMS:
${itemsList || 'N/A'}

AMOUNT:
Total: ₹${order.total_amount || '0'}

STATUS: ${(order.status || 'PENDING').toUpperCase()}

═══════════════════════════════════════
Thank you for choosing Ekatraa!
═══════════════════════════════════════
        `.trim();

        await Share.share({ message: receiptContent, title: `Receipt_${receiptId}.txt` });
        showToast({ variant: 'success', title: 'Receipt ready', message: 'You can save it from the share menu.' });
    };

    const handleRequestStart = async (order: any) => {
        setStartOrder(order);
        setStartModalVisible(true);
        setStartStep('request');
        setStartOtp('');
        setStartLoading(true);
        const { error } = await requestOrderStart(order.id);
        setStartLoading(false);
        if (error) {
            showToast({ variant: 'error', title: 'Could not request start', message: error });
            setStartModalVisible(false);
        } else {
            setStartStep('enter_otp');
        }
    };

    const handleConfirmStart = async () => {
        if (!startOrder || !startOtp.trim()) {
            showToast({ variant: 'warning', title: 'Enter OTP', message: 'Please enter the OTP received from the customer.' });
            return;
        }
        setStartLoading(true);
        const { error } = await confirmOrderStart(startOrder.id, startOtp.trim());
        setStartLoading(false);
        if (error) {
            showToast({ variant: 'error', title: 'Could not confirm', message: error });
        } else {
            showToast({
                variant: 'success',
                title: 'Work started',
                message: 'You can request completion OTP when the service is done.',
            });
            setStartModalVisible(false);
            setStartOrder(null);
            setStartOtp('');
            fetchOrders();
        }
    };

    const handleRequestCompletion = async (order: any) => {
        setCompletionOrder(order);
        setCompletionModalVisible(true);
        setCompletionStep('request');
        setCompletionOtp('');
        setCompletionLoading(true);
        const { error } = await requestOrderCompletion(order.id);
        setCompletionLoading(false);
        if (error) {
            showToast({ variant: 'error', title: 'Could not request completion', message: error });
            setCompletionModalVisible(false);
        } else {
            setCompletionStep('enter_otp');
        }
    };

    const handleConfirmCompletion = async () => {
        if (!completionOrder || !completionOtp.trim()) {
            showToast({ variant: 'warning', title: 'Enter OTP', message: 'Please enter the OTP received from the customer.' });
            return;
        }
        setCompletionLoading(true);
        const { error } = await confirmOrderCompletion(completionOrder.id, completionOtp.trim());
        setCompletionLoading(false);
        if (error) {
            showToast({ variant: 'error', title: 'Could not complete', message: error });
        } else {
            showToast({ variant: 'success', title: 'Order completed', message: 'Order marked as completed.' });
            setCompletionModalVisible(false);
            setCompletionOrder(null);
            setCompletionOtp('');
            fetchOrders();
        }
    };

    const hasQuotation = (order: any) => {
        if (!order) return false;
        return order.quotations?.length > 0 || order.quotation_submitted;
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setHours(23, 59, 59, 999);
    const daysFromToday = (n: number) => {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() + n);
        d.setHours(23, 59, 59, 999);
        return d;
    };

    const ordersForDateFilter = useMemo(
        () =>
            (orders || [])
                .filter((o: any) => {
                    const raw = o?.event_date;
                    const dt = raw ? new Date(raw) : null;
                    if (!dt || Number.isNaN(dt.getTime())) return dateFilter === 'all';
                    if (dateFilter === 'all') return true;
                    if (dateFilter === 'upcoming') return dt >= startOfToday;
                    if (dateFilter === 'today') return dt >= startOfToday && dt <= endOfToday;
                    if (dateFilter === '7d') return dt >= startOfToday && dt <= daysFromToday(7);
                    if (dateFilter === '30d') return dt >= startOfToday && dt <= daysFromToday(30);
                    return true;
                })
                .sort((a: any, b: any) => {
                    const ad = a?.event_date ? new Date(a.event_date).getTime() : Number.MAX_SAFE_INTEGER;
                    const bd = b?.event_date ? new Date(b.event_date).getTime() : Number.MAX_SAFE_INTEGER;
                    return ad - bd;
                }),
        [orders, dateFilter, startOfToday, endOfToday]
    );

    const filteredOrders = useMemo(
        () => ordersForDateFilter.filter((o: any) => !hiddenOrderIds.has(o.id)),
        [ordersForDateFilter, hiddenOrderIds]
    );

    const hideOrderFromList = useCallback((orderId: string) => {
        setHiddenOrderIds((prev) => {
            const next = new Set(prev);
            next.add(orderId);
            saveHiddenOrderIds(next);
            return next;
        });
        showToast({ variant: 'info', title: 'Removed from list', message: 'You can restore hidden orders anytime.' });
    }, [showToast]);

    const hideAllCompletedFromList = useCallback(() => {
        const completed = (orders || []).filter((o: any) => String(o?.status || '').toLowerCase() === 'completed');
        if (completed.length === 0) {
            showToast({ variant: 'info', title: 'No completed orders', message: 'There are no completed orders to hide.' });
            return;
        }
        setHiddenOrderIds((prev) => {
            const next = new Set(prev);
            completed.forEach((o: any) => next.add(o.id));
            saveHiddenOrderIds(next);
            return next;
        });
        showToast({
            variant: 'success',
            title: 'Completed orders cleared',
            message: `${completed.length} order(s) removed from your list.`,
        });
    }, [orders, showToast]);

    const restoreHiddenOrders = useCallback(() => {
        setHiddenOrderIds(new Set());
        saveHiddenOrderIds(new Set());
        showToast({ variant: 'success', title: 'List restored', message: 'All hidden orders are visible again.' });
    }, [showToast]);

    const formatOrderId = (id: string | undefined) => {
        if (!id) return '';
        return id.length >= 8 ? `ORD-${id.slice(-8).toUpperCase()}` : id;
    };

    const renderOrderCard = ({ item }: { item: any }) => {
        const items = item.items || [];
        const firstItemName = items[0]?.name || 'Service';
        const submitted = hasQuotation(item);
        const statusBadge = getVendorOrderStatusBadge(item);
        const statusColors = getVendorOrderBadgeColors(statusBadge.kind, item.status, isDarkMode);
        const isCompleted = String(item.status || '').toLowerCase() === 'completed';

        return (
            <View
                className="rounded-[32px] p-6 mb-6 shadow-sm"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
                <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-1 mr-4">
                        <Text className="text-[10px] uppercase font-bold tracking-widest" style={{ color: colors.textSecondary }}>{formatOrderId(item.id)} • {firstItemName}</Text>
                        <Text className="text-xl font-bold mt-1" numberOfLines={1} style={{ color: colors.text }}>{item.contact_name || 'Customer'}</Text>
                    </View>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                        {isCompleted ? (
                            <TouchableOpacity
                                onPress={() => hideOrderFromList(item.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                className="p-1 rounded-full"
                                style={{ backgroundColor: colors.background }}
                                accessibilityLabel="Remove completed order from list"
                            >
                                <Trash2 size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        ) : null}
                        <View className="px-3 py-1 rounded-full" style={{ backgroundColor: statusColors.bg }}>
                            <Text className="text-[10px] font-bold uppercase" style={{ color: statusColors.fg }}>
                                {statusBadge.label}
                            </Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => {
                        router.push({ pathname: '/orders/[id]', params: { id: item.id } });
                    }}
                >
                <View className="space-y-3">
                    <View className="flex-row items-center">
                        <Calendar size={16} color={colors.textSecondary} />
                        <Text className="text-sm ml-2 font-medium" style={{ color: colors.text }}>
                            Occasion: {item.occasion_name || item.event_name || '—'}
                        </Text>
                    </View>
                    <View className="flex-row items-center">
                        <Calendar size={16} color={colors.textSecondary} />
                        <Text className="text-sm ml-2 font-medium" style={{ color: colors.text }}>
                            Date: {item.event_date ? new Date(item.event_date).toLocaleDateString() : '—'}
                        </Text>
                    </View>
                    <View className="flex-row items-center mt-2">
                        <MapPin size={16} color={colors.textSecondary} />
                        <Text className="text-sm ml-2" numberOfLines={1} style={{ color: colors.textSecondary }}>{item.contact_mobile || item.contact_email || '—'}</Text>
                    </View>
                    {item.location_preference && (
                        <View className="flex-row items-start mt-2 p-3 rounded-xl" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                            <MessageSquare size={14} color={colors.textSecondary} className="mt-0.5" />
                            <Text className="text-xs ml-2 flex-1" numberOfLines={2} style={{ color: colors.textSecondary }}>{item.location_preference}</Text>
                        </View>
                    )}
                    <View className="mt-2 p-3 rounded-xl" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                        <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                            Total: ₹{Number(item.total_order_price || item.total_amount || 0).toLocaleString()}
                        </Text>
                        <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                            Advance Paid: ₹{Number(item.advance_paid || item.advance_amount || 0).toLocaleString()}
                        </Text>
                    </View>
                </View>

                {!submitted && item.status !== 'cancelled' && (
                    <View className="flex-row mt-6 pt-6" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                        <TouchableOpacity
                            onPress={async () => {
                                setQuotationOrder(item);
                                const firstItem = (item.items || [])[0];
                                setQuotationForm({
                                    serviceId: '',
                                    serviceName: firstItem?.name || '',
                                    amount: '',
                                    venueAddress: item.venue_preference || item.location_preference || '',
                                    specifications: '',
                                    quantityRequirements: '',
                                    qualityStandards: '',
                                    deliveryTerms: '',
                                    paymentTerms: '',
                                    vendorTcAccepted: false,
                                });
                                setQuotationAttachments({
                                    specifications: [],
                                    quantityRequirements: [],
                                    qualityStandards: [],
                                    deliveryTerms: [],
                                    paymentTerms: [],
                                });
                                setQuotationDate(new Date());
                                setDeliveryDate(item.event_date ? new Date(item.event_date) : new Date());
                                setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
                                setQuotationStep(1);
                                setQuotationModalVisible(true);
                            }}
                            className="flex-1 flex-row items-center justify-center py-3 rounded-2xl"
                            style={{ backgroundColor: colors.primary }}
                        >
                            <Check size={18} color="white" />
                            <Text className="text-white font-bold ml-2">Submit Quotation</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {submitted && item.status === 'confirmed' && item.status !== 'cancelled' && (
                    <TouchableOpacity
                        onPress={() => handleRequestStart(item)}
                        className="mt-6 pt-6 flex-row items-center justify-center"
                        style={{ borderTopWidth: 1, borderTopColor: colors.border }}
                    >
                        <Play size={18} color={colors.primary} />
                        <Text className="font-bold ml-2" style={{ color: colors.primary }}>Start work</Text>
                    </TouchableOpacity>
                )}
                {submitted && item.status === 'in_progress' && (
                    <TouchableOpacity
                        onPress={() => handleRequestCompletion(item)}
                        className="mt-6 pt-6 flex-row items-center justify-center"
                        style={{ borderTopWidth: 1, borderTopColor: colors.border }}
                    >
                        <Check size={18} color={colors.primary} />
                        <Text className="font-bold ml-2" style={{ color: colors.primary }}>Mark Complete</Text>
                    </TouchableOpacity>
                )}
                {(submitted || item.status === 'completed') && (
                    <TouchableOpacity
                        onPress={() => generateReceipt(item)}
                        className="mt-4 flex-row items-center justify-center"
                        style={submitted && item.status !== 'completed' ? {} : { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 24 }}
                    >
                        <ReceiptText size={18} color={colors.primary} />
                        <Text className="font-bold ml-2" style={{ color: colors.primary }}>Generate Receipt</Text>
                    </TouchableOpacity>
                )}
                </TouchableOpacity>
            </View>
        );
    };

    if (loading && orders.length === 0) {
        return (
            <SafeAreaView edges={['left', 'right']} className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['left', 'right']} className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4">
                <View className="rounded-3xl p-5" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Text className="text-2xl font-bold" style={{ color: colors.text }}>Orders</Text>
                    <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>Allocated orders, milestones, quotation actions</Text>
                    {lastSyncAt ? (
                        <Text className="text-[11px] mt-2" style={{ color: colors.textSecondary }}>
                            Last sync at {lastSyncAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </Text>
                    ) : null}
                </View>
            </View>

            <View className="px-6 mb-6 flex-row gap-3">
                {(['all', 'active', 'completed'] as const).map((f) => (
                    <TouchableOpacity
                        key={f}
                        onPress={() => setFilter(f)}
                        className="flex-1 py-3 rounded-2xl border items-center justify-center"
                        style={{
                            backgroundColor: filter === f ? colors.text : colors.surface,
                            borderColor: filter === f ? colors.text : colors.border,
                        }}
                    >
                        <Text className="font-bold text-sm capitalize" style={{ color: filter === f ? colors.background : colors.text }}>{f}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View className="px-6 mb-2">
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={[
                        { id: 'all', label: 'All Dates' },
                        { id: 'upcoming', label: 'Upcoming' },
                        { id: 'today', label: 'Today' },
                        { id: '7d', label: 'Next 7 Days' },
                        { id: '30d', label: 'Next 30 Days' },
                    ]}
                    keyExtractor={(i) => i.id}
                    renderItem={({ item }) => {
                        const active = dateFilter === (item.id as typeof dateFilter);
                        return (
                            <TouchableOpacity
                                onPress={() => setDateFilter(item.id as typeof dateFilter)}
                                className="px-4 py-2 rounded-full mr-2"
                                style={{
                                    backgroundColor: active ? colors.primary + '22' : colors.surface,
                                    borderWidth: 1,
                                    borderColor: active ? colors.primary : colors.border,
                                }}
                            >
                                <Text style={{ color: active ? colors.primary : colors.text, fontWeight: '700', fontSize: 12 }}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            <View className="px-6 mb-3 flex-row flex-wrap" style={{ gap: 10 }}>
                <TouchableOpacity
                    onPress={hideAllCompletedFromList}
                    className="flex-row items-center px-3 py-2 rounded-full border"
                    style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                >
                    <EyeOff size={16} color={colors.textSecondary} />
                    <Text className="text-xs font-bold ml-2" style={{ color: colors.text }}>
                        Hide all completed
                    </Text>
                </TouchableOpacity>
                {hiddenOrderIds.size > 0 ? (
                    <TouchableOpacity
                        onPress={restoreHiddenOrders}
                        className="flex-row items-center px-3 py-2 rounded-full border"
                        style={{ borderColor: colors.primary + '66', backgroundColor: colors.primary + '14' }}
                    >
                        <RotateCcw size={16} color={colors.primary} />
                        <Text className="text-xs font-bold ml-2" style={{ color: colors.primary }}>
                            Restore hidden ({hiddenOrderIds.size})
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {loading && orders.length > 0 ? (
                <View className="px-6 pb-2">
                    <View className="rounded-xl px-3 py-2 flex-row items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text className="text-xs ml-2" style={{ color: colors.textSecondary }}>Refreshing orders...</Text>
                    </View>
                </View>
            ) : null}

            <FlatList
                data={filteredOrders}
                renderItem={renderOrderCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={7}
                removeClippedSubviews
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
                }
                ListEmptyComponent={() => {
                    if (orders.length === 0) {
                        return (
                            <View className="flex-1 items-center justify-center py-20">
                                <Text className="font-medium" style={{ color: colors.textSecondary }}>No {filter === 'active' ? 'active' : filter} orders</Text>
                                <Text className="text-xs mt-2 text-center px-8" style={{ color: colors.textSecondary }}>Orders will appear here when admin allocates them to you</Text>
                            </View>
                        );
                    }
                    if (ordersForDateFilter.length === 0) {
                        return (
                            <View className="flex-1 items-center justify-center py-20 px-6">
                                <Text className="font-medium text-center" style={{ color: colors.textSecondary }}>No orders match this date range</Text>
                                <Text className="text-xs mt-2 text-center" style={{ color: colors.textSecondary }}>Try &quot;All Dates&quot; or another filter.</Text>
                            </View>
                        );
                    }
                    if (hiddenOrderIds.size > 0) {
                        return (
                            <View className="flex-1 items-center justify-center py-20 px-6">
                                <Text className="font-medium text-center" style={{ color: colors.textSecondary }}>All matching orders are hidden</Text>
                                <Text className="text-xs mt-2 text-center" style={{ color: colors.textSecondary }}>You removed completed orders from the list. Restore to show them again.</Text>
                                <TouchableOpacity
                                    onPress={restoreHiddenOrders}
                                    className="mt-4 px-4 py-3 rounded-2xl flex-row items-center"
                                    style={{ backgroundColor: colors.primary }}
                                >
                                    <RotateCcw size={18} color={colors.background} />
                                    <Text className="font-bold ml-2" style={{ color: colors.background }}>Restore hidden orders</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    }
                    return (
                        <View className="flex-1 items-center justify-center py-20">
                            <Text className="font-medium" style={{ color: colors.textSecondary }}>No {filter === 'active' ? 'active' : filter} orders</Text>
                            <Text className="text-xs mt-2 text-center px-8" style={{ color: colors.textSecondary }}>Orders will appear here when admin allocates them to you</Text>
                        </View>
                    );
                }}
            />

            <Modal animationType="slide" transparent visible={detailModalVisible} onRequestClose={() => setDetailModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/50">
                    <View className="rounded-t-[40px] p-8 pb-12" style={{ backgroundColor: colors.surface }}>
                        <View className="flex-row justify-between items-center mb-8">
                            <View>
                                <Text className="text-2xl font-bold" style={{ color: colors.text }}>Order Details</Text>
                                {selectedOrder?.id && (
                                    <Text className="text-xs font-semibold mt-1" style={{ color: colors.textSecondary }}>{formatOrderId(selectedOrder.id)}</Text>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <View className="space-y-6">
                            <View>
                                <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Customer</Text>
                                <Text className="font-semibold text-lg" style={{ color: colors.text }}>{selectedOrder?.contact_name}</Text>
                                <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>{selectedOrder?.contact_mobile} • {selectedOrder?.contact_email}</Text>
                            </View>
                            <View>
                                <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Occasion</Text>
                                <Text className="font-semibold" style={{ color: colors.text }}>{selectedOrder?.occasion_name || selectedOrder?.event_name || '—'}</Text>
                                <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>{selectedOrder?.event_date ? new Date(selectedOrder.event_date).toLocaleDateString() : '—'}</Text>
                            </View>
                            <View>
                                <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Payment</Text>
                                <Text className="text-sm" style={{ color: colors.text }}>
                                    Total: ₹{Number(selectedOrder?.total_order_price || selectedOrder?.total_amount || 0).toLocaleString()}
                                </Text>
                                <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                                    Advance Paid: ₹{Number(selectedOrder?.advance_paid || selectedOrder?.advance_amount || 0).toLocaleString()}
                                </Text>
                            </View>
                            {(selectedOrder?.work_started_at || selectedOrder?.work_completed_at) ? (
                                <View>
                                    <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Service milestones</Text>
                                    {selectedOrder?.work_started_at ? (
                                        <Text className="text-sm" style={{ color: colors.text }}>
                                            Work started: {new Date(selectedOrder.work_started_at).toLocaleString()}
                                        </Text>
                                    ) : null}
                                    {selectedOrder?.work_completed_at ? (
                                        <Text className="text-sm mt-1" style={{ color: colors.text }}>
                                            Work completed: {new Date(selectedOrder.work_completed_at).toLocaleString()}
                                        </Text>
                                    ) : null}
                                </View>
                            ) : null}
                            {(selectedOrder?.items || []).length > 0 && (
                                <View>
                                    <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Items</Text>
                                    {(selectedOrder.items || []).map((i: any, idx: number) => (
                                        <Text key={idx} className="text-sm" style={{ color: colors.text }}>{i.name} × {i.quantity} — ₹{(Number(i.unit_price) * Number(i.quantity)).toLocaleString()}</Text>
                                    ))}
                                </View>
                            )}
                        </View>
                        {hasQuotation(selectedOrder) && selectedOrder?.status === 'confirmed' && selectedOrder?.status !== 'cancelled' && (
                            <TouchableOpacity
                                onPress={() => { setDetailModalVisible(false); handleRequestStart(selectedOrder); }}
                                className="mt-6 py-4 rounded-2xl items-center"
                                style={{ backgroundColor: colors.primary }}
                            >
                                <Play size={20} color="white" />
                                <Text className="text-white font-bold mt-1">Start work</Text>
                                <Text className="text-white/80 text-xs mt-1">Customer will see the OTP in ekatraa</Text>
                            </TouchableOpacity>
                        )}
                        {hasQuotation(selectedOrder) && selectedOrder?.status === 'in_progress' && selectedOrder?.status !== 'cancelled' && (
                            <TouchableOpacity
                                onPress={() => { setDetailModalVisible(false); handleRequestCompletion(selectedOrder); }}
                                className="mt-6 py-4 rounded-2xl items-center"
                                style={{ backgroundColor: colors.primary }}
                            >
                                <Check size={20} color="white" />
                                <Text className="text-white font-bold mt-1">Mark Complete</Text>
                                <Text className="text-white/80 text-xs mt-1">OTP will be sent to customer</Text>
                            </TouchableOpacity>
                        )}
                        {!hasQuotation(selectedOrder) && selectedOrder?.status !== 'cancelled' && (
                            <TouchableOpacity
                                onPress={async () => {
                                    setDetailModalVisible(false);
                                    setQuotationOrder(selectedOrder);
                                    const firstItem = (selectedOrder?.items || [])[0];
                                    setQuotationForm({
                                        serviceId: '',
                                        serviceName: firstItem?.name || '',
                                        amount: '',
                                        venueAddress: selectedOrder?.venue_preference || selectedOrder?.location_preference || '',
                                        specifications: '',
                                        quantityRequirements: '',
                                        qualityStandards: '',
                                        deliveryTerms: '',
                                        paymentTerms: '',
                                        vendorTcAccepted: false,
                                    });
                                    setQuotationAttachments({
                                        specifications: [],
                                        quantityRequirements: [],
                                        qualityStandards: [],
                                        deliveryTerms: [],
                                        paymentTerms: [],
                                    });
                                    setQuotationDate(new Date());
                                    setDeliveryDate(selectedOrder?.event_date ? new Date(selectedOrder.event_date) : new Date());
                                    setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
                                    setQuotationStep(1);
                                    setQuotationModalVisible(true);
                                }}
                                className="mt-10 bg-primary py-5 rounded-2xl items-center"
                            >
                                <Text className="text-white font-bold">Submit Quotation</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Quotation Form Modal */}
            <Modal animationType="slide" visible={quotationModalVisible} onRequestClose={() => setQuotationModalVisible(false)}>
                <SafeAreaView className="flex-1" style={{ backgroundColor: colors.surface }}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                        <View className="px-6 py-4 flex-row items-center justify-between border-b" style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
                            <View>
                                <Text className="text-2xl font-bold" style={{ color: colors.text }}>Submit Quotation</Text>
                                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                    Step {quotationStep} of 3
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setQuotationModalVisible(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View className="px-6 py-3 flex-row gap-2">
                            {[1, 2, 3].map((s) => (
                                <View key={s} className="flex-1 h-2 rounded-full" style={{ backgroundColor: quotationStep >= s ? colors.primary : colors.border }} />
                            ))}
                        </View>

                        <FlatList
                            data={[1]}
                            keyExtractor={() => 'quotation-step-form'}
                            contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
                            renderItem={() => (
                                <>
                                    {quotationStep === 1 ? (
                                        <>
                                            <View className="mb-5 p-4 rounded-2xl" style={{ backgroundColor: colors.primary + '12', borderWidth: 1, borderColor: colors.primary + '40' }}>
                                                <Text className="text-sm font-bold" style={{ color: colors.text }}>Order Snapshot</Text>
                                                <Text className="text-xs mt-2" style={{ color: colors.textSecondary }}>
                                                    Service: {quotationForm.serviceName || quotationOrder?.items?.[0]?.name || 'Order Service'}
                                                </Text>
                                                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                                    Occasion: {quotationOrder?.occasion_name || quotationOrder?.event_name || '—'}
                                                </Text>
                                                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                                    Date: {quotationOrder?.event_date ? new Date(quotationOrder.event_date).toLocaleDateString() : '—'}
                                                </Text>
                                                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                                    Total: ₹{Number(quotationOrder?.total_order_price || quotationOrder?.total_amount || 0).toLocaleString()}
                                                </Text>
                                            </View>

                                            <View className="mb-5">
                                                <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Amount (₹) *</Text>
                                                <View className="flex-row items-center rounded-2xl px-5 py-4" style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.primary + '55' }}>
                                                    <Text className="font-extrabold text-xl mr-3" style={{ color: colors.text }}>₹</Text>
                                                    <TextInput
                                                        placeholder="Enter amount"
                                                        placeholderTextColor={colors.textSecondary}
                                                        keyboardType="number-pad"
                                                        value={quotationForm.amount}
                                                        onChangeText={(t) => setQuotationForm((prev) => ({ ...prev, amount: t }))}
                                                        className="flex-1 font-extrabold text-xl"
                                                        style={{ color: colors.text }}
                                                    />
                                                </View>
                                            </View>

                                            <View className="mb-5">
                                                <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Venue Address *</Text>
                                                <TextInput
                                                    placeholder="Enter venue address"
                                                    placeholderTextColor={colors.textSecondary}
                                                    value={quotationForm.venueAddress}
                                                    onChangeText={(t) => setQuotationForm((prev) => ({ ...prev, venueAddress: t }))}
                                                    multiline
                                                    numberOfLines={3}
                                                    className="rounded-2xl px-5 py-4 font-medium"
                                                    style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border, color: colors.text, textAlignVertical: 'top', minHeight: 80 }}
                                                />
                                            </View>

                                            {[
                                                { label: 'Quotation Submission Date', value: quotationDate.toLocaleString(), onPress: () => setQuotationDateVisible(true) },
                                                { label: 'Confirmation Date', value: deliveryDate.toLocaleString(), onPress: () => setDeliveryDateVisible(true) },
                                                { label: 'Valid Until', value: validUntil.toLocaleString(), onPress: () => setValidUntilVisible(true) },
                                            ].map((r) => (
                                                <View key={r.label} className="mb-5">
                                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>{r.label}</Text>
                                                    <TouchableOpacity onPress={r.onPress} className="rounded-2xl px-5 py-4" style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border }}>
                                                        <Text style={{ color: colors.text }}>{r.value}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </>
                                    ) : null}

                                    {quotationStep === 2 ? (
                                        <>
                                            {(['specifications', 'quantityRequirements', 'qualityStandards'] as const).map((field) => (
                                                <View key={field} className="mb-6">
                                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>
                                                        {field.replace(/([A-Z])/g, ' $1').trim().replace(/^./, (s) => s.toUpperCase())}
                                                    </Text>
                                                    <TextInput
                                                        placeholder="Add details..."
                                                        placeholderTextColor={colors.textSecondary}
                                                        value={quotationForm[field]}
                                                        onChangeText={(t) => setQuotationForm((prev) => ({ ...prev, [field]: t }))}
                                                        multiline
                                                        numberOfLines={3}
                                                        className="rounded-2xl px-5 py-4 font-medium"
                                                        style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border, color: colors.text, textAlignVertical: 'top', minHeight: 90 }}
                                                    />
                                                    <View className="flex-row flex-wrap mt-2 items-center">
                                                        <TouchableOpacity
                                                            onPress={() => pickImage(field)}
                                                            className="flex-row items-center py-2 px-4 rounded-xl mr-2 mb-2"
                                                            style={{ backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary }}
                                                        >
                                                            <UploadCloud size={16} color={colors.primary} />
                                                            <Text className="font-semibold ml-2 text-sm" style={{ color: colors.primary }}>Add Images</Text>
                                                        </TouchableOpacity>
                                                        {(quotationAttachments[field] || []).map((uri, idx) => (
                                                            <View key={idx} className="relative mr-2 mb-2">
                                                                <Image source={{ uri }} style={{ width: 56, height: 56, borderRadius: 8 }} resizeMode="cover" />
                                                                <TouchableOpacity
                                                                    onPress={() => setQuotationAttachments((prev) => ({
                                                                        ...prev,
                                                                        [field]: prev[field].filter((_, i) => i !== idx),
                                                                    }))}
                                                                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full items-center justify-center"
                                                                    style={{ backgroundColor: '#c0392b' }}
                                                                >
                                                                    <X size={12} color="white" />
                                                                </TouchableOpacity>
                                                            </View>
                                                        ))}
                                                    </View>
                                                </View>
                                            ))}
                                        </>
                                    ) : null}

                                    {quotationStep === 3 ? (
                                        <>
                                            {(['deliveryTerms', 'paymentTerms'] as const).map((field) => (
                                                <View key={field} className="mb-6">
                                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>
                                                        {field === 'deliveryTerms' ? 'Delivery Terms' : 'Payment Terms'}
                                                    </Text>
                                                    <TextInput
                                                        placeholder="Add details..."
                                                        placeholderTextColor={colors.textSecondary}
                                                        value={quotationForm[field]}
                                                        onChangeText={(t) => setQuotationForm((prev) => ({ ...prev, [field]: t }))}
                                                        multiline
                                                        numberOfLines={3}
                                                        className="rounded-2xl px-5 py-4 font-medium"
                                                        style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border, color: colors.text, textAlignVertical: 'top', minHeight: 90 }}
                                                    />
                                                    <View className="flex-row flex-wrap mt-2 items-center">
                                                        <TouchableOpacity
                                                            onPress={() => pickImage(field)}
                                                            className="flex-row items-center py-2 px-4 rounded-xl mr-2 mb-2"
                                                            style={{ backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary }}
                                                        >
                                                            <UploadCloud size={16} color={colors.primary} />
                                                            <Text className="font-semibold ml-2 text-sm" style={{ color: colors.primary }}>Add Images</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ))}

                                            <View className="mb-6 p-4 rounded-2xl" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                                <TouchableOpacity onPress={() => setQuotationForm((prev) => ({ ...prev, vendorTcAccepted: !prev.vendorTcAccepted }))} className="flex-row items-center">
                                                    <View className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center ${quotationForm.vendorTcAccepted ? 'bg-primary border-primary' : ''}`} style={{ borderColor: quotationForm.vendorTcAccepted ? colors.primary : colors.border }}>
                                                        {quotationForm.vendorTcAccepted && <Check size={16} color="white" />}
                                                    </View>
                                                    <Text className="text-sm font-bold flex-1" style={{ color: colors.text }}>
                                                        I accept the Terms and Conditions
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </>
                                    ) : null}
                                </>
                            )}
                        />

                        <View className="px-6 py-4 border-t flex-row items-center" style={{ borderTopColor: colors.border }}>
                            {quotationStep > 1 ? (
                                <TouchableOpacity
                                    onPress={() => setQuotationStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))}
                                    className="px-5 py-3 rounded-xl mr-3"
                                    style={{ backgroundColor: colors.background }}
                                >
                                    <Text className="font-bold" style={{ color: colors.text }}>Back</Text>
                                </TouchableOpacity>
                            ) : null}
                            {quotationStep < 3 ? (
                                <TouchableOpacity
                                    onPress={() => setQuotationStep((s) => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)))}
                                    className="flex-1 py-4 rounded-2xl items-center"
                                    style={{ backgroundColor: colors.primary }}
                                >
                                    <Text className="text-white font-bold">Next</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={handleSubmitQuotation}
                                    disabled={savingQuotation}
                                    className="flex-1 py-4 rounded-2xl items-center"
                                    style={{ backgroundColor: colors.primary, opacity: savingQuotation ? 0.6 : 1 }}
                                >
                                    {savingQuotation ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Submit Quotation</Text>}
                                </TouchableOpacity>
                            )}
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            {/* Start work OTP Modal */}
            <Modal animationType="slide" transparent visible={startModalVisible} onRequestClose={() => { setStartModalVisible(false); setStartOtp(''); }}>
                <View className="flex-1 justify-end bg-black/50">
                    <View className="rounded-t-[40px] p-8 pb-12" style={{ backgroundColor: colors.surface }}>
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold" style={{ color: colors.text }}>Start work</Text>
                            <TouchableOpacity onPress={() => { setStartModalVisible(false); setStartOtp(''); }}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {startStep === 'request' && startLoading && (
                            <View className="py-8 items-center">
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text className="mt-4" style={{ color: colors.textSecondary }}>Sending OTP to customer...</Text>
                            </View>
                        )}
                        {startStep === 'enter_otp' && (
                            <>
                                <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                                    The customer will see the OTP in the ekatraa app. Ask them for it and enter below to start work.
                                </Text>
                                <TextInput
                                    placeholder="Enter 6-digit OTP"
                                    placeholderTextColor={colors.textSecondary}
                                    value={startOtp}
                                    onChangeText={setStartOtp}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    className="rounded-2xl px-5 py-4 text-center text-xl font-bold"
                                    style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border, color: colors.text }}
                                />
                                <TouchableOpacity
                                    onPress={handleConfirmStart}
                                    disabled={startLoading || startOtp.length !== 6}
                                    className={`mt-6 py-4 rounded-2xl items-center ${startLoading || startOtp.length !== 6 ? 'opacity-50' : ''}`}
                                    style={{ backgroundColor: colors.primary }}
                                >
                                    {startLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Confirm and start</Text>}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Mark Complete OTP Modal */}
            <Modal animationType="slide" transparent visible={completionModalVisible} onRequestClose={() => setCompletionModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/50">
                    <View className="rounded-t-[40px] p-8 pb-12" style={{ backgroundColor: colors.surface }}>
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold" style={{ color: colors.text }}>Mark Order Complete</Text>
                            <TouchableOpacity onPress={() => { setCompletionModalVisible(false); setCompletionOtp(''); }}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {completionStep === 'request' && completionLoading && (
                            <View className="py-8 items-center">
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text className="mt-4" style={{ color: colors.textSecondary }}>Sending OTP to customer...</Text>
                            </View>
                        )}
                        {completionStep === 'enter_otp' && (
                            <>
                                <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                                    The customer will see the OTP in the ekatraa app. Ask them for it and enter below.
                                </Text>
                                <TextInput
                                    placeholder="Enter 6-digit OTP"
                                    placeholderTextColor={colors.textSecondary}
                                    value={completionOtp}
                                    onChangeText={setCompletionOtp}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    className="rounded-2xl px-5 py-4 text-center text-xl font-bold"
                                    style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border, color: colors.text }}
                                />
                                <TouchableOpacity
                                    onPress={handleConfirmCompletion}
                                    disabled={completionLoading || completionOtp.length !== 6}
                                    className={`mt-6 py-4 rounded-2xl items-center ${completionLoading || completionOtp.length !== 6 ? 'opacity-50' : ''}`}
                                    style={{ backgroundColor: colors.primary }}
                                >
                                    {completionLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Confirm & Complete</Text>}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            <DateTimePickerModal isVisible={quotationDateVisible} mode="datetime" onConfirm={(d) => { setQuotationDate(d); setQuotationDateVisible(false); }} onCancel={() => setQuotationDateVisible(false)} date={quotationDate} />
            <DateTimePickerModal isVisible={deliveryDateVisible} mode="datetime" onConfirm={(d) => { setDeliveryDate(d); setDeliveryDateVisible(false); }} onCancel={() => setDeliveryDateVisible(false)} date={deliveryDate} />
            <DateTimePickerModal isVisible={validUntilVisible} mode="datetime" onConfirm={(d) => { setValidUntil(d); setValidUntilVisible(false); }} onCancel={() => setValidUntilVisible(false)} date={validUntil} />
        </SafeAreaView>
    );
}
