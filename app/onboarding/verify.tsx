import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, ChevronLeft, Camera, Check, Upload, Info } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';

export default function VerificationScreen() {
    const router = useRouter();
    const [aadhaar, setAadhaar] = useState('');
    const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
    const [aadhaarBack, setAadhaarBack] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const pickDocument = async (side: 'front' | 'back') => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            if (side === 'front') setAadhaarFront(result.assets[0].uri);
            else setAadhaarBack(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string, prefix: string = 'image') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const fileName = `${prefix}-${Date.now()}.jpg`;

            const formData = new FormData();
            formData.append('file', {
                uri: uri,
                name: fileName,
                type: 'image/jpeg',
            } as any);

            const { data, error } = await supabase.storage
                .from('ekatraa2025')
                .upload(fileName, formData, {
                    contentType: 'image/jpeg'
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

    const handleSubmit = async () => {
        if (aadhaar.length !== 12) {
            Alert.alert('Invalid Aadhaar', 'Please enter a valid 12-digit Aadhaar number.');
            return;
        }
        if (!aadhaarFront || !aadhaarBack) {
            Alert.alert('Documents Required', 'Please upload photos of both sides of your Aadhaar card.');
            return;
        }

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let finalFrontUrl = aadhaarFront;
            if (aadhaarFront.startsWith('file:') || aadhaarFront.startsWith('content:')) {
                finalFrontUrl = await uploadImage(aadhaarFront, 'kyc-front');
            }

            let finalBackUrl = aadhaarBack;
            if (aadhaarBack.startsWith('file:') || aadhaarBack.startsWith('content:')) {
                finalBackUrl = await uploadImage(aadhaarBack, 'kyc-back');
            }

            const { error } = await supabase
                .from('vendors')
                .update({
                    aadhaar_number: aadhaar,
                    aadhaar_front_url: finalFrontUrl,
                    aadhaar_back_url: finalBackUrl,
                })
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert(
                'Verification Submitted',
                'Your documents have been received and are under review. This usually takes 24-48 hours.',
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to submit verification.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 flex-row items-center border-b border-gray-50">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-accent-dark">Identity Verification</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView className="flex-1 px-6">
                    <View className="py-8 items-center">
                        <View className="w-20 h-20 bg-orange-50 rounded-full items-center justify-center mb-4">
                            <Shield size={40} color="#FF6B00" />
                        </View>
                        <Text className="text-center text-accent leading-5 px-4">
                            Complete your KYC to unlock higher booking limits and the verified badge on your profile.
                        </Text>
                    </View>

                    <View className="space-y-6">
                        <View>
                            <Text className="text-sm font-bold text-accent-dark mb-2">Aadhaar Number</Text>
                            <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 py-4">
                                <TextInput
                                    placeholder="Enter 12-digit Aadhaar number"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="number-pad"
                                    maxLength={12}
                                    value={aadhaar}
                                    onChangeText={setAadhaar}
                                    className="flex-1 text-black font-semibold text-base"
                                    style={{ color: '#000000' }}
                                />
                            </View>
                        </View>

                        <View className="mt-6">
                            <Text className="text-sm font-bold text-accent-dark mb-2">Upload Aadhaar Card (Front)</Text>
                            <TouchableOpacity
                                onPress={() => pickDocument('front')}
                                className="bg-surface border-2 border-dashed border-gray-200 rounded-3xl p-2 items-center justify-center overflow-hidden h-40"
                            >
                                {aadhaarFront ? (
                                    <Image source={{ uri: aadhaarFront }} className="w-full h-full rounded-2xl" resizeMode="cover" />
                                ) : (
                                    <View className="items-center">
                                        <View className="w-10 h-10 bg-white rounded-xl items-center justify-center mb-2 shadow-sm">
                                            <Upload size={20} color="#FF6B00" />
                                        </View>
                                        <Text className="text-accent-dark font-bold text-sm">Front Side</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View className="mt-6">
                            <Text className="text-sm font-bold text-accent-dark mb-2">Upload Aadhaar Card (Back)</Text>
                            <TouchableOpacity
                                onPress={() => pickDocument('back')}
                                className="bg-surface border-2 border-dashed border-gray-200 rounded-3xl p-2 items-center justify-center overflow-hidden h-40"
                            >
                                {aadhaarBack ? (
                                    <Image source={{ uri: aadhaarBack }} className="w-full h-full rounded-2xl" resizeMode="cover" />
                                ) : (
                                    <View className="items-center">
                                        <View className="w-10 h-10 bg-white rounded-xl items-center justify-center mb-2 shadow-sm">
                                            <Upload size={20} color="#FF6B00" />
                                        </View>
                                        <Text className="text-accent-dark font-bold text-sm">Back Side</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View className="bg-blue-50 p-4 rounded-2xl mt-8 flex-row items-start">
                            <Info size={18} color="#3B82F6" className="mr-3 mt-0.5" />
                            <Text className="flex-1 text-blue-800 text-xs leading-4">
                                Your data is encrypted and stored securely. We only use this for identity verification purposes as per government regulations.
                            </Text>
                        </View>
                    </View>

                    <View className="mt-12 mb-8">
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={loading}
                            className={`bg-primary py-5 rounded-2xl flex-row items-center justify-center ${loading ? 'opacity-70' : ''}`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white font-bold text-lg mr-2">Submit Document</Text>
                                    <Check size={20} color="white" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
