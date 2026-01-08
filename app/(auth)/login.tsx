import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, ArrowRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import Logo from '../../components/Logo';
import { useTheme } from '../../context/ThemeContext';

export default function LoginScreen() {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { colors } = useTheme();

    const handleSendOTP = async () => {
        if (!phone || phone.length !== 10) {
            Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
            return;
        }

        try {
            setLoading(true);
            const fullPhone = `+91${phone}`;

            const { error } = await supabase.auth.signInWithOtp({
                phone: fullPhone,
            });

            if (error) {
                Alert.alert('Error', error.message);
                return;
            }

            // Navigate to OTP screen with phone number
            router.push({
                pathname: '/(auth)/otp',
                params: { phone }
            });
        } catch (error: any) {
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6">
                    <View className="flex-1 justify-center py-12">
                        <View className="items-center mb-10">
                            <Logo width={128} height={128} />
                            <View className="mt-6 px-4">
                                <Text className="text-center text-sm font-medium italic leading-5 mb-1" style={{ color: colors.textSecondary }}>
                                    "Celebrating Togetherness with Trust and Care"
                                </Text>
                                <Text className="text-center text-sm font-medium italic leading-5 mb-1" style={{ color: colors.textSecondary }}>
                                    "विश्वास और देखभाल के साथ एकजुटता का जश्न मनाना"
                                </Text>
                                <Text className="text-center text-sm font-medium italic leading-5" style={{ color: colors.textSecondary }}>
                                    "ଏକତ୍ରୀତ ହବା ପାଇଁ ଏକତ୍ର ହିଁ ଏକମାତ୍ର ଭରୋସା ଓ ସାହାରା"
                                </Text>
                            </View>
                        </View>

                        <View className="p-6 rounded-3xl shadow-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>
                            <Text className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                                Mobile Number
                            </Text>

                            <View className="flex-row items-center rounded-2xl px-4 py-3 mb-8" style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}>
                                <View className="flex-row items-center pr-3 mr-3" style={{ borderRightWidth: 1, borderRightColor: colors.border }}>
                                    <Text className="font-semibold" style={{ color: colors.text }}>+91</Text>
                                </View>
                                <TextInput
                                    placeholder="Enter your mobile number"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                    maxLength={10}
                                    className="flex-1 font-medium h-10"
                                    style={{ color: colors.text }}
                                    editable={!loading}
                                />
                                <Phone size={20} color={colors.textSecondary} />
                            </View>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleSendOTP}
                                disabled={loading}
                                className={`bg-primary flex-row items-center justify-center py-4 rounded-2xl shadow-lg shadow-primary/30 ${loading ? 'opacity-70' : ''}`}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text className="text-white font-bold text-lg mr-2">Get OTP</Text>
                                        <ArrowRight size={20} color="white" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View className="mt-12 items-center">
                            <Text className="text-sm" style={{ color: colors.textSecondary }}>
                                By continuing, you agree to our
                            </Text>
                            <View className="flex-row mt-1">
                                <TouchableOpacity>
                                    <Text className="text-primary font-semibold text-sm">Terms of Service</Text>
                                </TouchableOpacity>
                                <Text className="text-sm mx-1" style={{ color: colors.textSecondary }}>&</Text>
                                <TouchableOpacity>
                                    <Text className="text-primary font-semibold text-sm">Privacy Policy</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
