import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput, Alert, Image, KeyboardAvoidingView, Platform, RefreshControl, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, MapPin, Check, X, ChevronRight, Edit3, MessageSquare, ReceiptText, UploadCloud } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { formatReceiptData } from '../../lib/receipt';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

export default function BookingsScreen() {
    const { t } = useTranslation();
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [bookings, setBookings] = useState<any[]>([]);
    const [vendor, setVendor] = useState<any>(null);
    const [filter, setFilter] = useState('all');
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingBooking, setEditingBooking] = useState<any>(null);
    const [updating, setUpdating] = useState(false);
    const [quotationModalVisible, setQuotationModalVisible] = useState(false);
    const [quotationBooking, setQuotationBooking] = useState<any>(null);
    const [savingQuotation, setSavingQuotation] = useState(false);
    const [quotationDateVisible, setQuotationDateVisible] = useState(false);
    const [deliveryDateVisible, setDeliveryDateVisible] = useState(false);
    const [validUntilVisible, setValidUntilVisible] = useState(false);
    const [quotationDate, setQuotationDate] = useState(new Date());
    const [deliveryDate, setDeliveryDate] = useState(new Date());
    const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days from now

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

    const [services, setServices] = useState<any[]>([]);
    const [fetchingServices, setFetchingServices] = useState(false);

    useEffect(() => {
        fetchBookings();
        fetchVendor();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchBookings(), fetchVendor()]);
        setRefreshing(false);
    };

    const fetchServices = async () => {
        try {
            setFetchingServices(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('services')
                .select('*')
                .eq('vendor_id', user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setServices(data || []);
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setFetchingServices(false);
        }
    };

    const fetchVendor = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('vendors').select('*').eq('id', user.id).maybeSingle();
            setVendor(data);
        }
    };

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

    const generateReceipt = async (booking: any) => {
        if (!booking || !vendor) {
            Alert.alert('Error', 'Booking or vendor data not available.');
            return;
        }

        try {
            const receiptId = `REC-${booking.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
            const date = new Date().toLocaleDateString('en-IN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

            // Get customer name from booking
            const customerName = booking.customers?.full_name || booking.customer_name || 'Valued Customer';
            const serviceName = booking.services?.name || booking.service_name || 'Service';

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

BOOKING DETAILS:
Service: ${serviceName}
Customer: ${customerName}
Booking Date: ${booking.booking_date ? new Date(booking.booking_date).toLocaleDateString() : 'N/A'}
Event Date: ${booking.event_date ? new Date(booking.event_date).toLocaleDateString() : 'N/A'}
Location: ${booking.location || 'N/A'}

AMOUNT:
Total Amount: ₹${booking.total_price || booking.amount || '0'}

STATUS: ${booking.status?.toUpperCase() || 'PENDING'}

═══════════════════════════════════════
Thank you for choosing Ekatraa!
═══════════════════════════════════════
            `.trim();

            // Share receipt as text (works on all platforms)
            await Share.share({
                message: receiptContent,
                title: `Receipt_${receiptId}.txt`,
            });
            
            Alert.alert('Success', 'Receipt generated! You can save it from the share menu.');
        } catch (error: any) {
            console.error('Error generating receipt:', error);
            Alert.alert('Error', error.message || 'Failed to generate receipt.');
        }
    };

    const pickImage = async (field: string) => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            const newUris = result.assets.map(asset => asset.uri);
            setQuotationAttachments({
                ...quotationAttachments,
                [field]: [...quotationAttachments[field], ...newUris]
            });
        }
    };

    // Helper function to get signed URL from file path or existing URL
    const getImageUrl = async (urlOrPath: string | null | undefined): Promise<string> => {
        if (!urlOrPath) return '';

        try {
            let fileName = urlOrPath;

            // If it's already a full URL, extract the filename
            if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
                // Extract filename from Supabase storage URL
                // Format: https://...supabase.co/storage/v1/object/public/ekatraa2025/filename.jpg
                const urlMatch = urlOrPath.match(/\/ekatraa2025\/([^/?]+)/);
                if (urlMatch && urlMatch[1]) {
                    fileName = urlMatch[1];
                } else {
                    // If it's already a signed URL with token, return as-is
                    if (urlOrPath.includes('token=')) {
                        return urlOrPath;
                    }
                    // Otherwise try to extract filename from end of URL
                    fileName = urlOrPath.split('/').pop()?.split('?')[0] || urlOrPath;
                }
            } else if (urlOrPath.includes('/')) {
                // Extract filename from path
                fileName = urlOrPath.split('/').pop() || urlOrPath;
            }

            // Generate signed URL (valid for 24 hours for better caching)
            try {
                const { data, error } = await supabase.storage
                    .from('ekatraa2025')
                    .createSignedUrl(fileName, 86400); // 24 hours expiry for faster loading

                if (error) {
                    console.error('[SIGNED URL ERROR]', error, 'fileName:', fileName);
                    // Fallback to public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('ekatraa2025')
                        .getPublicUrl(fileName);
                    return publicUrl;
                }

                if (data && data.signedUrl) {
                    return data.signedUrl;
                }

                // Final fallback if signedUrl is somehow missing
                const { data: { publicUrl } } = supabase.storage
                    .from('ekatraa2025')
                    .getPublicUrl(fileName);
                return publicUrl;
            } catch (storageError: any) {
                console.error('[STORAGE API ERROR]', storageError);
                // Fallback to public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('ekatraa2025')
                    .getPublicUrl(fileName);
                return publicUrl;
            }
        } catch (error) {
            console.error('[GET IMAGE URL ERROR]', error);
            return urlOrPath as string; // Return original if all fails
        }
    };

    // Helper to convert base64 to ArrayBuffer
    const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };

    const uploadImage = async (uri: string, prefix: string = 'quotation') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            console.log('[DEBUG] Uploading:', fileName, 'URI:', uri);

            let fileData: ArrayBuffer;

            // Handle local file URIs (file:// or content://)
            if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://')) {
                // Read file as base64 using expo-file-system legacy API
                const base64 = await readAsStringAsync(uri, {
                    encoding: 'base64' as any,
                });
                // Convert base64 to ArrayBuffer
                fileData = base64ToArrayBuffer(base64);
            } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
                // For remote URLs, fetch and convert to ArrayBuffer
                const response = await fetch(uri);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                fileData = arrayBuffer;
            } else {
                throw new Error('Unsupported URI format');
            }

            const { data, error } = await supabase.storage
                .from('ekatraa2025')
                .upload(fileName, fileData, {
                    contentType: 'image/jpeg',
                    upsert: false
                });

            if (error) {
                console.error('[UPLOAD ERROR]', error);
                throw error;
            }

            console.log('[DEBUG] Upload successful:', fileName);
            // Return just the filename - we'll generate signed URLs when displaying
            return fileName;
        } catch (error: any) {
            console.error('[UPLOAD ERROR]', error);
            throw error;
        }
    };

    const handleSubmitQuotation = async () => {
        if (!quotationForm.serviceName || !quotationForm.amount || !quotationForm.venueAddress) {
            Alert.alert('Missing Info', 'Please select a service, fill in Amount and Venue Address');
            return;
        }

        if (!quotationForm.vendorTcAccepted) {
            Alert.alert('Terms Required', 'Please accept the terms and conditions to proceed');
            return;
        }

        try {
            setSavingQuotation(true);

            // Ensure user is authenticated and get session
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw new Error(`Authentication error: ${userError.message}`);
            if (!user || !user.id) throw new Error('No authenticated user found. Please log in again.');

            // Verify session is active
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session expired. Please log in again.');

            // Upload all images
            const uploadedAttachments: { [key: string]: string[] } = {};
            for (const [field, uris] of Object.entries(quotationAttachments)) {
                uploadedAttachments[field] = [];
                for (const uri of uris) {
                    if (uri && (uri.startsWith('file:') || uri.startsWith('content:'))) {
                        try {
                            const uploadedFileName = await uploadImage(uri, `quotation-${field}`);
                            uploadedAttachments[field].push(uploadedFileName);
                        } catch (uploadError: any) {
                            console.error(`[UPLOAD ERROR] ${field}:`, uploadError);
                            // Continue with other uploads even if one fails
                        }
                    } else if (uri) {
                        // If it's already a URL or filename, keep it
                        uploadedAttachments[field].push(uri);
                    }
                }
            }

            // Save quotation to database
            const finalServiceName = quotationForm.serviceName || quotationBooking.services?.name || 'Service';

            // Build insert object with only fields that exist in the table
            const amount = parseFloat(quotationForm.amount) || 0;
            const quotationData: any = {
                vendor_id: user.id, // Must match auth.uid() for RLS
                booking_id: quotationBooking.id,
                customer_name: quotationBooking.customer_name || null,
                quotation_date: quotationDate.toISOString(),
                delivery_date: deliveryDate.toISOString(),
                venue_address: quotationForm.venueAddress || null,
                service_type: finalServiceName,
                amount: amount,
                // Note: total_amount column doesn't exist in schema - removed to prevent error
                // If needed, add total_amount column to quotations table via migration
                specifications: quotationForm.specifications || null,
                quantity_requirements: quotationForm.quantityRequirements || null,
                quality_standards: quotationForm.qualityStandards || null,
                delivery_terms: quotationForm.deliveryTerms || null,
                payment_terms: quotationForm.paymentTerms || null,
                attachments: uploadedAttachments || {},
                vendor_tc_accepted: quotationForm.vendorTcAccepted || false,
                customer_tc_accepted: false,
                status: 'pending' // Changed from 'submitted' to 'pending' to match expected status
            };

            console.log('[DEBUG] Inserting quotation with vendor_id:', user.id);
            const { data: quotation, error: quotationError } = await supabase
                .from('quotations')
                .insert(quotationData)
                .select()
                .single();

            if (quotationError) {
                console.error('[QUOTATION INSERT ERROR]', quotationError);
                if (quotationError.message?.includes('row level security') || quotationError.message?.includes('RLS')) {
                    throw new Error('Permission denied. Please ensure you are logged in and have permission to create quotations.');
                }
                throw quotationError;
            }

            // Update booking status to confirmed
            const { error: bookingError } = await supabase
                .from('bookings')
                .update({ status: 'confirmed' })
                .eq('id', quotationBooking.id);

            if (bookingError) throw bookingError;

            // Update vendor expected revenue after quotation creation
            // Exclude rejected quotations from expected revenue
            try {
                const { data: allQuotations } = await supabase
                    .from('quotations')
                    .select('amount, status')
                    .eq('vendor_id', user.id);

                const expectedRevenue = (allQuotations || []).reduce((sum, q) => {
                    // Exclude rejected quotations from expected revenue
                    if (q.status === 'rejected' || q.status === 'declined') {
                        return sum;
                    }
                    return sum + (parseFloat(q.amount || '0') || 0);
                }, 0);

                await supabase
                    .from('vendors')
                    .update({ expected_total_revenues: expectedRevenue })
                    .eq('id', user.id);
            } catch (revenueError) {
                console.error('[REVENUE UPDATE ERROR]', revenueError);
                // Don't fail the quotation submission if revenue update fails
            }

            Alert.alert('Success', 'Quotation submitted successfully! Booking is now confirmed.', [
                {
                    text: 'OK', onPress: () => {
                        setQuotationModalVisible(false);
                        fetchBookings();
                    }
                }
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to submit quotation');
        } finally {
            setSavingQuotation(false);
        }
    };

    const filteredBookings = bookings.filter(b => {
        if (filter === 'all') return true;
        return b.status === filter;
    });

    const renderBookingCard = ({ item }: { item: any }) => {
        return (
        <TouchableOpacity
            onPress={() => {
                setEditingBooking(item);
                setEditModalVisible(true);
            }}
            className="rounded-[32px] p-6 mb-6 shadow-sm"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
            <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 mr-4">
                    <Text className="text-[10px] uppercase font-bold tracking-widest" style={{ color: colors.textSecondary }}>{item.services?.name || 'Service'}</Text>
                    <Text className="text-xl font-bold mt-1" numberOfLines={1} style={{ color: colors.text }}>{item.customer_name}</Text>
                </View>
                <View className="px-3 py-1 rounded-full" style={{
                    backgroundColor: item.status === 'confirmed' ? (isDarkMode ? '#064E3B' : '#D1FAE5') :
                        item.status === 'pending' ? (isDarkMode ? '#7C2D12' : '#FED7AA') :
                            item.status === 'completed' ? (isDarkMode ? '#1E3A8A' : '#DBEAFE') : (isDarkMode ? '#374151' : '#F3F4F6')
                }}>
                    <Text className="text-[10px] font-bold uppercase" style={{
                        color: item.status === 'confirmed' ? (isDarkMode ? '#6EE7B7' : '#059669') :
                            item.status === 'pending' ? (isDarkMode ? '#FBBF24' : '#D97706') :
                                item.status === 'completed' ? (isDarkMode ? '#93C5FD' : '#2563EB') : (isDarkMode ? '#9CA3AF' : '#4B5563')
                    }}>{item.status}</Text>
                </View>
            </View>

            <View className="space-y-3">
                <View className="flex-row items-center">
                    <Calendar size={16} color={colors.textSecondary} />
                    <Text className="text-sm ml-2 font-medium" style={{ color: colors.text }}>
                        {item.booking_date}
                    </Text>
                </View>
                <View className="flex-row items-center mt-2">
                    <Clock size={16} color={colors.textSecondary} />
                    <Text className="text-sm ml-2 font-medium" style={{ color: colors.text }}>
                        {item.booking_time}
                    </Text>
                </View>
                <View className="flex-row items-center mt-2">
                    <MapPin size={16} color={colors.textSecondary} />
                    <Text className="text-sm ml-2" numberOfLines={1} style={{ color: colors.textSecondary }}>Customer: {item.customer_phone}</Text>
                </View>
                {item.notes && (
                    <View className="flex-row items-start mt-2 p-3 rounded-xl" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                        <MessageSquare size={14} color={colors.textSecondary} className="mt-0.5" />
                        <Text className="text-xs ml-2 flex-1" numberOfLines={2} style={{ color: colors.textSecondary }}>{item.notes}</Text>
                    </View>
                )}
            </View>

            {item.status === 'pending' && (
                <View className="flex-row mt-6 pt-6" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                    <TouchableOpacity
                        onPress={() => updateBookingStatus(item.id, 'cancelled')}
                        className="flex-1 flex-row items-center justify-center py-3 rounded-2xl mr-2"
                        style={{ backgroundColor: colors.background }}
                    >
                        <X size={18} color={colors.textSecondary} />
                        <Text className="font-bold ml-2" style={{ color: colors.textSecondary }}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={async () => {
                            setQuotationBooking(item);
                            await fetchServices();
                            const defaultService = item.service_id ? { id: item.service_id, name: item.services?.name || 'Service' } : null;
                            setQuotationForm({
                                serviceId: defaultService?.id || '',
                                serviceName: defaultService?.name || '',
                                amount: '',
                                venueAddress: '',
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
                            setDeliveryDate(new Date(item.booking_date ? new Date(item.booking_date) : new Date()));
                            setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days from now
                            setQuotationModalVisible(true);
                        }}
                        className="flex-1 flex-row items-center justify-center py-3 bg-primary rounded-2xl ml-2"
                    >
                        <Check size={18} color="white" />
                        <Text className="text-white font-bold ml-2">Accept</Text>
                    </TouchableOpacity>
                </View>
            )}

            {item.status === 'completed' && (
                <TouchableOpacity
                    onPress={() => generateReceipt(item)}
                    className="mt-6 pt-6 flex-row items-center justify-center"
                    style={{ borderTopWidth: 1, borderTopColor: colors.border }}
                >
                    <ReceiptText size={18} color="#FF6B00" />
                    <Text className="font-bold ml-2" style={{ color: colors.primary }}>Generate Receipt</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
        );
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
                <Text className="text-2xl font-bold" style={{ color: colors.text }}>Bookings</Text>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>Manage client requests</Text>
            </View>

            <View className="px-6 mb-6">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {['all', 'pending', 'confirmed', 'completed'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setFilter(f)}
                            className="px-6 py-2.5 rounded-full mr-3 border"
                            style={{
                                backgroundColor: filter === f ? colors.text : colors.surface,
                                borderColor: filter === f ? colors.text : colors.border
                            }}
                        >
                            <Text className="font-bold text-xs capitalize" style={{ color: filter === f ? colors.background : colors.text }}>{f}</Text>
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
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#FF6B00']}
                        tintColor="#FF6B00"
                    />
                }
                ListEmptyComponent={() => (
                    <View className="flex-1 items-center justify-center py-20">
                        <Text className="font-medium" style={{ color: colors.textSecondary }}>No {filter} bookings</Text>
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
                    <View className="rounded-t-[40px] p-8 pb-12" style={{ backgroundColor: colors.surface }}>
                        <View className="flex-row justify-between items-center mb-8">
                            <Text className="text-2xl font-bold" style={{ color: colors.text }}>Booking Details</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-6">
                            <View>
                                <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Customer Name</Text>
                                <Text className="font-semibold text-lg" style={{ color: colors.text }}>{editingBooking?.customer_name}</Text>
                            </View>

                            <View className="mt-4">
                                <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Booking Notes</Text>
                                <TextInput
                                    value={editingBooking?.notes}
                                    onChangeText={(t) => setEditingBooking({ ...editingBooking, notes: t })}
                                    multiline
                                    numberOfLines={4}
                                    className="rounded-2xl px-4 py-4 font-medium text-sm"
                                    style={{ 
                                        height: 100, 
                                        textAlignVertical: 'top',
                                        backgroundColor: colors.background,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        color: colors.text
                                    }}
                                    placeholder="Add notes about this booking..."
                                    placeholderTextColor={colors.textSecondary}
                                />
                            </View>
                        </View>

                        <View className="flex-row mt-10">
                            {editingBooking?.status === 'pending' && (
                                <>
                                    <TouchableOpacity
                                        onPress={() => updateBookingStatus(editingBooking.id, 'cancelled', editingBooking.notes)}
                                        className="flex-1 py-5 rounded-2xl mr-2 items-center"
                                        style={{ backgroundColor: colors.background }}
                                    >
                                        <Text className="font-bold" style={{ color: colors.textSecondary }}>Decline</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={async () => {
                                            setEditModalVisible(false);
                                            setQuotationBooking(editingBooking);
                                            await fetchServices();
                                            const defaultService = editingBooking.service_id ? { id: editingBooking.service_id, name: editingBooking.services?.name || 'Service' } : null;
                                            setQuotationForm({
                                                serviceId: defaultService?.id || '',
                                                serviceName: defaultService?.name || '',
                                                amount: '',
                                                venueAddress: '',
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
                                            setDeliveryDate(new Date(editingBooking.booking_date ? new Date(editingBooking.booking_date) : new Date()));
                                            setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days from now
                                            setQuotationModalVisible(true);
                                        }}
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

            {/* Quotation Form Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={quotationModalVisible}
                onRequestClose={() => setQuotationModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    <View className="flex-1 justify-end bg-black/50">
                        <View className="rounded-t-[40px] max-h-[90%]" style={{ backgroundColor: colors.surface }}>
                            <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
                                <View className="flex-row justify-between items-center mb-6">
                                    <Text className="text-2xl font-bold" style={{ color: colors.text }}>Create Quotation</Text>
                                    <TouchableOpacity onPress={() => setQuotationModalVisible(false)}>
                                        <X size={24} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Header Section */}
                                <View className="rounded-3xl p-4 mb-6" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                    <Text className="text-xs font-bold mb-4 uppercase tracking-widest" style={{ color: colors.textSecondary }}>Quotation Header</Text>

                                    <View className="space-y-3">
                                        <View className="flex-row justify-between items-center py-2 px-3 rounded-xl" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                                            <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>Customer Name</Text>
                                            <Text className="text-sm font-bold" style={{ color: colors.text }}>{quotationBooking?.customer_name}</Text>
                                        </View>
                                        <View className="flex-row justify-between items-center py-2 px-3 rounded-xl" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                                            <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>Quotation Date & Time</Text>
                                            <TouchableOpacity onPress={() => setQuotationDateVisible(true)}>
                                                <Text className="text-sm font-bold" style={{ color: colors.text }}>
                                                    {quotationDate.toLocaleString()}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View className="flex-row justify-between items-center py-2 px-3 rounded-xl" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                                            <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>Delivery Date & Time</Text>
                                            <TouchableOpacity onPress={() => setDeliveryDateVisible(true)}>
                                                <Text className="text-sm font-bold" style={{ color: colors.text }}>
                                                    {deliveryDate.toLocaleString()}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                {/* Service Selection */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Select Service *</Text>
                                    {fetchingServices ? (
                                        <ActivityIndicator color="#FF6B00" />
                                    ) : (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                                            {services.map((service) => (
                                                <TouchableOpacity
                                                    key={service.id}
                                                    onPress={() => setQuotationForm({ ...quotationForm, serviceId: service.id, serviceName: service.name })}
                                                    className="mr-3 px-6 py-4 rounded-3xl border-2"
                                                    style={{
                                                        backgroundColor: quotationForm.serviceId === service.id 
                                                            ? (isDarkMode ? 'rgba(255, 107, 0, 0.2)' : 'rgba(255, 107, 0, 0.1)')
                                                            : colors.surface,
                                                        borderColor: quotationForm.serviceId === service.id ? colors.primary : colors.border,
                                                    }}
                                                >
                                                    <Text className="font-extrabold text-base" style={{ color: quotationForm.serviceId === service.id ? colors.primary : colors.text }}>
                                                        {service.name}
                                                    </Text>
                                                    <Text className="text-[10px] mt-1 font-bold" style={{ color: colors.primary }}>BASE: ₹{service.price_amount}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}
                                    {quotationBooking?.services?.name && !quotationForm.serviceName && (
                                        <View className="mt-2 rounded-xl p-3" style={{ backgroundColor: isDarkMode ? 'rgba(255, 107, 0, 0.1)' : 'rgba(255, 107, 0, 0.05)', borderWidth: 1, borderColor: colors.primary }}>
                                            <Text className="text-xs font-medium" style={{ color: colors.primary }}>
                                                Booking Service: {quotationBooking.services.name}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Amount */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Amount (₹)</Text>
                                    <View className="flex-row items-center rounded-2xl px-5 py-4" style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border }}>
                                        <Text className="font-extrabold text-xl mr-3" style={{ color: colors.text }}>₹</Text>
                                        <TextInput
                                            placeholder="Enter amount"
                                            placeholderTextColor={colors.textSecondary}
                                            keyboardType="number-pad"
                                            value={quotationForm.amount}
                                            onChangeText={(text) => setQuotationForm({ ...quotationForm, amount: text })}
                                            className="flex-1 font-extrabold text-xl"
                                            style={{ color: colors.text }}
                                        />
                                    </View>
                                </View>

                                {/* Venue Address */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Venue Address</Text>
                                    <TextInput
                                        placeholder="Enter venue address"
                                        placeholderTextColor={colors.textSecondary}
                                        value={quotationForm.venueAddress}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, venueAddress: text })}
                                        multiline
                                        numberOfLines={3}
                                        className="rounded-2xl px-5 py-4 font-medium"
                                        style={{ 
                                            backgroundColor: colors.background, 
                                            borderWidth: 2, 
                                            borderColor: colors.border, 
                                            color: colors.text,
                                            textAlignVertical: 'top', 
                                            minHeight: 80 
                                        }}
                                    />
                                </View>

                                {/* Valid Until */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Valid Until *</Text>
                                    <TouchableOpacity
                                        onPress={() => setValidUntilVisible(true)}
                                        className="rounded-2xl px-5 py-4 flex-row items-center justify-between"
                                        style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border }}
                                    >
                                        <Text className="font-medium" style={{ color: colors.text }}>
                                            {validUntil.toLocaleDateString()} {validUntil.toLocaleTimeString()}
                                        </Text>
                                        <Calendar size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Detailed Product Specifications */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>a. Detailed Product Specifications</Text>
                                    <TextInput
                                        placeholder="Enter specifications or upload images"
                                        placeholderTextColor={colors.textSecondary}
                                        value={quotationForm.specifications}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, specifications: text })}
                                        multiline
                                        numberOfLines={4}
                                        className="rounded-2xl px-5 py-4 font-medium mb-3"
                                        style={{ 
                                            backgroundColor: colors.background, 
                                            borderWidth: 2, 
                                            borderColor: colors.border, 
                                            color: colors.text,
                                            textAlignVertical: 'top',
                                            minHeight: 100
                                        }}
                                    />
                                    <View className="flex-row flex-wrap">
                                        {quotationAttachments.specifications.map((uri, index) => (
                                            <View key={index} className="w-20 h-20 rounded-xl mr-2 mb-2 relative overflow-hidden" style={{ backgroundColor: colors.background }}>
                                                <Image source={{ uri }} className="w-full h-full" />
                                                <TouchableOpacity
                                                    onPress={() => setQuotationAttachments({
                                                        ...quotationAttachments,
                                                        specifications: quotationAttachments.specifications.filter((_, i) => i !== index)
                                                    })}
                                                    className="absolute top-1 right-1 bg-black/50 p-1 rounded-full"
                                                >
                                                    <X size={12} color="white" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        <TouchableOpacity
                                            onPress={() => pickImage('specifications')}
                                            className="w-20 h-20 rounded-xl border-2 border-dashed items-center justify-center"
                                            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                                        >
                                            <UploadCloud size={20} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Quantity Requirements */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>b. Quantity Requirements</Text>
                                    <TextInput
                                        placeholder="Enter quantity requirements or upload images"
                                        placeholderTextColor={colors.textSecondary}
                                        value={quotationForm.quantityRequirements}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, quantityRequirements: text })}
                                        multiline
                                        numberOfLines={4}
                                        className="rounded-2xl px-5 py-4 font-medium mb-3"
                                        style={{ 
                                            backgroundColor: colors.background, 
                                            borderWidth: 2, 
                                            borderColor: colors.border, 
                                            color: colors.text,
                                            textAlignVertical: 'top',
                                            minHeight: 100
                                        }}
                                    />
                                    <View className="flex-row flex-wrap">
                                        {quotationAttachments.quantityRequirements.map((uri, index) => (
                                            <View key={index} className="w-20 h-20 rounded-xl mr-2 mb-2 relative overflow-hidden" style={{ backgroundColor: colors.background }}>
                                                <Image source={{ uri }} className="w-full h-full" />
                                                <TouchableOpacity
                                                    onPress={() => setQuotationAttachments({
                                                        ...quotationAttachments,
                                                        quantityRequirements: quotationAttachments.quantityRequirements.filter((_, i) => i !== index)
                                                    })}
                                                    className="absolute top-1 right-1 bg-black/50 p-1 rounded-full"
                                                >
                                                    <X size={12} color="white" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        <TouchableOpacity
                                            onPress={() => pickImage('quantityRequirements')}
                                            className="w-20 h-20 rounded-xl border-2 border-dashed items-center justify-center"
                                            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                                        >
                                            <UploadCloud size={20} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Quality Standards */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>c. Quality Standards</Text>
                                    <TextInput
                                        placeholder="Enter quality standards or upload images"
                                        placeholderTextColor={colors.textSecondary}
                                        value={quotationForm.qualityStandards}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, qualityStandards: text })}
                                        multiline
                                        numberOfLines={4}
                                        className="rounded-2xl px-5 py-4 font-medium mb-3"
                                        style={{ 
                                            backgroundColor: colors.background, 
                                            borderWidth: 2, 
                                            borderColor: colors.border, 
                                            color: colors.text,
                                            textAlignVertical: 'top',
                                            minHeight: 100
                                        }}
                                    />
                                    <View className="flex-row flex-wrap">
                                        {quotationAttachments.qualityStandards.map((uri, index) => (
                                            <View key={index} className="w-20 h-20 rounded-xl mr-2 mb-2 relative overflow-hidden" style={{ backgroundColor: colors.background }}>
                                                <Image source={{ uri }} className="w-full h-full" />
                                                <TouchableOpacity
                                                    onPress={() => setQuotationAttachments({
                                                        ...quotationAttachments,
                                                        qualityStandards: quotationAttachments.qualityStandards.filter((_, i) => i !== index)
                                                    })}
                                                    className="absolute top-1 right-1 bg-black/50 p-1 rounded-full"
                                                >
                                                    <X size={12} color="white" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        <TouchableOpacity
                                            onPress={() => pickImage('qualityStandards')}
                                            className="w-20 h-20 rounded-xl border-2 border-dashed items-center justify-center"
                                            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                                        >
                                            <UploadCloud size={20} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Delivery Terms */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>d. Delivery Terms</Text>
                                    <TextInput
                                        placeholder="Enter delivery terms or upload images"
                                        placeholderTextColor={colors.textSecondary}
                                        value={quotationForm.deliveryTerms}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, deliveryTerms: text })}
                                        multiline
                                        numberOfLines={4}
                                        className="rounded-2xl px-5 py-4 font-medium mb-3"
                                        style={{ 
                                            backgroundColor: colors.background, 
                                            borderWidth: 2, 
                                            borderColor: colors.border, 
                                            color: colors.text,
                                            textAlignVertical: 'top',
                                            minHeight: 100
                                        }}
                                    />
                                    <View className="flex-row flex-wrap">
                                        {quotationAttachments.deliveryTerms.map((uri, index) => (
                                            <View key={index} className="w-20 h-20 rounded-xl mr-2 mb-2 relative overflow-hidden" style={{ backgroundColor: colors.background }}>
                                                <Image source={{ uri }} className="w-full h-full" />
                                                <TouchableOpacity
                                                    onPress={() => setQuotationAttachments({
                                                        ...quotationAttachments,
                                                        deliveryTerms: quotationAttachments.deliveryTerms.filter((_, i) => i !== index)
                                                    })}
                                                    className="absolute top-1 right-1 bg-black/50 p-1 rounded-full"
                                                >
                                                    <X size={12} color="white" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        <TouchableOpacity
                                            onPress={() => pickImage('deliveryTerms')}
                                            className="w-20 h-20 rounded-xl border-2 border-dashed items-center justify-center"
                                            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                                        >
                                            <UploadCloud size={20} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Payment Terms */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>e. Payment Terms (Beyond 20% Advance)</Text>
                                    <TextInput
                                        placeholder="Enter payment terms or upload images"
                                        placeholderTextColor={colors.textSecondary}
                                        value={quotationForm.paymentTerms}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, paymentTerms: text })}
                                        multiline
                                        numberOfLines={4}
                                        className="rounded-2xl px-5 py-4 font-medium mb-3"
                                        style={{ 
                                            backgroundColor: colors.background, 
                                            borderWidth: 2, 
                                            borderColor: colors.border, 
                                            color: colors.text,
                                            textAlignVertical: 'top',
                                            minHeight: 100
                                        }}
                                    />
                                    <View className="flex-row flex-wrap">
                                        {quotationAttachments.paymentTerms.map((uri, index) => (
                                            <View key={index} className="w-20 h-20 rounded-xl mr-2 mb-2 relative overflow-hidden" style={{ backgroundColor: colors.background }}>
                                                <Image source={{ uri }} className="w-full h-full" />
                                                <TouchableOpacity
                                                    onPress={() => setQuotationAttachments({
                                                        ...quotationAttachments,
                                                        paymentTerms: quotationAttachments.paymentTerms.filter((_, i) => i !== index)
                                                    })}
                                                    className="absolute top-1 right-1 bg-black/50 p-1 rounded-full"
                                                >
                                                    <X size={12} color="white" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        <TouchableOpacity
                                            onPress={() => pickImage('paymentTerms')}
                                            className="w-20 h-20 rounded-xl border-2 border-dashed items-center justify-center"
                                            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                                        >
                                            <UploadCloud size={20} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Vendor Terms & Conditions */}
                                <View className="mb-6">
                                    <TouchableOpacity
                                        onPress={() => setQuotationForm({ ...quotationForm, vendorTcAccepted: !quotationForm.vendorTcAccepted })}
                                        className="flex-row items-center"
                                    >
                                        <View className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center ${quotationForm.vendorTcAccepted ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                                            {quotationForm.vendorTcAccepted && <Check size={16} color="white" />}
                                        </View>
                                        <Text className="text-sm font-bold flex-1" style={{ color: colors.text }}>
                                            I accept the Terms and Conditions
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Submit Button */}
                                <TouchableOpacity
                                    onPress={handleSubmitQuotation}
                                    disabled={savingQuotation}
                                    className={`bg-primary py-5 rounded-2xl items-center mb-6 ${savingQuotation ? 'opacity-50' : ''}`}
                                >
                                    {savingQuotation ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white font-bold text-lg">Submit Quotation</Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <DateTimePickerModal
                isVisible={quotationDateVisible}
                mode="datetime"
                onConfirm={(date) => {
                    setQuotationDate(date);
                    setQuotationDateVisible(false);
                }}
                onCancel={() => setQuotationDateVisible(false)}
                date={quotationDate}
            />

            <DateTimePickerModal
                isVisible={deliveryDateVisible}
                mode="datetime"
                onConfirm={(date) => {
                    setDeliveryDate(date);
                    setDeliveryDateVisible(false);
                }}
                onCancel={() => setDeliveryDateVisible(false)}
                date={deliveryDate}
            />

            <DateTimePickerModal
                isVisible={validUntilVisible}
                mode="datetime"
                onConfirm={(date) => {
                    setValidUntil(date);
                    setValidUntilVisible(false);
                }}
                onCancel={() => setValidUntilVisible(false)}
                date={validUntil}
            />
        </SafeAreaView>
    );
}
