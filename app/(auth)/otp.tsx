import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';

export default function OTPScreen() {
    const router = useRouter();
    const { phone } = useLocalSearchParams<{ phone: string }>();
    const { colors } = useTheme();
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);



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
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <TouchableOpacity
                onPress={() => router.back()}
                className="ml-4 mt-2 p-2 w-10 h-10 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.surface }}
            >
                <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6">
                    <View className="py-8">
                        <Text className="text-3xl font-bold" style={{ color: colors.text }}>
                            Verify Account
                        </Text>
                        <Text className="mt-2 leading-6" style={{ color: colors.textSecondary }}>
                            Enter the 6-digit code sent to{"\n"}
                            <Text className="font-bold" style={{ color: colors.text }}>+91 {phone}</Text>
                        </Text>
                    </View>

                    <View className="relative h-20 mb-12 mt-8">
                        {/* Hidden single input for autofill */}
                        <TextInput
                            className="absolute opacity-0 w-full h-full z-10"
                            keyboardType="number-pad"
                            maxLength={6}
                            value={otp.join('')}
                            onChangeText={(text) => {
                                const newOtp = text.slice(0, 6).split('').concat(Array(6).fill('')).slice(0, 6);
                                setOtp(newOtp);
                            }}
                            textContentType="oneTimeCode"
                            autoComplete="sms-otp"
                            autoFocus={true}
                            editable={!loading}
                        />
                        {/* Visual OTP Digits */}
                        <View className="flex-row justify-between w-full h-full">
                            {otp.map((digit, index) => (
                                <View
                                    key={index}
                                    className={`w-12 h-14 border-2 rounded-xl items-center justify-center`}
                                    style={{ backgroundColor: colors.surface, borderColor: digit ? '#FF6B00' : colors.border }}
                                >
                                    <Text className="text-xl font-bold" style={{ color: colors.text }}>{digit}</Text>
                                </View>
                            ))}
                        </View>
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
                        <Text className="text-sm" style={{ color: colors.textSecondary }}>Didn't receive code?</Text>
                        <TouchableOpacity onPress={handleResend} disabled={loading} className="mt-2">
                            <Text className="text-primary font-bold">Resend OTP</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
