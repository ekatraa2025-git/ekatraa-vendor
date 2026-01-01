import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, TextInput, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Shield, CreditCard, Bell, HelpCircle, LogOut, ChevronRight, Settings, Check, X, Languages } from 'lucide-react-native';
import QuickHelp from '../../components/QuickHelp';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

const languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
];

import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [vendor, setVendor] = useState<any>(null);
    const [updating, setUpdating] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);

    // Modals
    const [payoutModal, setPayoutModal] = useState(false);
    const [taxModal, setTaxModal] = useState(false);
    const [notifModal, setNotifModal] = useState(false);

    // Temporary state for editing
    const [editData, setEditData] = useState<any>({});

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/(auth)/login');
                return;
            }

            const { data, error } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                router.replace('/onboarding');
                return;
            }

            setVendor(data);
            setEditData(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (closeModal: () => void) => {
        try {
            setUpdating(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('vendors')
                .update({
                    bank_name: editData.bank_name,
                    account_number: editData.account_number,
                    ifsc_code: editData.ifsc_code,
                    upi_id: editData.upi_id,
                    gst_number: editData.gst_number,
                    pan_number: editData.pan_number,
                })
                .eq('id', user.id);

            if (error) throw error;
            setVendor({ ...vendor, ...editData });
            closeModal();
            Alert.alert('Success', 'Profile updated successfully');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update profile');
        } finally {
            setUpdating(false);
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const pickImage = async (type: 'profile' | 'service') => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [type === 'profile' ? 1 : 16, type === 'profile' ? 1 : 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            // These state setters are not defined in this file,
            // assuming they would be added or this function is a placeholder
            // for a more generic image picking logic.
            // For now, we'll just return the URI.
            return result.assets[0].uri;
        }
        return null;
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

    const handleUpdateLogo = async () => {
        try {
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (result.canceled) return;

            setUpdating(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const publicUrl = await uploadImage(result.assets[0].uri, 'logo');

            const { error } = await supabase
                .from('vendors')
                .update({ logo_url: publicUrl })
                .eq('id', user.id);

            if (error) throw error;
            setVendor({ ...vendor, logo_url: publicUrl });
            Alert.alert('Success', 'Profile photo updated successfully');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update profile photo');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#FF6B00" />
            </SafeAreaView>
        );
    }

    const menuItems = [
        {
            icon: User,
            label: 'Business Profile',
            subtitle: 'Company details and logo',
            onPress: () => router.push('/onboarding')
        },
        {
            icon: Shield,
            label: 'Identity Verification',
            subtitle: 'KYC and documents',
            badge: vendor?.is_verified ? 'Verified' : 'Pending',
            onPress: () => router.push('/onboarding/verify')
        },
        {
            icon: CreditCard,
            label: 'Payout Methods',
            subtitle: 'Bank account and UPI',
            onPress: () => setPayoutModal(true)
        },
        {
            icon: HelpCircle,
            label: 'Tax Settings',
            subtitle: 'GST and business info',
            onPress: () => setTaxModal(true)
        },
    ];

    const renderModal = (visible: boolean, setVisible: (v: boolean) => void, title: string, children: React.ReactNode, onSave: () => void) => (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={() => setVisible(false)}
        >
            <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-[40px] p-8 pb-12">
                    <View className="flex-row justify-between items-center mb-8">
                        <Text className="text-2xl font-bold text-accent-dark">{title}</Text>
                        <TouchableOpacity onPress={() => setVisible(false)}>
                            <X size={24} color="#4B5563" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {children}
                        <TouchableOpacity
                            onPress={onSave}
                            disabled={updating}
                            className="bg-primary py-5 rounded-2xl mt-10 items-center flex-row justify-center"
                        >
                            {updating ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Save Settings</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1 px-6">
                <View className="items-center py-10">
                    <View className="relative">
                        <View className="w-32 h-32 rounded-full border-4 border-surface overflow-hidden bg-surface items-center justify-center">
                            {vendor?.logo_url ? (
                                <Image
                                    source={{ uri: vendor.logo_url }}
                                    className="w-full h-full"
                                />
                            ) : (
                                <User size={64} color="#D1D5DB" />
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={handleUpdateLogo}
                            disabled={updating}
                            className="absolute bottom-1 right-1 bg-primary w-10 h-10 rounded-full items-center justify-center border-4 border-white shadow-sm"
                        >
                            {updating ? <ActivityIndicator size="small" color="white" /> : <Settings size={18} color="white" />}
                        </TouchableOpacity>
                    </View>
                    <Text className="text-2xl font-bold text-accent-dark mt-6">{vendor?.business_name || 'Business Name'}</Text>
                    <Text className="text-accent font-medium mt-1">{vendor?.category || 'Category Not Set'}</Text>

                    <View className="flex-row items-center mt-4">
                        {vendor?.is_verified ? (
                            <View className="flex-row items-center bg-green-50 px-4 py-1.5 rounded-full border border-green-100">
                                <Check size={14} color="#10B981" className="mr-2" />
                                <Text className="text-green-700 font-bold text-xs uppercase tracking-wider">Verified Vendor</Text>
                            </View>
                        ) : (
                            <View className="flex-row items-center bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100">
                                <View className="w-2 h-2 bg-orange-400 rounded-full mr-2" />
                                <Text className="text-orange-700 font-bold text-xs uppercase tracking-wider">Upgrade to Pro</Text>
                            </View>
                        )}
                    </View>
                </View>

                <QuickHelp
                    id="profile_help"
                    title="Quick Help"
                    description="Need help setting up your profile or managing bookings? Visit our help center or contact support."
                    actionText="View Walkthrough"
                    onAction={() => console.log('View Walkthrough')}
                />

                <View className="mb-8">
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={item.onPress}
                            activeOpacity={0.7}
                            className="flex-row items-center justify-between py-5 border-b border-gray-50"
                        >
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 bg-surface rounded-2xl items-center justify-center mr-4">
                                    <item.icon size={22} color="#1F2937" />
                                </View>
                                <View>
                                    <Text className="text-accent-dark font-bold text-base">{item.label}</Text>
                                    <Text className="text-accent text-xs mt-0.5">{item.subtitle}</Text>
                                </View>
                            </View>
                            <View className="flex-row items-center">
                                {item.badge && (
                                    <View className={`${item.badge === 'Verified' ? 'bg-green-100' : 'bg-orange-100'} px-3 py-1 rounded-full mr-3`}>
                                        <Text className={`${item.badge === 'Verified' ? 'text-green-700' : 'text-orange-700'} font-bold text-[10px] uppercase`}>{item.badge}</Text>
                                    </View>
                                )}
                                <ChevronRight size={20} color="#D1D5DB" />
                            </View>
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                        onPress={handleLogout}
                        className="flex-row items-center justify-between py-6"
                    >
                        <View className="flex-row items-center">
                            <View className="w-12 h-12 bg-red-50 rounded-2xl items-center justify-center mr-4">
                                <LogOut size={22} color="#EF4444" />
                            </View>
                            <View>
                                <Text className="text-red-500 font-bold text-base">Sign Out</Text>
                                <Text className="text-red-400 text-xs mt-0.5">Logout from your account</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                <View className="items-center pb-12">
                    <Text className="text-accent-light text-[10px] font-bold uppercase tracking-widest">Ekatraa Vendor App</Text>
                    <Text className="text-accent-light text-[10px] mt-1">Version 1.0.0 (42)</Text>
                </View>

                {renderModal(payoutModal, setPayoutModal, 'Payout Methods', (
                    <View className="space-y-6">
                        <View>
                            <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">Bank Name</Text>
                            <TextInput
                                value={editData.bank_name}
                                onChangeText={(t) => setEditData({ ...editData, bank_name: t })}
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-semibold"
                                placeholder="e.g. HDFC Bank"
                            />
                        </View>
                        <View className="mt-4">
                            <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">Account Number</Text>
                            <TextInput
                                value={editData.account_number}
                                onChangeText={(t) => setEditData({ ...editData, account_number: t })}
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-semibold"
                                placeholder="000000000000"
                                keyboardType="numeric"
                            />
                        </View>
                        <View className="mt-4">
                            <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">IFSC Code</Text>
                            <TextInput
                                value={editData.ifsc_code}
                                onChangeText={(t) => setEditData({ ...editData, ifsc_code: t })}
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-semibold"
                                placeholder="HDFC0001234"
                                autoCapitalize="characters"
                            />
                        </View>
                        <View className="mt-4">
                            <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">UPI ID / Mobile Number</Text>
                            <TextInput
                                value={editData.upi_id}
                                onChangeText={(t) => setEditData({ ...editData, upi_id: t })}
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-semibold"
                                placeholder="business@upi or 9876543210"
                            />
                            <Text className="text-[10px] text-accent mt-2 font-medium italic">
                                * Mobile number linked to UPI is also allowed.
                            </Text>
                        </View>
                    </View>
                ), () => handleUpdateProfile(() => setPayoutModal(false)))}

                {renderModal(taxModal, setTaxModal, 'Tax Settings', (
                    <View className="space-y-6">
                        <View>
                            <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">GST Number (Optional)</Text>
                            <TextInput
                                value={editData.gst_number}
                                onChangeText={(t) => setEditData({ ...editData, gst_number: t })}
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-semibold"
                                placeholder="22AAAAA0000A1Z5"
                                autoCapitalize="characters"
                            />
                        </View>
                        <View className="mt-4">
                            <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">PAN Number</Text>
                            <TextInput
                                value={editData.pan_number}
                                onChangeText={(t) => setEditData({ ...editData, pan_number: t })}
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-semibold"
                                placeholder="ABCDE1234F"
                                autoCapitalize="characters"
                            />
                        </View>
                    </View>
                ), () => handleUpdateProfile(() => setTaxModal(false)))}

                {renderModal(notifModal, setNotifModal, 'Notifications', (
                    <View className="space-y-6">
                        <TouchableOpacity
                            onPress={() => Linking.openSettings()}
                            className="bg-primary/10 p-6 rounded-3xl items-center border border-primary/20 mb-4"
                        >
                            <Bell size={32} color="#FF6B00" />
                            <Text className="text-primary font-bold mt-4">Manage System Settings</Text>
                            <Text className="text-accent text-xs text-center mt-2">
                                Configure alerts, badges, and sounds in your phone's notification settings.
                            </Text>
                        </TouchableOpacity>

                        <View className="flex-row items-center justify-between bg-surface p-4 rounded-2xl">
                            <View>
                                <Text className="text-accent-dark font-bold">New Booking Alerts</Text>
                                <Text className="text-accent text-[10px]">Get notified when a client books</Text>
                            </View>
                            <TouchableOpacity className="w-14 h-8 rounded-full bg-primary items-center justify-center">
                                <View className="w-6 h-6 bg-white rounded-full absolute right-1" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ), () => setNotifModal(false))}

                {/* Language Selection Modal */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={showLanguageModal}
                    onRequestClose={() => setShowLanguageModal(false)}
                >
                    <View className="flex-1 justify-center items-center bg-black/50 px-6">
                        <View className="bg-white w-full rounded-[40px] p-8 shadow-2xl">
                            <View className="flex-row justify-between items-center mb-6">
                                <View>
                                    <Text className="text-2xl font-extrabold text-accent-dark">{t('select_language')}</Text>
                                    <Text className="text-accent text-xs font-bold uppercase tracking-widest mt-1">App Preference</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setShowLanguageModal(false)}
                                    className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center"
                                >
                                    <X size={20} color="#4B5563" />
                                </TouchableOpacity>
                            </View>

                            <View className="space-y-4">
                                {languages.map((lang) => (
                                    <TouchableOpacity
                                        key={lang.code}
                                        onPress={() => {
                                            i18n.changeLanguage(lang.code);
                                            setShowLanguageModal(false);
                                        }}
                                        className={`flex-row items-center justify-between p-5 rounded-3xl border-2 ${i18n.language === lang.code
                                            ? 'bg-primary/5 border-primary shadow-sm'
                                            : 'bg-white border-gray-100'
                                            }`}
                                    >
                                        <View className="flex-row items-center">
                                            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${i18n.language === lang.code ? 'bg-primary' : 'bg-gray-100'
                                                }`}>
                                                <Text className={`font-bold text-lg ${i18n.language === lang.code ? 'text-white' : 'text-gray-500'
                                                    }`}>
                                                    {lang.native[0]}
                                                </Text>
                                            </View>
                                            <View>
                                                <Text className={`font-bold text-lg ${i18n.language === lang.code ? 'text-primary' : 'text-accent-dark'
                                                    }`}>
                                                    {lang.native}
                                                </Text>
                                                <Text className="text-accent text-xs font-bold">{lang.name}</Text>
                                            </View>
                                        </View>
                                        {i18n.language === lang.code && (
                                            <View className="w-6 h-6 bg-primary rounded-full items-center justify-center">
                                                <View className="w-2 h-2 bg-white rounded-full" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                onPress={() => setShowLanguageModal(false)}
                                className="mt-8 py-5 items-center justify-center bg-black rounded-3xl"
                            >
                                <Text className="text-white font-extrabold text-lg">Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

            </ScrollView>
        </SafeAreaView>
    );
}
