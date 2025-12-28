import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, TextInput, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Shield, CreditCard, Bell, HelpCircle, LogOut, ChevronRight, Settings, Check, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [vendor, setVendor] = useState<any>(null);
    const [updating, setUpdating] = useState(false);

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
            icon: Bell,
            label: 'Notifications',
            subtitle: 'Alerts and updates',
            onPress: () => setNotifModal(true)
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
            <View className="px-6 py-4 flex-row justify-between items-center">
                <Text className="text-2xl font-bold text-accent-dark">Profile</Text>
                <Image
                    source={require('../../assets/icon.png')}
                    className="w-10 h-10 rounded-xl"
                    resizeMode="contain"
                />
            </View>
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
                            onPress={() => router.push('/onboarding')}
                            className="absolute bottom-1 right-1 bg-primary w-10 h-10 rounded-full items-center justify-center border-4 border-white shadow-sm"
                        >
                            <Settings size={18} color="white" />
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
                            <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">UPI ID</Text>
                            <TextInput
                                value={editData.upi_id}
                                onChangeText={(t) => setEditData({ ...editData, upi_id: t })}
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-semibold"
                                placeholder="business@upi"
                            />
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

            </ScrollView>
        </SafeAreaView>
    );
}
