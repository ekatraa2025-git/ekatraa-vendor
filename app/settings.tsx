import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Moon, Bell, Languages, X, Check, Sun } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
];

export default function SettingsScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);

    const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

    const handleLanguageSelect = (langCode: string) => {
        i18n.changeLanguage(langCode);
        setShowLanguageModal(false);
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text className="text-2xl font-bold text-accent-dark">{t('settings', 'Settings')}</Text>
            </View>

            <ScrollView className="flex-1 px-6">
                <View className="mt-6">
                    <Text className="text-sm font-bold text-accent uppercase tracking-widest mb-4">Preferences</Text>

                    <View className="bg-surface rounded-3xl overflow-hidden">
                        {/* Color Mode */}
                        <View className="flex-row items-center justify-between p-5 border-b border-gray-50">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mr-4">
                                    {isDarkMode ? <Moon size={20} color="#3B82F6" /> : <Sun size={20} color="#3B82F6" />}
                                </View>
                                <View>
                                    <Text className="text-accent-dark font-bold text-base">Dark Mode</Text>
                                    <Text className="text-accent text-xs">Toggle dark/light theme</Text>
                                </View>
                            </View>
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleDarkMode}
                                trackColor={{ false: '#E5E7EB', true: '#FF6B00' }}
                                thumbColor="#FFFFFF"
                            />
                        </View>

                        {/* Language */}
                        <TouchableOpacity
                            onPress={() => setShowLanguageModal(true)}
                            className="flex-row items-center justify-between p-5 border-b border-gray-50"
                        >
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center mr-4">
                                    <Languages size={20} color="#FF6B00" />
                                </View>
                                <View>
                                    <Text className="text-accent-dark font-bold text-base">Language</Text>
                                    <Text className="text-accent text-xs">
                                        {languages.find(l => l.code === i18n.language)?.native || 'Select language'}
                                    </Text>
                                </View>
                            </View>
                            <View className="bg-gray-100 px-3 py-1 rounded-full">
                                <Text className="text-accent-dark font-bold text-[10px] uppercase">
                                    {i18n.language.toUpperCase()}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Notifications */}
                        <TouchableOpacity
                            onPress={() => Linking.openSettings()}
                            className="flex-row items-center justify-between p-5"
                        >
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-purple-50 rounded-xl items-center justify-center mr-4">
                                    <Bell size={20} color="#8B5CF6" />
                                </View>
                                <View>
                                    <Text className="text-accent-dark font-bold text-base">Notifications</Text>
                                    <Text className="text-accent text-xs">System notification settings</Text>
                                </View>
                            </View>
                            <ChevronLeft size={20} color="#D1D5DB" style={{ transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="mt-10 items-center pb-12">
                    <Text className="text-accent-light text-[10px] font-bold uppercase tracking-widest">Global Ekatraa Settings</Text>
                </View>
            </ScrollView>

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
                                    onPress={() => handleLanguageSelect(lang.code)}
                                    className={`flex-row items-center justify-between p-5 rounded-3xl border-2 ${i18n.language === lang.code
                                        ? 'bg-primary/5 border-primary shadow-sm'
                                        : 'bg-white border-gray-100'
                                        } mb-3`}
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
                                            <Check size={14} color="white" />
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
        </SafeAreaView>
    );
}
