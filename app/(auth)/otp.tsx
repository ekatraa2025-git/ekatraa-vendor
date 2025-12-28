import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function OTPScreen() {
    const router = useRouter();
    const { phone } = useLocalSearchParams<{ phone: string }>();
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const inputs = useRef<TextInput[]>([]);

    const handleChange = (text: string, index: number) => {
        // Handle paste of full OTP
        if (text.length > 1) {
            const otpArray = text.slice(0, 6).split('');
            const newOtp = [...otp];
            otpArray.forEach((char, i) => {
                if (index + i < 6) {
                    newOtp[index + i] = char;
                }
            });
            setOtp(newOtp);

            // Focus last filled input or last input
            const lastIndex = Math.min(index + otpArray.length, 5);
            inputs.current[lastIndex]?.focus();
            return;
        }

        const newOtp = [...otp];
        newOtp[index] = text;
        setOtp(newOtp);

        // Auto focus next input
        if (text.length !== 0 && index < 5) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && otp[index] === '' && index > 0) {
            inputs.current[index - 1].focus();
        }
    };

    const handleVerify = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            Alert.alert('Invalid OTP', 'Please enter a 6-digit verification code.');
            return;
        }

        try {
            setLoading(true);
            const fullPhone = `+91${phone}`;

            const { error } = await supabase.auth.verifyOtp({
                phone: fullPhone,
                token: otpString,
                type: 'sms',
            });

            if (error) {
                Alert.alert('Verification Failed', error.message);
                return;
            }

            // Check if user already has a vendor profile
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: vendor } = await supabase
                    .from('vendors')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (vendor) {
                    // Already has profile, go to dashboard
                    router.replace('/(tabs)/dashboard');
                } else {
                    // New user, go to onboarding
                    router.replace({
                        pathname: '/onboarding',
                        params: { phone }
                    });
                }
            }
        } catch (error: any) {
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        try {
            const fullPhone = `+91${phone}`;
            const { error } = await supabase.auth.signInWithOtp({
                phone: fullPhone,
            });
            if (error) {
                Alert.alert('Error', error.message);
            } else {
                Alert.alert('Success', 'Verification code resent successfully.');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to resend code.');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <TouchableOpacity
                onPress={() => router.back()}
                className="ml-4 mt-2 p-2 w-10 h-10 items-center justify-center rounded-full bg-surface"
            >
                <ChevronLeft size={24} color="#1F2937" />
            </TouchableOpacity>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6">
                    <View className="py-8">
                        <Text className="text-3xl font-bold text-accent-dark">
                            Verify Account
                        </Text>
                        <Text className="text-accent mt-2 leading-6">
                            Enter the 6-digit code sent to{"\n"}
                            <Text className="font-bold text-accent-dark">+91 {phone}</Text>
                        </Text>
                    </View>

                    <View className="flex-row justify-between mb-12 mt-8">
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(ref) => { inputs.current[index] = ref as TextInput; }}
                                className={`w-12 h-14 border-2 rounded-xl text-center text-xl font-bold bg-surface focus:border-primary ${digit ? 'border-primary' : 'border-gray-100'}`}
                                keyboardType="number-pad"
                                maxLength={index === 0 ? 6 : 1}
                                value={digit}
                                onChangeText={(text) => handleChange(text, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                editable={!loading}
                                textContentType={index === 0 ? "oneTimeCode" : "none"}
                                autoComplete={index === 0 ? "sms-otp" : "off"}
                            />
                        ))}
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleVerify}
                        disabled={loading}
                        className={`bg-primary flex-row items-center justify-center py-4 rounded-2xl shadow-lg shadow-primary/30 mb-8 ${loading ? 'opacity-70' : ''}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text className="text-white font-bold text-lg mr-2">Verify & Continue</Text>
                                <CheckCircle2 size={20} color="white" />
                            </>
                        )}
                    </TouchableOpacity>

                    <View className="items-center">
                        <Text className="text-accent text-sm">Didn't receive code?</Text>
                        <TouchableOpacity onPress={handleResend} disabled={loading} className="mt-2">
                            <Text className="text-primary font-bold">Resend OTP</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
