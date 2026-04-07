import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle2 } from 'lucide-react-native';
import { recoverFromAuthStorageError, supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';

export default function OTPScreen() {
    const router = useRouter();
    const { phone } = useLocalSearchParams<{ phone: string }>();
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(60);
    const [resendLoading, setResendLoading] = useState(false);



    const handleVerify = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            showToast({ variant: 'warning', title: 'Invalid OTP', message: 'Please enter a 6-digit verification code.' });
            return;
        }

        try {
            setLoading(true);
            const fullPhone = `+91${phone}`;

            const { data: verifyData, error } = await supabase.auth.verifyOtp({
                phone: fullPhone,
                token: otpString,
                type: 'sms',
            });

            if (error) {
                showToast({ variant: 'error', title: 'Verification failed', message: error.message });
                return;
            }

            // Persist session immediately so the next screen always reads a stored session (avoids race with SecureStore).
            if (
                verifyData?.session?.access_token &&
                verifyData?.session?.refresh_token &&
                typeof supabase.auth.setSession === 'function'
            ) {
                const { error: sessionErr } = await supabase.auth.setSession({
                    access_token: verifyData.session.access_token,
                    refresh_token: verifyData.session.refresh_token,
                });
                if (sessionErr) {
                    console.warn('[OTP] setSession after verify:', sessionErr.message);
                }
            }

            let user = verifyData?.session?.user ?? verifyData?.user ?? null;
            if (!user) {
                const { data: { user: u2 }, error: userErr } = await supabase.auth.getUser();
                if (userErr) {
                    await recoverFromAuthStorageError(userErr);
                    showToast({ variant: 'error', title: 'Session error', message: 'Please try again.' });
                    return;
                }
                user = u2;
            }
            if (!user) {
                showToast({ variant: 'error', title: 'Session error', message: 'Could not complete sign-in. Please try again.' });
                return;
            }

            const { data: vendor } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', user.id)
                .single();

            if (vendor) {
                router.replace('/(tabs)/dashboard');
            } else {
                router.replace({
                    pathname: '/onboarding',
                    params: { phone }
                });
            }
        } catch (error: any) {
            showToast({ variant: 'error', title: 'Something went wrong', message: 'Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleResend = async () => {
        if (resendCooldown > 0 || resendLoading) return;
        setResendLoading(true);
        try {
            const fullPhone = `+91${phone}`;
            const { error } = await supabase.auth.signInWithOtp({
                phone: fullPhone,
            });
            if (error) {
                showToast({ variant: 'error', title: 'Could not resend', message: error.message });
            } else {
                setResendCooldown(60);
                showToast({ variant: 'success', title: 'Code sent', message: 'Verification code resent successfully.' });
            }
        } catch (error) {
            showToast({ variant: 'error', title: 'Could not resend', message: 'Failed to resend code.' });
        } finally {
            setResendLoading(false);
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
                        <TouchableOpacity onPress={handleResend} disabled={loading || resendCooldown > 0 || resendLoading} className="mt-2">
                            <Text className="text-primary font-bold" style={{ opacity: (resendCooldown > 0 || resendLoading) ? 0.4 : 1 }}>
                                {resendLoading ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
