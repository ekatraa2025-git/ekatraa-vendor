import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput, Alert, Image, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, MapPin, Check, X, ChevronRight, Edit3, MessageSquare, ReceiptText, UploadCloud } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { formatReceiptData } from '../../lib/receipt';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore - Using legacy API for compatibility
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

export default function BookingsScreen() {
    const { t } = useTranslation();
    const { colors } = useTheme();
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
    
    const [quotationAttachments, setQuotationAttachments] = useState<{[key: string]: string[]}>({
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
            return urlOrPath; // Return original if all fails
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
                // Read file as base64 using expo-file-system
                const base64 = await FileSystem.readAsStringAsync(uri, {
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
            const uploadedAttachments: {[key: string]: string[]} = {};
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
            const quotationData: any = {
                vendor_id: user.id, // Must match auth.uid() for RLS
                booking_id: quotationBooking.id,
                customer_name: quotationBooking.customer_name || null,
                quotation_date: quotationDate.toISOString(),
                delivery_date: deliveryDate.toISOString(),
                venue_address: quotationForm.venueAddress || null,
                service_type: finalServiceName,
                amount: parseFloat(quotationForm.amount) || 0,
                specifications: quotationForm.specifications || null,
                quantity_requirements: quotationForm.quantityRequirements || null,
                quality_standards: quotationForm.qualityStandards || null,
                delivery_terms: quotationForm.deliveryTerms || null,
                payment_terms: quotationForm.paymentTerms || null,
                attachments: uploadedAttachments || {},
                vendor_tc_accepted: quotationForm.vendorTcAccepted || false,
                customer_tc_accepted: false,
                status: 'submitted'
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

            Alert.alert('Success', 'Quotation submitted successfully! Booking is now confirmed.', [
                { text: 'OK', onPress: () => {
                    setQuotationModalVisible(false);
                    fetchBookings();
                }}
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
                    onPress={() => {
                        const receipt = formatReceiptData(item, vendor);
                        Alert.alert('Receipt Generated', `Receipt ${receipt.receiptId} has been generated.\n\nThank You Message:\n${receipt.thankYouMessage}`);
                    }}
                    className="mt-6 pt-6 border-t border-gray-50 flex-row items-center justify-center"
                >
                    <ReceiptText size={18} color="#FF6B00" />
                    <Text className="text-primary font-bold ml-2">Generate Receipt</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );

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
                        <View className="bg-white rounded-t-[40px] max-h-[90%]">
                            <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
                                <View className="flex-row justify-between items-center mb-6">
                                    <Text className="text-2xl font-bold text-accent-dark">Create Quotation</Text>
                                    <TouchableOpacity onPress={() => setQuotationModalVisible(false)}>
                                        <X size={24} color="#4B5563" />
                                    </TouchableOpacity>
                                </View>

                                {/* Header Section */}
                                <View className="bg-gray-50 rounded-3xl p-4 mb-6">
                                    <Text className="text-xs font-bold text-accent-dark mb-4 uppercase tracking-widest">Quotation Header</Text>
                                    
                                    <View className="space-y-3">
                                        <View className="flex-row justify-between">
                                            <Text className="text-xs font-bold text-accent">Customer Name</Text>
                                            <Text className="text-sm font-bold text-accent-dark">{quotationBooking?.customer_name}</Text>
                                        </View>
                                        <View className="flex-row justify-between">
                                            <Text className="text-xs font-bold text-accent">Quotation Date & Time</Text>
                                            <TouchableOpacity onPress={() => setQuotationDateVisible(true)}>
                                                <Text className="text-sm font-bold text-accent-dark">
                                                    {quotationDate.toLocaleString()}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View className="flex-row justify-between">
                                            <Text className="text-xs font-bold text-accent">Delivery Date & Time</Text>
                                            <TouchableOpacity onPress={() => setDeliveryDateVisible(true)}>
                                                <Text className="text-sm font-bold text-accent-dark">
                                                    {deliveryDate.toLocaleString()}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                {/* Service Selection */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold text-accent-dark mb-2">Select Service *</Text>
                                    {fetchingServices ? (
                                        <ActivityIndicator color="#FF6B00" />
                                    ) : (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                                            {services.map((service) => (
                                                <TouchableOpacity
                                                    key={service.id}
                                                    onPress={() => setQuotationForm({ ...quotationForm, serviceId: service.id, serviceName: service.name })}
                                                    className={`mr-3 px-6 py-4 rounded-3xl border-2 ${quotationForm.serviceId === service.id ? 'bg-primary/10 border-primary' : 'bg-surface border-gray-100'}`}
                                                >
                                                    <Text className={`font-extrabold text-base ${quotationForm.serviceId === service.id ? 'text-primary' : 'text-accent-dark'}`}>
                                                        {service.name}
                                                    </Text>
                                                    <Text className="text-accent text-[10px] mt-1 font-bold">BASE: ₹{service.price_amount}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}
                                    {quotationBooking?.services?.name && !quotationForm.serviceName && (
                                        <View className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
                                            <Text className="text-orange-800 text-xs font-medium">
                                                Booking Service: {quotationBooking.services.name}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Amount */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold text-accent-dark mb-2">Amount (₹)</Text>
                                    <View className="flex-row items-center bg-white border-2 border-gray-100 rounded-2xl px-5 py-4">
                                        <Text className="text-black font-extrabold text-xl mr-3">₹</Text>
                                        <TextInput
                                            placeholder="Enter amount"
                                            placeholderTextColor="#9CA3AF"
                                            keyboardType="number-pad"
                                            value={quotationForm.amount}
                                            onChangeText={(text) => setQuotationForm({ ...quotationForm, amount: text })}
                                            className="flex-1 text-black font-extrabold text-xl"
                                        />
                                    </View>
                                </View>

                                {/* Venue Address */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold text-accent-dark mb-2">Venue Address</Text>
                                    <TextInput
                                        placeholder="Enter venue address"
                                        placeholderTextColor="#9CA3AF"
                                        value={quotationForm.venueAddress}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, venueAddress: text })}
                                        multiline
                                        numberOfLines={3}
                                        className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 text-black font-medium"
                                        style={{ textAlignVertical: 'top', minHeight: 80 }}
                                    />
                                </View>

                                {/* Valid Until */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold text-accent-dark mb-2">Valid Until *</Text>
                                    <TouchableOpacity
                                        onPress={() => setValidUntilVisible(true)}
                                        className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 flex-row items-center justify-between"
                                    >
                                        <Text className="text-black font-medium">
                                            {validUntil.toLocaleDateString()} {validUntil.toLocaleTimeString()}
                                        </Text>
                                        <Calendar size={20} color="#9CA3AF" />
                                    </TouchableOpacity>
                                </View>

                                {/* Detailed Product Specifications */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold text-accent-dark mb-2">a. Detailed Product Specifications</Text>
                                    <TextInput
                                        placeholder="Enter specifications or upload images"
                                        placeholderTextColor="#9CA3AF"
                                        value={quotationForm.specifications}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, specifications: text })}
                                        multiline
                                        numberOfLines={4}
                                        className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 text-black font-medium mb-3"
                                        style={{ textAlignVertical: 'top', minHeight: 100 }}
                                    />
                                    <View className="flex-row flex-wrap">
                                        {quotationAttachments.specifications.map((uri, index) => (
                                            <View key={index} className="w-20 h-20 rounded-xl bg-gray-100 mr-2 mb-2 relative overflow-hidden">
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
                                            className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 items-center justify-center bg-surface"
                                        >
                                            <UploadCloud size={20} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Quantity Requirements */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold text-accent-dark mb-2">b. Quantity Requirements</Text>
                                    <TextInput
                                        placeholder="Enter quantity requirements or upload images"
                                        placeholderTextColor="#9CA3AF"
                                        value={quotationForm.quantityRequirements}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, quantityRequirements: text })}
                                        multiline
                                        numberOfLines={4}
                                        className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 text-black font-medium mb-3"
                                        style={{ textAlignVertical: 'top', minHeight: 100 }}
                                    />
                                    <View className="flex-row flex-wrap">
                                        {quotationAttachments.quantityRequirements.map((uri, index) => (
                                            <View key={index} className="w-20 h-20 rounded-xl bg-gray-100 mr-2 mb-2 relative overflow-hidden">
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
                                            className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 items-center justify-center bg-surface"
                                        >
                                            <UploadCloud size={20} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Quality Standards */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold text-accent-dark mb-2">c. Quality Standards</Text>
                                    <TextInput
                                        placeholder="Enter quality standards or upload images"
                                        placeholderTextColor="#9CA3AF"
                                        value={quotationForm.qualityStandards}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, qualityStandards: text })}
                                        multiline
                                        numberOfLines={4}
                                        className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 text-black font-medium mb-3"
                                        style={{ textAlignVertical: 'top', minHeight: 100 }}
                                    />
                                    <View className="flex-row flex-wrap">
                                        {quotationAttachments.qualityStandards.map((uri, index) => (
                                            <View key={index} className="w-20 h-20 rounded-xl bg-gray-100 mr-2 mb-2 relative overflow-hidden">
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
                                            className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 items-center justify-center bg-surface"
                                        >
                                            <UploadCloud size={20} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Delivery Terms */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold text-accent-dark mb-2">d. Delivery Terms</Text>
                                    <TextInput
                                        placeholder="Enter delivery terms or upload images"
                                        placeholderTextColor="#9CA3AF"
                                        value={quotationForm.deliveryTerms}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, deliveryTerms: text })}
                                        multiline
                                        numberOfLines={4}
                                        className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 text-black font-medium mb-3"
                                        style={{ textAlignVertical: 'top', minHeight: 100 }}
                                    />
                                    <View className="flex-row flex-wrap">
                                        {quotationAttachments.deliveryTerms.map((uri, index) => (
                                            <View key={index} className="w-20 h-20 rounded-xl bg-gray-100 mr-2 mb-2 relative overflow-hidden">
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
                                            className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 items-center justify-center bg-surface"
                                        >
                                            <UploadCloud size={20} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Payment Terms */}
                                <View className="mb-6">
                                    <Text className="text-sm font-bold text-accent-dark mb-2">e. Payment Terms (Beyond 20% Advance)</Text>
                                    <TextInput
                                        placeholder="Enter payment terms or upload images"
                                        placeholderTextColor="#9CA3AF"
                                        value={quotationForm.paymentTerms}
                                        onChangeText={(text) => setQuotationForm({ ...quotationForm, paymentTerms: text })}
                                        multiline
                                        numberOfLines={4}
                                        className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 text-black font-medium mb-3"
                                        style={{ textAlignVertical: 'top', minHeight: 100 }}
                                    />
                                    <View className="flex-row flex-wrap">
                                        {quotationAttachments.paymentTerms.map((uri, index) => (
                                            <View key={index} className="w-20 h-20 rounded-xl bg-gray-100 mr-2 mb-2 relative overflow-hidden">
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
                                            className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 items-center justify-center bg-surface"
                                        >
                                            <UploadCloud size={20} color="#9CA3AF" />
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
                                        <Text className="text-sm font-bold text-accent-dark flex-1">
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
