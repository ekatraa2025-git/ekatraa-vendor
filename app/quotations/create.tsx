import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Calendar as CalendarIcon, FileText, Plus, X, UploadCloud, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore - Using legacy API for compatibility
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const DEFAULT_TERMS = "1. This quotation is valid for 30 days.\n2. 50% advance payment required to confirm booking.\n3. Taxes as applicable.\n4. Detailed service breakdown will be provided upon acceptance.";

export default function CreateQuotation() {
    const router = useRouter();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [services, setServices] = useState<any[]>([]);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [attachments, setAttachments] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        serviceId: '',
        amount: '',
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
        terms: DEFAULT_TERMS,
    });

    useEffect(() => {
        fetchServices();
    }, []);

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
        if (!selectedService || !formData.amount) {
            Alert.alert('Missing Info', 'Please select a service and enter an amount.');
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
            for (const uri of attachments) {
                if (uri && (uri.startsWith('file:') || uri.startsWith('content:'))) {
                    try {
                        const uploadedFileName = await uploadImage(uri, 'quotation');
                        uploadedAttachments.push(uploadedFileName);
                    } catch (uploadError: any) {
                        console.error('[UPLOAD ERROR]', uploadError);
                        // Continue with other uploads even if one fails
                    }
                } else if (uri) {
                    uploadedAttachments.push(uri);
                }
            }

            // Build insert object with only fields that exist in the table
            const quotationData: any = {
                vendor_id: user.id, // Must match auth.uid() for RLS
                service_type: selectedService.name,
                amount: parseFloat(formData.amount) || 0,
                valid_until: formData.validUntil.toISOString(),
                attachments: uploadedAttachments.length > 0 ? { general: uploadedAttachments } : {},
                vendor_tc_accepted: false,
                customer_tc_accepted: false,
                status: 'pending'
            };

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

            Alert.alert('Success', 'Quotation created successfully!', [
                { text: 'OK', onPress: () => router.replace('/quotations') }
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save quotation.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={28} color="#000000" />
                </TouchableOpacity>
                <Text className="text-2xl font-extrabold text-accent-dark">New Quotation</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView className="px-6 pb-12" showsVerticalScrollIndicator={false}>

                    <View className="mb-8">
                        <Text className="text-sm font-bold text-accent-dark mb-3 ml-1">Select Service</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {fetching ? (
                                <ActivityIndicator color="#FF6B00" />
                            ) : services.map((service) => (
                                <TouchableOpacity
                                    key={service.id}
                                    onPress={() => setSelectedService(service)}
                                    className={`mr-3 px-6 py-4 rounded-3xl border-2 ${selectedService?.id === service.id ? 'bg-primary/10 border-primary' : 'bg-surface border-gray-100'}`}
                                >
                                    <Text className={`font-extrabold text-base ${selectedService?.id === service.id ? 'text-primary' : 'text-accent-dark'}`}>
                                        {service.name}
                                    </Text>
                                    <Text className="text-accent text-[10px] mt-1 font-bold">BASE: ₹{service.price_amount}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View className="space-y-6">
                        <View>
                            <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Quotation Amount (₹)</Text>
                            <View className="flex-row items-center bg-white border-2 border-gray-100 rounded-2xl px-5 py-5">
                                <Text className="text-black font-extrabold text-xl mr-3">₹</Text>
                                <TextInput
                                    placeholder="Enter total amount"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="number-pad"
                                    value={formData.amount}
                                    onChangeText={(text) => setFormData({ ...formData, amount: text })}
                                    className="flex-1 text-black font-extrabold text-xl"
                                />
                            </View>
                            {selectedService && (
                                <Text className="text-accent text-[10px] mt-2 ml-1 font-bold italic">
                                    Include all taxes and service charges
                                </Text>
                            )}
                        </View>

                        <View className="mt-4">
                            <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Valid Until</Text>
                            <TouchableOpacity
                                onPress={() => setDatePickerVisibility(true)}
                                className="flex-row items-center bg-white border-2 border-gray-100 rounded-2xl px-5 py-5"
                            >
                                <CalendarIcon size={20} color="#000000" className="mr-3" strokeWidth={2.5} />
                                <Text className="flex-1 font-extrabold text-lg text-black">
                                    {formData.validUntil.toLocaleDateString()}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View className="mt-4">
                            <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Legal Terms & Conditions</Text>
                            <TextInput
                                multiline
                                numberOfLines={6}
                                value={formData.terms}
                                onChangeText={(text) => setFormData({ ...formData, terms: text })}
                                className="bg-white border-2 border-gray-100 rounded-3xl px-5 py-5 text-black font-bold text-base h-40"
                                style={{ textAlignVertical: 'top' }}
                            />
                        </View>

                        <View className="mt-4">
                            <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Documents / References</Text>
                            <View className="flex-row flex-wrap">
                                {attachments.map((uri, index) => (
                                    <View key={index} className="w-24 h-24 rounded-2xl bg-gray-100 mr-3 mb-3 relative overflow-hidden">
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
                                <Text className="text-white font-extrabold text-xl mr-3">Create Quotation</Text>
                                <CheckCircle2 size={24} color="white" strokeWidth={3} />
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleDateConfirm}
                onCancel={() => setDatePickerVisibility(false)}
                minimumDate={new Date()}
            />
        </SafeAreaView>
    );
}
