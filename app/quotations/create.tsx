import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Calendar as CalendarIcon, FileText, Plus, X, UploadCloud, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import BottomNav from '../../components/BottomNav';

const DEFAULT_TERMS = "1. This quotation is valid for 30 days.\n2. 50% advance payment required to confirm booking.\n3. Taxes as applicable.\n4. Detailed service breakdown will be provided upon acceptance.";

export default function CreateQuotation() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const editQuotationId = params.edit as string | undefined;
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [editing, setEditing] = useState(!!editQuotationId);
    const [services, setServices] = useState<any[]>([]);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [attachments, setAttachments] = useState<string[]>([]);
    const [existingQuotation, setExistingQuotation] = useState<any>(null);

    const [formData, setFormData] = useState({
        serviceId: '',
        amount: '',
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
        terms: DEFAULT_TERMS,
    });

    useEffect(() => {
        const loadData = async () => {
            await fetchServices();
            if (editQuotationId) {
                // Wait a bit for services to be set before fetching quotation
                setTimeout(() => {
                    fetchQuotationForEdit();
                }, 100);
            }
        };
        loadData();
    }, [editQuotationId]);

    const fetchServices = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('services')
                .select('*')
                .eq('vendor_id', user.id);

            setServices(data || []);
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setFetching(false);
        }
    };

    const fetchQuotationForEdit = async () => {
        if (!editQuotationId) return;
        
        try {
            setFetching(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Select only columns that exist in the schema (exclude valid_until, service_id, terms, and updated_at)
            const { data, error } = await supabase
                .from('quotations')
                .select('id, vendor_id, service_type, amount, attachments, vendor_tc_accepted, customer_tc_accepted, status, created_at')
                .eq('id', editQuotationId)
                .eq('vendor_id', user.id)
                .single();

            if (error) throw error;
            
            setExistingQuotation(data);
            
            // Populate form with existing data
            if (data) {
                // Find matching service by name (service_id column doesn't exist in schema)
                let matchingService = null;
                if (data.service_type) {
                    matchingService = services.find(s => s.name === data.service_type);
                }
                if (matchingService) {
                    setSelectedService(matchingService);
                } else if (data.service_type) {
                    // If service not found but we have service_type, create a temporary service object
                    // This prevents crashes when editing quotations with services that no longer exist
                    setSelectedService({
                        id: null,
                        name: data.service_type,
                        price_amount: 0
                    });
                }
                
                setFormData({
                    serviceId: matchingService?.id || '',
                    amount: data.amount?.toString() || '',
                    validUntil: data.valid_until ? new Date(data.valid_until) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    terms: DEFAULT_TERMS, // terms column doesn't exist, use default
                });

                // Load existing attachments if any
                if (data.attachments && typeof data.attachments === 'object') {
                    const existingAttachments: string[] = [];
                    Object.values(data.attachments).forEach((attachmentArray: any) => {
                        if (Array.isArray(attachmentArray)) {
                            existingAttachments.push(...attachmentArray);
                        }
                    });
                    setAttachments(existingAttachments);
                }
            }
        } catch (error) {
            console.error('Error fetching quotation for edit:', error);
            showToast({ variant: 'error', title: 'Could not load quotation', message: 'Could not load quotation for editing.' });
            router.back();
        } finally {
            setFetching(false);
        }
    };

    const handleDateConfirm = (date: Date) => {
        setFormData({ ...formData, validUntil: date });
        setDatePickerVisibility(false);
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            const newUris = result.assets.map(asset => asset.uri);
            setAttachments([...attachments, ...newUris]);
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

    const uploadImage = async (uri: string, prefix: string = 'image') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            console.log('[DEBUG] Uploading:', fileName, 'URI:', uri);

            let fileData: ArrayBuffer;

            // Handle local file URIs (file:// or content://)
            if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://')) {
                // Read file as base64 using expo-file-system
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
                console.error('[STORAGE ERROR DETAIL]', error);
                throw error;
            }

            // Return just the filename - we'll generate signed URLs when displaying
            return fileName;
        } catch (error: any) {
            console.error('[UPLOAD CATCH]', error);
            throw error;
        }
    };

    const handleSave = async () => {
        // For edit mode, allow saving even if service is not found (use existing service_type)
        const serviceName = editing && existingQuotation?.service_type 
            ? existingQuotation.service_type 
            : (selectedService?.name || '');
        
        if (!serviceName || !formData.amount) {
            showToast({
                variant: 'warning',
                title: 'Missing info',
                message: editing ? 'Please enter an amount.' : 'Please select a service and enter an amount.',
            });
            return;
        }
        const parsedAmount = parseFloat(formData.amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            showToast({ variant: 'warning', title: 'Invalid amount', message: 'Please enter a valid positive amount.' });
            return;
        }
        if (parsedAmount > 9999999) {
            showToast({ variant: 'warning', title: 'Invalid amount', message: 'Amount cannot exceed ₹99,99,999.' });
            return;
        }

        try {
            setLoading(true);

            // Ensure user is authenticated and get session
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw new Error(`Authentication error: ${userError.message}`);
            if (!user || !user.id) throw new Error('No authenticated user found. Please log in again.');

            // Verify session is active
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session expired. Please log in again.');

            const uploadedAttachments: string[] = [];
            // Only upload new attachments (those starting with file:// or content://)
            // Keep existing attachments that are already URLs/filenames
            for (const uri of attachments) {
                if (uri && (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://'))) {
                    try {
                        const uploadedFileName = await uploadImage(uri, 'quotation');
                        uploadedAttachments.push(uploadedFileName);
                    } catch (uploadError: any) {
                        console.error('[UPLOAD ERROR]', uploadError);
                        // Continue with other uploads even if one fails
                    }
                } else if (uri) {
                    // Already uploaded or existing attachment
                    uploadedAttachments.push(uri);
                }
            }

            // Build quotation data object
            const amount = parseFloat(formData.amount) || 0;
            const quotationData: any = {
                service_type: serviceName,
                amount: amount,
                // Note: valid_until column doesn't exist in schema - explicitly excluded
                attachments: uploadedAttachments.length > 0 ? { general: uploadedAttachments } : {},
                vendor_tc_accepted: false,
                customer_tc_accepted: false,
            };

            // Explicitly ensure valid_until is never included (defensive programming)
            if ('valid_until' in quotationData) {
                delete quotationData.valid_until;
            }
            if ('validUntil' in quotationData) {
                delete quotationData.validUntil;
            }

            if (editing && editQuotationId) {
                // Update existing quotation
                // Reset status to 'pending' when resubmitting an edited quotation
                quotationData.status = 'pending';
                
                console.log('[DEBUG] Updating quotation:', editQuotationId);
                console.log('[DEBUG] Quotation data being updated:', JSON.stringify(quotationData, null, 2));
                
                const { data, error } = await supabase
                    .from('quotations')
                    .update(quotationData)
                    .eq('id', editQuotationId)
                    .eq('vendor_id', user.id) // Ensure vendor owns this quotation
                    .select()
                    .single();

                if (error) {
                    console.error('[QUOTATION UPDATE ERROR]', error);
                    if (error.message?.includes('row level security') || error.message?.includes('RLS')) {
                        throw new Error('Permission denied. Please ensure you are logged in and have permission to update quotations.');
                    }
                    throw error;
                }

                // Update vendor expected revenue after quotation update
                // Exclude rejected quotations from expected revenue
                try {
                    const { data: allQuotations } = await supabase
                        .from('quotations')
                        .select('amount, status')
                        .eq('vendor_id', user.id);

                    const expectedRevenue = (allQuotations || []).reduce((sum: number, q: { amount?: string; status?: string }) => {
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
                    // Don't fail quotation update if revenue update fails
                }

                showToast({ variant: 'success', title: 'Quotation updated', message: 'Resubmitted successfully.' });
                router.replace('/quotations');
            } else {
                // Create new quotation
                quotationData.vendor_id = user.id; // Must match auth.uid() for RLS
                quotationData.status = 'pending';

                console.log('[DEBUG] Inserting quotation with vendor_id:', user.id);
                const { data, error } = await supabase
                    .from('quotations')
                    .insert(quotationData)
                    .select()
                    .single();

                if (error) {
                    console.error('[QUOTATION INSERT ERROR]', error);
                    if (error.message?.includes('row level security') || error.message?.includes('RLS')) {
                        throw new Error('Permission denied. Please ensure you are logged in and have permission to create quotations.');
                    }
                    throw error;
                }

                // Update vendor expected revenue after quotation creation
                // Exclude rejected quotations from expected revenue
                try {
                    const { data: allQuotations } = await supabase
                        .from('quotations')
                        .select('amount, status')
                        .eq('vendor_id', user.id);

                    const expectedRevenue = (allQuotations || []).reduce((sum: number, q: { amount?: string; status?: string }) => {
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
                    // Don't fail quotation creation if revenue update fails
                }

                showToast({ variant: 'success', title: 'Quotation created', message: 'Your quotation was saved.' });
                router.replace('/quotations');
            }
        } catch (error: any) {
            showToast({ variant: 'error', title: 'Could not save', message: error.message || `Failed to ${editing ? 'update' : 'save'} quotation.` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={28} color={colors.text} />
                </TouchableOpacity>
                <Text className="text-2xl font-extrabold" style={{ color: colors.text }}>
                    {editing ? 'Edit Quotation' : 'New Quotation'}
                </Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView className="px-6 pb-12" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                    <View className="mb-8">
                        <Text className="text-sm font-bold mb-3 ml-1" style={{ color: colors.text }}>Select Service</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {fetching ? (
                                <ActivityIndicator color="#FF6B00" />
                            ) : (
                                <>
                                    {services.map((service) => (
                                        <TouchableOpacity
                                            key={service.id}
                                            onPress={() => setSelectedService(service)}
                                            className="mr-3 px-6 py-4 rounded-3xl border-2"
                                            style={{
                                                backgroundColor: selectedService?.id === service.id ? colors.primary + '1A' : colors.surface,
                                                borderColor: selectedService?.id === service.id ? colors.primary : colors.border
                                            }}
                                        >
                                            <Text className="font-extrabold text-base" style={{ color: selectedService?.id === service.id ? colors.primary : colors.text }}>
                                                {service.name}
                                            </Text>
                                            <Text className="text-[10px] mt-1 font-bold" style={{ color: colors.textSecondary }}>BASE: ₹{service.price_amount}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    {/* Show existing service if editing and service not found in list */}
                                    {editing && selectedService && !selectedService.id && (
                                        <TouchableOpacity
                                            className="mr-3 px-6 py-4 rounded-3xl border-2"
                                            style={{
                                                backgroundColor: colors.primary + '1A',
                                                borderColor: colors.primary
                                            }}
                                        >
                                            <Text className="font-extrabold text-base" style={{ color: colors.primary }}>
                                                {selectedService.name}
                                            </Text>
                                            <Text className="text-[10px] mt-1 font-bold" style={{ color: colors.textSecondary }}>Current Service</Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}
                        </ScrollView>
                    </View>

                    <View className="space-y-6">
                        <View>
                            <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.text }}>Quotation Amount (₹)</Text>
                            <View className="flex-row items-center rounded-2xl px-5 py-5" style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border }}>
                                <Text className="font-extrabold text-xl mr-3" style={{ color: colors.text }}>₹</Text>
                                <TextInput
                                    placeholder="Enter total amount"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="number-pad"
                                    value={formData.amount}
                                    onChangeText={(text) => setFormData({ ...formData, amount: text })}
                                    className="flex-1 font-extrabold text-xl"
                                    style={{ color: colors.text }}
                                    maxLength={8}
                                />
                            </View>
                            {selectedService && (
                                <Text className="text-[10px] mt-2 ml-1 font-bold italic" style={{ color: colors.textSecondary }}>
                                    Include all taxes and service charges
                                </Text>
                            )}
                        </View>

                        <View className="mt-4">
                            <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.text }}>Valid Until</Text>
                            <TouchableOpacity
                                onPress={() => setDatePickerVisibility(true)}
                                className="flex-row items-center rounded-2xl px-5 py-5"
                                style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border }}
                            >
                                <CalendarIcon size={20} color={colors.text} className="mr-3" strokeWidth={2.5} />
                                <Text className="flex-1 font-extrabold text-lg" style={{ color: colors.text }}>
                                    {formData.validUntil.toLocaleDateString()}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View className="mt-4">
                            <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.text }}>Legal Terms & Conditions</Text>
                            <TextInput
                                multiline
                                numberOfLines={6}
                                value={formData.terms}
                                onChangeText={(text) => setFormData({ ...formData, terms: text })}
                                className="rounded-3xl px-5 py-5 font-bold text-base h-40"
                                style={{ 
                                    textAlignVertical: 'top',
                                    backgroundColor: colors.background,
                                    borderWidth: 2,
                                    borderColor: colors.border,
                                    color: colors.text
                                }}
                                placeholderTextColor={colors.textSecondary}
                            />
                        </View>

                        <View className="mt-4">
                            <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.text }}>Documents / References</Text>
                            <View className="flex-row flex-wrap">
                                {attachments.map((uri, index) => (
                                    <View key={index} className="w-24 h-24 rounded-2xl mr-3 mb-3 relative overflow-hidden" style={{ backgroundColor: colors.background }}>
                                        <Image source={{ uri }} className="w-full h-full" />
                                        <TouchableOpacity
                                            onPress={() => setAttachments(attachments.filter((_, i) => i !== index))}
                                            className="absolute top-1 right-1 bg-black/50 p-1.5 rounded-full"
                                        >
                                            <X size={14} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    onPress={pickImage}
                                    className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 items-center justify-center bg-surface"
                                >
                                    <UploadCloud size={24} color="#9CA3AF" />
                                    <Text className="text-[10px] items-center text-accent mt-1 font-bold uppercase">Add Photo</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={loading}
                        className={`bg-black py-6 rounded-3xl flex-row items-center justify-center mt-12 mb-12 shadow-lg ${loading ? 'opacity-50' : ''}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text className="text-white font-extrabold text-xl mr-3">
                                    {editing ? 'Update & Resubmit' : 'Create Quotation'}
                                </Text>
                                <CheckCircle2 size={24} color="white" strokeWidth={3} />
                            </>
                        )}
                    </TouchableOpacity>
                    
                    {/* Bottom spacing for nav */}
                    <View style={{ height: 120 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleDateConfirm}
                onCancel={() => setDatePickerVisibility(false)}
                minimumDate={new Date()}
            />
            
            {/* Bottom Navigation */}
            <BottomNav />
        </SafeAreaView>
    );
}
