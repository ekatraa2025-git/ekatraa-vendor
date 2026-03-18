import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Moon, Bell, Languages, X, Check, Sun } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { refreshTranslations } from '../lib/i18n';
import BottomNav from '../components/BottomNav';

const languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
];

export default function SettingsScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { isDarkMode, toggleDarkMode, colors } = useTheme();
    const [showLanguageModal, setShowLanguageModal] = useState(false);

    const handleLanguageSelect = async (langCode: string) => {
        // Refresh translations from backend before changing language
        await refreshTranslations();
        i18n.changeLanguage(langCode);
        setShowLanguageModal(false);
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text className="text-2xl font-bold" style={{ color: colors.text }}>{t('settings', 'Settings')}</Text>
            </View>

            <ScrollView className="flex-1 px-6">
                <View className="mt-6">
                    <Text className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: colors.textSecondary }}>Preferences</Text>

                    <View className="rounded-3xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
                        {/* Color Mode */}
                        <View className="flex-row items-center justify-between p-5" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mr-4">
                                    {isDarkMode ? <Moon size={20} color="#3B82F6" /> : <Sun size={20} color="#3B82F6" />}
                                </View>
                                <View>
                                    <Text className="font-bold text-base" style={{ color: colors.text }}>Dark Mode</Text>
                                    <Text className="text-xs" style={{ color: colors.textSecondary }}>Toggle dark/light theme</Text>
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
                            className="flex-row items-center justify-between p-5"
                            style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                        >
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center mr-4">
                                    <Languages size={20} color="#FF6B00" />
                                </View>
                                <View>
                                    <Text className="font-bold text-base" style={{ color: colors.text }}>Language</Text>
                                    <Text className="text-xs" style={{ color: colors.textSecondary }}>
                                        {languages.find(l => l.code === i18n.language)?.native || 'Select language'}
                                    </Text>
                                </View>
                            </View>
                            <View className="px-3 py-1 rounded-full" style={{ backgroundColor: isDarkMode ? colors.border : '#F3F4F6' }}>
                                <Text className="font-bold text-[10px] uppercase" style={{ color: colors.text }}>
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
                                    <Text className="font-bold text-base" style={{ color: colors.text }}>Notifications</Text>
                                    <Text className="text-xs" style={{ color: colors.textSecondary }}>System notification settings</Text>
                                </View>
                            </View>
                            <ChevronLeft size={20} color={colors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="mt-10 items-center pb-32">
                    <Text className="text-[10px] font-bold uppercase tracking-widest" style={{ color: colors.accentLight }}>Global Ekatraa Settings</Text>
                </View>
            </ScrollView>

            {/* Bottom Navigation */}
            <BottomNav />

            {/* Language Selection Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showLanguageModal}
                onRequestClose={() => setShowLanguageModal(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/50 px-6">
                    <View className="w-full rounded-[40px] p-8 shadow-2xl" style={{ backgroundColor: colors.background }}>
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-2xl font-extrabold" style={{ color: colors.text }}>{t('select_language')}</Text>
                                <Text className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: colors.textSecondary }}>App Preference</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowLanguageModal(false)}
                                className="w-10 h-10 rounded-full items-center justify-center"
                                style={{ backgroundColor: colors.surface }}
                            >
                                <X size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-4">
                            {languages.map((lang) => (
                                <TouchableOpacity
                                    key={lang.code}
                                    onPress={() => handleLanguageSelect(lang.code)}
                                    className={`flex-row items-center justify-between p-5 rounded-3xl border-2 mb-3`}
                                    style={{
                                        backgroundColor: i18n.language === lang.code ? 'rgba(255, 107, 0, 0.05)' : colors.background,
                                        borderColor: i18n.language === lang.code ? colors.primary : colors.border
                                    }}
                                >
                                    <View className="flex-row items-center">
                                        <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4`}
                                            style={{ backgroundColor: i18n.language === lang.code ? colors.primary : colors.surface }}
                                        >
                                            <Text className="font-bold text-lg"
                                                style={{ color: i18n.language === lang.code ? '#FFFFFF' : colors.textSecondary }}
                                            >
                                                {lang.native[0]}
                                            </Text>
                                        </View>
                                        <View>
                                            <Text className="font-bold text-lg"
                                                style={{ color: i18n.language === lang.code ? colors.primary : colors.text }}
                                            >
                                                {lang.native}
                                            </Text>
                                            <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>{lang.name}</Text>
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
                            className="mt-8 py-5 items-center justify-center rounded-3xl"
                            style={{ backgroundColor: isDarkMode ? colors.text : '#000000' }}
                        >
                            <Text className="font-extrabold text-lg" style={{ color: isDarkMode ? colors.background : '#FFFFFF' }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
