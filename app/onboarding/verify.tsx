import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, ChevronLeft, Camera, Check, Upload, Info, CheckCircle2, CreditCard } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import { resolveStorageImageUrl } from '../../lib/storageImageUrl';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';

// Helper function to get the correct API URL based on platform
const getApiUrl = () => {
    const envUrl = process.env.EXPO_PUBLIC_API_URL ||
        (Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL) ||
        (Constants.expoConfig?.extra?.API_URL);
    
    if (envUrl && !envUrl.includes('localhost')) {
        return envUrl;
    }
    
    // For localhost, use platform-specific addresses
    if (Platform.OS === 'android') {
        // Android emulator uses 10.0.2.2 to access host machine's localhost
        return envUrl?.replace('localhost', '10.0.2.2') || 'http://10.0.2.2:3000';
    }
    
    // iOS simulator can use localhost
    return envUrl || 'http://localhost:3000';
};

export default function VerificationScreen() {
    const router = useRouter();
    const { colors, isDarkMode } = useTheme();
    const { showToast, showAcknowledge } = useToast();
    const [aadhaar, setAadhaar] = useState('');
    const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
    const [aadhaarBack, setAadhaarBack] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [referenceId, setReferenceId] = useState<number | null>(null);
    const [otp, setOtp] = useState('');
    const [verifying, setVerifying] = useState(false);
    
    // State for verified vendor view
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [isVerified, setIsVerified] = useState(false);
    const [verifiedData, setVerifiedData] = useState<{
        aadhaar_number?: string;
        aadhaar_front_url?: string;
        aadhaar_back_url?: string;
    } | null>(null);

    // Check verification status on mount
    useEffect(() => {
        checkVerificationStatus();
    }, []);

    const checkVerificationStatus = async () => {
        try {
            setCheckingStatus(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setCheckingStatus(false);
                return;
            }

            const { data: vendor, error } = await supabase
                .from('vendors')
                .select('is_verified, aadhaar_number, aadhaar_front_url, aadhaar_back_url')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('[Verify] Error fetching vendor:', error);
                setCheckingStatus(false);
                return;
            }

            if (vendor && vendor.is_verified === true) {
                setIsVerified(true);
                setVerifiedData({
                    aadhaar_number: vendor.aadhaar_number,
                    aadhaar_front_url: vendor.aadhaar_front_url,
                    aadhaar_back_url: vendor.aadhaar_back_url,
                });
            }
        } catch (error) {
            console.error('[Verify] Error checking status:', error);
        } finally {
            setCheckingStatus(false);
        }
    };

    // Helper to get signed URL for images
    const getSignedUrl = (urlOrPath: string | null | undefined) =>
        resolveStorageImageUrl(urlOrPath, 3600);

    // State for signed image URLs
    const [frontSignedUrl, setFrontSignedUrl] = useState<string>('');
    const [backSignedUrl, setBackSignedUrl] = useState<string>('');

    // Load signed URLs when verified data changes
    useEffect(() => {
        if (verifiedData?.aadhaar_front_url) {
            getSignedUrl(verifiedData.aadhaar_front_url).then(setFrontSignedUrl);
        }
        if (verifiedData?.aadhaar_back_url) {
            getSignedUrl(verifiedData.aadhaar_back_url).then(setBackSignedUrl);
        }
    }, [verifiedData]);

    const pickDocument = async (side: 'front' | 'back', source: 'camera' | 'library' = 'library') => {
        // Request permissions first
        if (source === 'camera') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                showToast({ variant: 'warning', title: 'Permission required', message: 'Camera permission is required to take photos.' });
                return;
            }
        } else {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showToast({ variant: 'warning', title: 'Permission required', message: 'Media library permission is required to select photos.' });
                return;
            }
        }

        const options: ImagePicker.ImagePickerOptions = {
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        };

        let result;
        if (source === 'camera') {
            result = await ImagePicker.launchCameraAsync(options);
        } else {
            result = await ImagePicker.launchImageLibraryAsync(options);
        }

        if (!result.canceled) {
            if (side === 'front') setAadhaarFront(result.assets[0].uri);
            else setAadhaarBack(result.assets[0].uri);
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
                console.error('[STORAGE ERROR DETAIL]', error);
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('ekatraa2025')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error: any) {
            console.error('[UPLOAD CATCH]', error);
            throw error;
        }
    };

    const handleGenerateOTP = async () => {
        if (aadhaar.length !== 12) {
            showToast({ variant: 'warning', title: 'Invalid Aadhaar', message: 'Please enter a valid 12-digit Aadhaar number.' });
            return;
        }
        if (!aadhaarFront || !aadhaarBack) {
            showToast({ variant: 'warning', title: 'Documents required', message: 'Please upload photos of both sides of your Aadhaar card.' });
            return;
        }

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Upload images to Supabase first
            let finalFrontUrl = aadhaarFront;
            if (aadhaarFront.startsWith('file:') || aadhaarFront.startsWith('content:')) {
                finalFrontUrl = await uploadImage(aadhaarFront, 'kyc-front');
            }

            let finalBackUrl = aadhaarBack;
            if (aadhaarBack.startsWith('file:') || aadhaarBack.startsWith('content:')) {
                finalBackUrl = await uploadImage(aadhaarBack, 'kyc-back');
            }

            // Get backend API URL
            const apiUrl = getApiUrl();
            console.log('[OTP Generate] API URL:', apiUrl);
            console.log('[OTP Generate] Vendor ID:', user.id);
            console.log('[OTP Generate] Front URL:', finalFrontUrl);
            console.log('[OTP Generate] Back URL:', finalBackUrl);

            // Generate OTP via backend API (backend will update vendor record using service role key)
            const response = await fetch(`${apiUrl}/api/kyc/aadhaar/generate-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    aadhaar_number: aadhaar,
                    vendor_id: user.id,
                    aadhaar_front_url: finalFrontUrl,
                    aadhaar_back_url: finalBackUrl,
                }),
            });

            console.log('[OTP Generate] Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[OTP Generate] Response data:', data);

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate OTP');
            }

            if (data.data && data.data.reference_id) {
                setReferenceId(data.data.reference_id);
                setOtpSent(true);
                showToast({ variant: 'success', title: 'OTP sent', message: 'OTP has been sent to your registered mobile number. Please enter it to verify.' });
            } else {
                throw new Error(data.message || 'Failed to generate OTP');
            }
        } catch (error: any) {
            console.error('[OTP Generate Error]:', error);
            let errorMessage = error.message || 'Failed to generate OTP.';
            
            // Check for network errors
            if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
                showAcknowledge({
                    title: 'Network error',
                    message:
                        'Unable to connect to the server. Please check:\n\n1. Backend server is running\n2. Correct API URL is configured\n3. Device/emulator can reach the server',
                });
            } else if (error.message?.includes('Forbidden') || error.message?.includes('403')) {
                errorMessage = 'Access denied. Please check your API credentials or contact support.';
                showToast({ variant: 'error', title: 'Authentication error', message: errorMessage });
            } else {
                showToast({ variant: 'error', title: 'Could not send OTP', message: errorMessage });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        // Validate OTP format
        const otpTrimmed = otp?.trim() || '';
        if (!otpTrimmed || otpTrimmed.length !== 6 || !/^\d{6}$/.test(otpTrimmed)) {
            showToast({ variant: 'warning', title: 'Invalid OTP', message: 'Please enter a valid 6-digit numeric OTP.' });
            return;
        }

        // Check referenceId exists and is valid
        if (!referenceId) {
            showToast({ variant: 'error', title: 'Reference missing', message: 'Reference ID not found. Please generate OTP again.' });
            return;
        }
        
        // Convert referenceId to string
        const referenceIdStr = String(referenceId).trim();
        if (referenceIdStr === '') {
            showToast({ variant: 'error', title: 'Reference invalid', message: 'Reference ID is invalid. Please generate OTP again.' });
            return;
        }

        try {
            setVerifying(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get the uploaded image URLs
            const { data: vendorData } = await supabase
                .from('vendors')
                .select('aadhaar_front_url, aadhaar_back_url')
                .eq('id', user.id)
                .single();

            // Get backend API URL
            const apiUrl = getApiUrl();
            console.log('[OTP Verify] API URL:', apiUrl);
            console.log('[OTP Verify] Reference ID:', referenceId);
            console.log('[OTP Verify] Vendor ID:', user.id);

            // Verify OTP via backend API
            const requestBody = {
                reference_id: referenceIdStr,
                otp: otpTrimmed,
                vendor_id: user.id,
                aadhaar_number: aadhaar?.trim() || null,
                aadhaar_front_url: vendorData?.aadhaar_front_url || null,
                aadhaar_back_url: vendorData?.aadhaar_back_url || null,
            };

            console.log('[OTP Verify] Request body:', {
                has_reference_id: !!requestBody.reference_id,
                has_otp: !!requestBody.otp,
                otp_length: requestBody.otp?.length,
                has_vendor_id: !!requestBody.vendor_id,
            });

            const response = await fetch(`${apiUrl}/api/kyc/aadhaar/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('[OTP Verify] Response status:', response.status);

            // Get response text first to handle both JSON and non-JSON responses
            const responseText = await response.text();
            console.log('[OTP Verify] Raw response:', responseText);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = responseText ? JSON.parse(responseText) : { error: 'Unknown error' };
                } catch (parseError) {
                    // If response is not JSON, use the text as error message
                    errorData = { error: responseText || `HTTP ${response.status}: ${response.statusText}` };
                }
                throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            let data;
            try {
                data = responseText ? JSON.parse(responseText) : {};
            } catch (parseError) {
                throw new Error('Invalid response format from server');
            }
            console.log('[OTP Verify] Response data:', data);

            if (data.success) {
                // Refresh vendor data to get updated verification status
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        // Wait a moment for the backend update to complete
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Try multiple times to get updated data
                        let updatedVendor = null;
                        for (let i = 0; i < 3; i++) {
                            const { data: vendorData, error: vendorError } = await supabase
                                .from('vendors')
                                .select('is_verified, aadhaar_verified')
                                .eq('id', user.id)
                                .single();
                            
                            if (!vendorError && vendorData) {
                                updatedVendor = vendorData;
                                console.log('[OTP Verify] Updated vendor status (attempt ' + (i + 1) + '):', updatedVendor);
                                
                                // If we got the updated data, break
                                if (vendorData.is_verified && vendorData.aadhaar_verified) {
                                    break;
                                }
                            }
                            
                            // Wait before next attempt
                            if (i < 2) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                        
                        if (!updatedVendor || (!updatedVendor.is_verified || !updatedVendor.aadhaar_verified)) {
                            console.warn('[OTP Verify] Vendor status not updated yet:', updatedVendor);
                        }
                    }
                } catch (refreshError) {
                    console.warn('[OTP Verify] Could not refresh vendor data:', refreshError);
                }

                showAcknowledge({
                    title: 'Verification successful',
                    message: data.warning
                        ? `${data.message}\n\n${data.warning}`
                        : 'Your Aadhaar has been verified successfully. You are now a verified vendor.',
                    onPress: () => router.back(),
                });
            } else {
                // If verification failed, show the error
                const errorMsg = data.error || data.message || 'Verification failed';
                throw new Error(errorMsg);
            }
        } catch (error: any) {
            console.error('[OTP Verify Error]:', error);
            let errorMessage = error.message || 'OTP verification failed. Please try again.';
            
            // Check for network errors
            if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
                showAcknowledge({
                    title: 'Network error',
                    message:
                        'Unable to connect to the server. Please check:\n\n1. Backend server is running\n2. Correct API URL is configured\n3. Device/emulator can reach the server',
                });
            } else if (error.message?.includes('Forbidden') || error.message?.includes('403')) {
                errorMessage = 'Access denied. Please check your API credentials or contact support.';
                showToast({ variant: 'error', title: 'Authentication error', message: errorMessage });
            } else {
                showToast({ variant: 'error', title: 'Verification failed', message: errorMessage });
            }
        } finally {
            setVerifying(false);
        }
    };

    // Show loading state while checking verification status
    if (checkingStatus) {
        return (
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                <View className="px-6 py-4 flex-row items-center border-b" style={{ borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <ChevronLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold" style={{ color: colors.text }}>Identity Verification</Text>
                </View>
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#FF6B00" />
                    <Text className="mt-4" style={{ color: colors.textSecondary }}>Checking verification status...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Show verified state if already verified
    if (isVerified) {
        return (
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                <View className="px-6 py-4 flex-row items-center border-b" style={{ borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <ChevronLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold" style={{ color: colors.text }}>Identity Verification</Text>
                </View>

                <ScrollView className="flex-1 px-6">
                    {/* Verified Badge Section */}
                    <View className="py-8 items-center">
                        <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-4">
                            <CheckCircle2 size={50} color="#10B981" />
                        </View>
                        <Text className="text-2xl font-bold mb-2" style={{ color: colors.text }}>Verified Vendor</Text>
                        <Text className="text-center leading-5 px-4" style={{ color: colors.textSecondary }}>
                            Your identity has been verified successfully. You now have access to all vendor features.
                        </Text>
                    </View>

                    {/* Aadhaar Details Card */}
                    <View className="rounded-3xl p-6 mb-6" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                        <View className="flex-row items-center mb-4">
                            <View className="w-12 h-12 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: isDarkMode ? '#1E3A8A' : '#DBEAFE' }}>
                                <CreditCard size={24} color="#3B82F6" />
                            </View>
                            <View>
                                <Text className="text-sm font-bold uppercase tracking-widest" style={{ color: colors.textSecondary }}>Aadhaar Number</Text>
                                <Text className="text-xl font-bold mt-1" style={{ color: colors.text }}>
                                    {verifiedData?.aadhaar_number 
                                        ? `XXXX XXXX ${verifiedData.aadhaar_number.slice(-4)}` 
                                        : 'Verified'}
                                </Text>
                            </View>
                        </View>
                        
                        <View className="flex-row items-center mt-2 px-3 py-2 rounded-full" style={{ backgroundColor: '#10B98115' }}>
                            <CheckCircle2 size={16} color="#10B981" />
                            <Text className="ml-2 text-sm font-bold" style={{ color: '#10B981' }}>
                                Identity Verified via Aadhaar OTP
                            </Text>
                        </View>
                    </View>

                    {/* Aadhaar Card Images */}
                    {(frontSignedUrl || backSignedUrl) && (
                        <View className="mb-6">
                            <Text className="text-sm font-bold mb-4 uppercase tracking-widest" style={{ color: colors.text }}>Uploaded Documents</Text>
                            
                            {frontSignedUrl && (
                                <View className="mb-4">
                                    <Text className="text-xs font-bold mb-2" style={{ color: colors.textSecondary }}>Aadhaar Front</Text>
                                    <View className="rounded-2xl overflow-hidden h-44" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                                        <Image 
                                            source={{ uri: frontSignedUrl }} 
                                            className="w-full h-full" 
                                            resizeMode="cover"
                                            onError={(e) => console.error('[Verify] Front image error:', e.nativeEvent.error)}
                                        />
                                    </View>
                                </View>
                            )}
                            
                            {backSignedUrl && (
                                <View className="mb-4">
                                    <Text className="text-xs font-bold mb-2" style={{ color: colors.textSecondary }}>Aadhaar Back</Text>
                                    <View className="rounded-2xl overflow-hidden h-44" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                                        <Image 
                                            source={{ uri: backSignedUrl }} 
                                            className="w-full h-full" 
                                            resizeMode="cover"
                                            onError={(e) => console.error('[Verify] Back image error:', e.nativeEvent.error)}
                                        />
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Info Box */}
                    <View className="p-4 rounded-2xl mb-8 flex-row items-start" style={{ backgroundColor: isDarkMode ? '#064E3B' : '#D1FAE5' }}>
                        <Info size={18} color="#10B981" className="mr-3 mt-0.5" />
                        <Text className="flex-1 text-xs leading-4" style={{ color: isDarkMode ? '#6EE7B7' : '#065F46' }}>
                            Your verification documents are securely stored and encrypted. They are only used for identity verification purposes.
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="py-5 rounded-2xl flex-row items-center justify-center mb-12"
                        style={{ backgroundColor: isDarkMode ? colors.text : '#000000' }}
                    >
                        <Text className="font-bold text-lg" style={{ color: isDarkMode ? colors.background : '#FFFFFF' }}>Go Back</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Show verification form if not verified
    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4 flex-row items-center border-b" style={{ borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text className="text-xl font-bold" style={{ color: colors.text }}>Identity Verification</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled">
                    <View className="py-8 items-center">
                        <View className="w-20 h-20 bg-orange-50 rounded-full items-center justify-center mb-4">
                            <Shield size={40} color="#FF6B00" />
                        </View>
                        <Text className="text-center leading-5 px-4" style={{ color: colors.textSecondary }}>
                            Complete your KYC to unlock higher booking limits and the verified badge on your profile.
                        </Text>
                    </View>

                    <View className="space-y-6">
                        <View>
                            <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Aadhaar Number</Text>
                            <View className="flex-row items-center rounded-2xl px-4 py-4" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                <TextInput
                                    placeholder="Enter 12-digit Aadhaar number"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="number-pad"
                                    maxLength={12}
                                    value={aadhaar}
                                    onChangeText={setAadhaar}
                                    className="flex-1 font-semibold text-base"
                                    style={{ color: colors.text }}
                                />
                            </View>
                        </View>

                        <View className="mt-6">
                            <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Upload Aadhaar Card (Front)</Text>
                            {aadhaarFront ? (
                                <View className="border-2 border-dashed rounded-3xl p-2 items-center justify-center overflow-hidden h-40" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                                    <Image source={{ uri: aadhaarFront }} className="w-full h-full rounded-2xl" resizeMode="cover" />
                                    <TouchableOpacity
                                        onPress={() => setAadhaarFront(null)}
                                        className="absolute top-2 right-2 bg-red-500 rounded-full p-1"
                                    >
                                        <Text className="text-white text-xs font-bold px-2">Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View className="flex-row gap-3">
                                    <TouchableOpacity
                                        onPress={() => pickDocument('front', 'camera')}
                                        className="flex-1 border-2 border-dashed rounded-3xl p-4 items-center justify-center"
                                        style={{ backgroundColor: colors.background, borderColor: colors.border }}
                                    >
                                        <View className="w-10 h-10 rounded-xl items-center justify-center mb-2 shadow-sm" style={{ backgroundColor: colors.surface }}>
                                            <Camera size={20} color="#FF6B00" />
                                        </View>
                                        <Text className="font-bold text-xs" style={{ color: colors.text }}>Take Photo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => pickDocument('front', 'library')}
                                        className="flex-1 border-2 border-dashed rounded-3xl p-4 items-center justify-center"
                                        style={{ backgroundColor: colors.background, borderColor: colors.border }}
                                    >
                                        <View className="w-10 h-10 rounded-xl items-center justify-center mb-2 shadow-sm" style={{ backgroundColor: colors.surface }}>
                                            <Upload size={20} color="#FF6B00" />
                                        </View>
                                        <Text className="font-bold text-xs" style={{ color: colors.text }}>Upload</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        <View className="mt-6">
                            <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Upload Aadhaar Card (Back)</Text>
                            {aadhaarBack ? (
                                <View className="border-2 border-dashed rounded-3xl p-2 items-center justify-center overflow-hidden h-40" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                                    <Image source={{ uri: aadhaarBack }} className="w-full h-full rounded-2xl" resizeMode="cover" />
                                    <TouchableOpacity
                                        onPress={() => setAadhaarBack(null)}
                                        className="absolute top-2 right-2 bg-red-500 rounded-full p-1"
                                    >
                                        <Text className="text-white text-xs font-bold px-2">Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View className="flex-row gap-3">
                                    <TouchableOpacity
                                        onPress={() => pickDocument('back', 'camera')}
                                        className="flex-1 border-2 border-dashed rounded-3xl p-4 items-center justify-center"
                                        style={{ backgroundColor: colors.background, borderColor: colors.border }}
                                    >
                                        <View className="w-10 h-10 rounded-xl items-center justify-center mb-2 shadow-sm" style={{ backgroundColor: colors.surface }}>
                                            <Camera size={20} color="#FF6B00" />
                                        </View>
                                        <Text className="font-bold text-xs" style={{ color: colors.text }}>Take Photo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => pickDocument('back', 'library')}
                                        className="flex-1 border-2 border-dashed rounded-3xl p-4 items-center justify-center"
                                        style={{ backgroundColor: colors.background, borderColor: colors.border }}
                                    >
                                        <View className="w-10 h-10 rounded-xl items-center justify-center mb-2 shadow-sm" style={{ backgroundColor: colors.surface }}>
                                            <Upload size={20} color="#FF6B00" />
                                        </View>
                                        <Text className="font-bold text-xs" style={{ color: colors.text }}>Upload</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {otpSent && (
                            <View className="mt-6">
                                <Text className="text-sm font-bold mb-2" style={{ color: colors.text }}>Enter OTP</Text>
                                <View className="flex-row items-center rounded-2xl px-4 py-4" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                    <TextInput
                                        placeholder="Enter 6-digit OTP"
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        value={otp}
                                        onChangeText={setOtp}
                                        className="flex-1 font-semibold text-base"
                                        style={{ color: colors.text }}
                                    />
                                </View>
                                <Text className="text-xs mt-2" style={{ color: colors.textSecondary }}>
                                    OTP has been sent to your registered mobile number
                                </Text>
                            </View>
                        )}

                        <View className="p-4 rounded-2xl mt-8 flex-row items-start" style={{ backgroundColor: isDarkMode ? '#1E3A8A' : '#DBEAFE' }}>
                            <Info size={18} color="#3B82F6" className="mr-3 mt-0.5" />
                            <Text className="flex-1 text-xs leading-4" style={{ color: isDarkMode ? '#93C5FD' : '#1E40AF' }}>
                                Your data is encrypted and stored securely. We only use this for identity verification purposes as per government regulations.
                            </Text>
                        </View>
                    </View>

                    <View className="mt-12 mb-8">
                        {!otpSent ? (
                            <TouchableOpacity
                                onPress={handleGenerateOTP}
                                disabled={loading}
                                className={`bg-primary py-5 rounded-2xl flex-row items-center justify-center ${loading ? 'opacity-70' : ''}`}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text className="text-white font-bold text-lg mr-2">Generate OTP</Text>
                                        <Check size={20} color="white" />
                                    </>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={handleVerifyOTP}
                                disabled={verifying}
                                className={`bg-primary py-5 rounded-2xl flex-row items-center justify-center ${verifying ? 'opacity-70' : ''}`}
                            >
                                {verifying ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text className="text-white font-bold text-lg mr-2">Verify OTP</Text>
                                        <Check size={20} color="white" />
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
