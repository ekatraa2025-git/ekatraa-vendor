import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Plus, Store, User, MapPin, Check, Search, X, ArrowRight, ChevronDown, Tag } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { resolveStorageImageUrl } from '../../lib/storageImageUrl';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import Constants from 'expo-constants';
import { readAsStringAsync } from 'expo-file-system/legacy';

const getImageUrl = (urlOrPath: string | null | undefined) => resolveStorageImageUrl(urlOrPath, 86400);

const MOCK_LOCATIONS = [
    'Indiranagar, Bengaluru, Karnataka, India',
    'Koramangala, Bengaluru, Karnataka, India',
    'HSR Layout, Bengaluru, Karnataka, India',
    'Jayanagar, Bengaluru, Karnataka, India',
    'Whitefield, Bengaluru, Karnataka, India',
    'MG Road, Bengaluru, Karnataka, India',
    'Bhubaneswar, Odisha, India',
    'Cuttack, Odisha, India',
    'Puri, Odisha, India',
];

export default function OnboardingScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { colors } = useTheme();
    const { phone: phoneParam } = useLocalSearchParams<{ phone: string }>();
    const [step, setStep] = useState(1);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [serviceImage, setServiceImage] = useState<string | null>(null);
    const [profileImageUrl, setProfileImageUrl] = useState<string>('');
    const [serviceImageUrl, setServiceImageUrl] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [locationQuery, setLocationQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [hasServices, setHasServices] = useState(false);
    const [serviceCount, setServiceCount] = useState(0);
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [loadingCategories, setLoadingCategories] = useState(false);

    const [formData, setFormData] = useState({
        businessName: '',
        category: '',
        categoryId: '',
        description: '',
        phone: phoneParam || '',
        address: '',
        serviceName: '',
        servicePrice: '',
    });

    useEffect(() => {
        fetchInitialData();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoadingCategories(true);
            const apiUrl = process.env.EXPO_PUBLIC_API_URL ||
                (Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL) ||
                (Constants.expoConfig?.extra?.API_URL);

            if (!apiUrl) {
                console.warn('[CATEGORIES] No API URL configured');
                return;
            }

            const response = await fetch(`${apiUrl}/api/public/categories`);
            if (response.ok) {
                const apiData = await response.json();
                if (apiData && Array.isArray(apiData) && apiData.length > 0) {
                    const mappedData = apiData.map((item: any) => ({
                        id: item.id || String(item.name),
                        name: item.name || String(item.id),
                    }));
                    setCategories(mappedData);
                    return;
                }
            } else {
                const errorText = await response.text();
                console.warn('[CATEGORIES] Public categories request failed:', response.status, errorText);
            }
        } catch (error: any) {
            console.error('[CATEGORIES] Exception:', error);
        } finally {
            setLoadingCategories(false);
        }
    };

    const fetchInitialData = async () => {
        try {
            setFetching(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: vendor, error } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (vendor) {
                setFormData(prev => ({
                    ...prev,
                    businessName: vendor.business_name || prev.businessName,
                    category: vendor.category || prev.category,
                    description: vendor.description || prev.description,
                    phone: vendor.phone || prev.phone,
                    address: vendor.address || prev.address,
                }));
                if (vendor.address) setLocationQuery(vendor.address);
                if (vendor.logo_url) {
                    setProfileImage(vendor.logo_url);
                    // Load signed URL for profile image
                    if (!vendor.logo_url.startsWith('file') && !vendor.logo_url.startsWith('content')) {
                        const signedUrl = await getImageUrl(vendor.logo_url);
                        setProfileImageUrl(signedUrl);
                    }
                }
            }

            const { count } = await supabase
                .from('services')
                .select('*', { count: 'exact', head: true })
                .eq('vendor_id', user.id);

            if (count && count > 0) {
                setHasServices(true);
                setServiceCount(count);
            }
        } catch (error) {
            console.error('Error fetching initial onboarding data:', error);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (locationQuery.length > 2) {
            const filtered = MOCK_LOCATIONS.filter(loc =>
                loc.toLowerCase().includes(locationQuery.toLowerCase())
            );
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    }, [locationQuery]);

    const getCurrentLocation = async () => {
        try {
            setLoading(true);
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please allow location access to auto-fill your address.');
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            let address = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            if (address.length > 0) {
                const a = address[0];
                const fullAddress = `${a.name || ''}, ${a.street || ''}, ${a.city || ''}, ${a.region || ''}, ${a.postalCode || ''}, ${a.country || ''}`.replace(/^, |, $/g, '').replace(/, ,/g, ',');
                setLocationQuery(fullAddress);
                setFormData(prev => ({ ...prev, address: fullAddress }));
                setSuggestions([]);
            }
        } catch (error: any) {
            Alert.alert('Error', 'Could not fetch your current location.');
        } finally {
            setLoading(false);
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
            if (type === 'profile') {
                setProfileImage(result.assets[0].uri);
                setProfileImageUrl(result.assets[0].uri); // For local images, use URI directly
            } else {
                setServiceImage(result.assets[0].uri);
                setServiceImageUrl(result.assets[0].uri); // For local images, use URI directly
            }
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
                // Read file as base64 using expo-file-system
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

            // Return just the filename - we'll generate signed URLs when displaying
            return fileName;
        } catch (error: any) {
            console.error('[UPLOAD CATCH]', error);
            throw error;
        }
    };

    const handleNext = async () => {
        if (step < 3) {
            // Validate current step before advancing
            if (step === 1) {
                if (!formData.businessName?.trim()) {
                    Alert.alert('Required', 'Please enter your business name.');
                    return;
                }
                if (formData.businessName.trim().length > 100) {
                    Alert.alert('Too long', 'Business name must be under 100 characters.');
                    return;
                }
                if (formData.description && formData.description.length > 1000) {
                    Alert.alert('Too long', 'Description must be under 1000 characters.');
                    return;
                }
            }
            setStep(step + 1);
        } else {
            // Validate service price before submitting
            if (formData.serviceName && formData.servicePrice) {
                const price = parseFloat(formData.servicePrice);
                if (isNaN(price) || price <= 0) {
                    Alert.alert('Invalid price', 'Please enter a valid positive price.');
                    return;
                }
                if (price > 9999999) {
                    Alert.alert('Invalid price', 'Price cannot exceed ₹99,99,999.');
                    return;
                }
            }
            try {
                setLoading(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('No user found');

                let finalLogoUrl = profileImage;
                if (profileImage && (profileImage.startsWith('file:') || profileImage.startsWith('content:'))) {
                    finalLogoUrl = await uploadImage(profileImage, 'logo');
                } else if (profileImage && !profileImage.startsWith('http')) {
                    // If it's already a filename, keep it
                    finalLogoUrl = profileImage;
                }

                let finalServiceImageUrl = serviceImage;
                if (serviceImage && (serviceImage.startsWith('file:') || serviceImage.startsWith('content:'))) {
                    finalServiceImageUrl = await uploadImage(serviceImage, 'service');
                } else if (serviceImage && !serviceImage.startsWith('http')) {
                    // If it's already a filename, keep it
                    finalServiceImageUrl = serviceImage;
                }

                const { error: vendorError } = await supabase
                    .from('vendors')
                    .upsert({
                        id: user.id,
                        business_name: formData.businessName.trim().substring(0, 100),
                        category: formData.category,
                        phone: formData.phone,
                        address: locationQuery.substring(0, 300),
                        description: formData.description ? formData.description.substring(0, 1000) : null,
                        logo_url: finalLogoUrl,
                        status: 'active',
                        is_active: true,
                    });

                if (vendorError) throw vendorError;

                if (!hasServices && formData.serviceName && formData.servicePrice) {
                    const { error: serviceError } = await supabase
                        .from('services')
                        .insert({
                            vendor_id: user.id,
                            name: formData.serviceName.trim().substring(0, 150),
                            category: formData.category || 'Service',
                            price_amount: Math.min(parseFloat(formData.servicePrice), 9999999),
                            image_urls: finalServiceImageUrl ? [finalServiceImageUrl] : [],
                            is_active: true
                        } as any);

                    if (serviceError) throw serviceError;
                }

                router.replace('/(tabs)/dashboard');
            } catch (error: any) {
                console.error('Onboarding error:', error);
                Alert.alert('Error', error.message || 'Failed to save onboarding data.');
            } finally {
                setLoading(false);
            }
        }
    };

    const selectSuggestion = (loc: string) => {
        setFormData(prev => ({ ...prev, address: loc }));
        setLocationQuery(loc);
        setSuggestions([]);
    };

    const renderCategoryModal = () => (
        <Modal
            visible={showCategoryModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowCategoryModal(false)}
        >
            <View className="flex-1 justify-end bg-black/50">
                <View className="rounded-t-3xl h-[60%] p-6" style={{ backgroundColor: colors.surface }}>
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-xl font-bold" style={{ color: colors.text }}>{t('select_category')}</Text>
                        <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                            <X size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    {loadingCategories ? (
                        <View className="flex-1 items-center justify-center py-20">
                            <ActivityIndicator size="large" color="#FF6B00" />
                            <Text className="mt-4 font-bold" style={{ color: colors.textSecondary }}>{t('loading')}</Text>
                        </View>
                    ) : categories.length === 0 ? (
                        <View className="flex-1 items-center justify-center py-20">
                            <Text className="font-bold" style={{ color: colors.textSecondary }}>{t('no_categories_found')}</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={categories}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => {
                                        setFormData({ ...formData, category: item.name, categoryId: item.id });
                                        setShowCategoryModal(false);
                                    }}
                                    className="py-4 px-4 rounded-xl mb-2 flex-row items-center justify-between"
                                    style={{
                                        backgroundColor: formData.category === item.name ? colors.primary + '1A' : colors.background,
                                        borderWidth: formData.category === item.name ? 1 : 0,
                                        borderColor: formData.category === item.name ? colors.primary + '33' : 'transparent'
                                    }}
                                >
                                    <Text className="text-base font-bold" style={{ color: formData.category === item.name ? colors.primary : colors.text }}>
                                        {item.name}
                                    </Text>
                                    {formData.category === item.name && <Check size={20} color="#FF6B00" />}
                                </TouchableOpacity>
                            )}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );

    const renderStep1 = () => (
        <View className="flex-1">
            <Text className="text-3xl font-bold mb-2" style={{ color: colors.text }}>{t('business_profile')}</Text>
            <Text className="text-base mb-8" style={{ color: colors.textSecondary }}>{t('tell_us_about_business')}</Text>

            <View className="items-center mb-10">
                <TouchableOpacity
                    onPress={() => pickImage('profile')}
                    className="w-36 h-36 bg-surface rounded-3xl border-2 border-dashed border-gray-200 items-center justify-center overflow-hidden shadow-sm"
                >
                    {profileImageUrl ? (
                        <Image
                            source={{ uri: profileImageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                            onError={(e) => {
                                console.error('[IMAGE LOAD ERROR] Onboarding Profile:', e.nativeEvent.error, 'URI:', profileImageUrl);
                                setProfileImageUrl('');
                            }}
                        />
                    ) : profileImage && (profileImage.startsWith('file') || profileImage.startsWith('content')) ? (
                        <Image
                            source={{ uri: profileImage }}
                            className="w-full h-full"
                            resizeMode="cover"
                            onError={(e) => console.error('[IMAGE LOAD ERROR] Onboarding Profile Picked:', e.nativeEvent.error, 'URI:', profileImage)}
                        />
                    ) : (
                        <View className="items-center">
                            <Camera size={40} color="#FF6B00" strokeWidth={1.5} />
                            <Text className="text-xs mt-2 font-bold uppercase tracking-widest text-center px-4" style={{ color: colors.textSecondary }}>{t('upload_logo_or_profile')}</Text>
                        </View>
                    )}
                    <View className="absolute bottom-2 right-2 bg-primary p-2.5 rounded-2xl border-4 border-white shadow-md">
                        <Plus size={18} color="white" strokeWidth={3} />
                    </View>
                </TouchableOpacity>
            </View>

            <View className="space-y-6">
                <View>
                    <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.text }}>{t('business_name')}</Text>
                    <View className="flex-row items-center rounded-2xl px-4 py-4" style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border }}>
                        <Store size={22} color={colors.text} className="mr-3" strokeWidth={2.5} />
                        <TextInput
                            placeholder={t('business_name_placeholder')}
                            placeholderTextColor={colors.textSecondary}
                            value={formData.businessName}
                            onChangeText={(text) => setFormData({ ...formData, businessName: text })}
                            className="flex-1 font-extrabold text-lg py-1"
                            style={{ color: colors.text }}
                            maxLength={100}
                        />
                    </View>
                </View>

                <View className="mt-4">
                    <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.text }}>{t('business_category')}</Text>
                    <TouchableOpacity
                        onPress={async () => {
                            if (categories.length === 0) {
                                await fetchCategories();
                            }
                            setShowCategoryModal(true);
                        }}
                        className="flex-row items-center rounded-2xl px-4 py-4"
                        style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border }}
                    >
                        <Tag size={22} color={colors.text} className="mr-3" strokeWidth={2.5} />
                        <Text className="flex-1 font-extrabold text-lg" style={{ color: formData.category ? colors.text : colors.textSecondary }}>
                            {formData.category || t('select_category')}
                        </Text>
                        <ChevronDown size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <View className="mt-4">
                    <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.text }}>{t('brief_description')}</Text>
                    <TextInput
                        placeholder={t('description_placeholder')}
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        numberOfLines={4}
                        value={formData.description}
                        onChangeText={(text) => setFormData({ ...formData, description: text })}
                        className="rounded-3xl px-5 py-5 font-bold text-base h-32"
                        style={{
                            textAlignVertical: 'top',
                            backgroundColor: colors.background,
                            borderWidth: 2,
                            borderColor: colors.border,
                            color: colors.text
                        }}
                        maxLength={1000}
                    />
                </View>
            </View>
            {renderCategoryModal()}
        </View>
    );

    const renderStep2 = () => (
        <View className="flex-1">
            <Text className="text-3xl font-bold mb-2" style={{ color: colors.text }}>{t('location_and_contact')}</Text>
            <Text className="text-base mb-8" style={{ color: colors.textSecondary }}>{t('where_can_clients_reach')}</Text>

            <View className="space-y-6">
                <View>
                    <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.text }}>{t('official_phone_number')}</Text>
                    <View className="flex-row items-center rounded-2xl px-4 py-4" style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border }}>
                        <Text className="font-extrabold text-lg mr-3" style={{ color: colors.text }}>+91</Text>
                        <TextInput
                            value={formData.phone}
                            editable={false}
                            className="flex-1 font-extrabold text-lg py-1"
                            style={{ color: colors.text }}
                            placeholderTextColor={colors.textSecondary}
                        />
                        <View className="bg-green-100 p-1 rounded-full">
                            <Check size={16} color="#059669" strokeWidth={3} />
                        </View>
                    </View>
                    <Text className="text-green-600 text-[10px] font-bold uppercase tracking-widest mt-2 ml-1">{t('verified_phone_number')}</Text>
                </View>

                <View className="mt-4">
                    <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.text }}>{t('service_location_address')}</Text>
                    <View className="rounded-3xl p-3" style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border }}>
                        <View className="flex-row items-center justify-between px-3 py-2 mb-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text className="text-[10px] font-bold uppercase tracking-widest" style={{ color: colors.text }}>{t('pinpoint_on_map')}</Text>
                            <TouchableOpacity
                                onPress={getCurrentLocation}
                                className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-full"
                            >
                                <MapPin size={14} color="#FF6B00" strokeWidth={2.5} />
                                <Text className="text-primary text-xs font-bold ml-1">{t('auto_detect')}</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row items-start px-2 py-2">
                            <MapPin size={24} color={colors.text} className="mr-3 mt-1" strokeWidth={2} />
                            <TextInput
                                placeholder={t('search_area_or_address')}
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                numberOfLines={4}
                                value={locationQuery}
                                onChangeText={setLocationQuery}
                                className="flex-1 font-extrabold text-lg"
                                style={{ textAlignVertical: 'top', minHeight: 100, color: colors.text }}
                            />
                        </View>

                        {suggestions.length > 0 && (
                            <View className="pt-2 px-2 pb-2 mt-2" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                                {suggestions.map((loc, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => selectSuggestion(loc)}
                                        className="flex-row items-center py-4 rounded-xl px-4 mb-2"
                                        style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}
                                    >
                                        <Search size={16} color={colors.textSecondary} className="mr-3" />
                                        <Text className="font-bold text-sm flex-1" style={{ color: colors.text }} numberOfLines={1}>{loc}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );

    const renderStep3 = () => (
        <View className="flex-1">
            {hasServices ? (
                <>
                    <Text className="text-3xl font-bold text-accent-dark mb-2">{t('your_listings')}</Text>
                    <Text className="text-accent text-base mb-8">
                        {serviceCount === 1
                            ? t('you_have_service_active', { count: serviceCount })
                            : t('you_have_services_active', { count: serviceCount })
                        }
                    </Text>

                    <View className="bg-green-50 border-2 border-green-100 rounded-3xl p-10 items-center mb-8 shadow-sm">
                        <View className="w-32 h-32 rounded-full border-4 border-surface overflow-hidden bg-surface items-center justify-center mb-6">
                            {profileImageUrl ? (
                                <Image
                                    source={{ uri: profileImageUrl }}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                    onError={(e) => {
                                        console.error('[IMAGE LOAD ERROR] Onboarding Vendor Logo:', e.nativeEvent.error, 'URI:', profileImageUrl);
                                        setProfileImageUrl('');
                                    }}
                                />
                            ) : profileImage && (profileImage.startsWith('file') || profileImage.startsWith('content')) ? (
                                <Image
                                    source={{ uri: profileImage }}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                    onError={(e) => console.error('[IMAGE LOAD ERROR] Onboarding Vendor Logo Picked:', e.nativeEvent.error, 'URI:', profileImage)}
                                />
                            ) : (
                                <Check size={48} color="#059669" strokeWidth={3} />
                            )}
                        </View>
                        <Text className="text-green-900 font-extrabold text-2xl mb-2">{t('profile_ready')}</Text>
                        <Text className="text-green-700 text-center text-base font-medium leading-6">
                            {t('profile_ready_description')}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/services')}
                        className="bg-white border-2 border-gray-100 rounded-3xl p-6 flex-row items-center justify-between shadow-sm"
                    >
                        <View className="flex-1">
                            <Text className="text-accent-dark font-extrabold text-xl">{t('manage_catalog')}</Text>
                            <Text className="text-accent font-bold text-sm mt-1">{t('add_or_edit_services')}</Text>
                        </View>
                        <View className="bg-primary/10 p-3 rounded-2xl">
                            <ArrowRight size={24} color="#FF6B00" strokeWidth={2.5} />
                        </View>
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <Text className="text-3xl font-bold text-accent-dark mb-2">{t('starter_service')}</Text>
                    <Text className="text-accent text-base mb-8">{t('add_primary_listing')}</Text>

                    <TouchableOpacity
                        onPress={() => pickImage('service')}
                        className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-3 mb-8 items-center overflow-hidden shadow-sm"
                    >
                        {serviceImageUrl ? (
                            <Image
                                source={{ uri: serviceImageUrl }}
                                className="w-full h-56 rounded-2xl"
                                resizeMode="cover"
                                onError={(e) => {
                                    console.error('[IMAGE LOAD ERROR] Onboarding Service:', e.nativeEvent.error, 'URI:', serviceImageUrl);
                                    setServiceImageUrl('');
                                }}
                            />
                        ) : serviceImage && (serviceImage.startsWith('file') || serviceImage.startsWith('content')) ? (
                            <Image
                                source={{ uri: serviceImage }}
                                className="w-full h-56 rounded-2xl"
                                resizeMode="cover"
                                onError={(e) => console.error('[IMAGE LOAD ERROR] Onboarding Service Picked:', e.nativeEvent.error, 'URI:', serviceImage)}
                            />
                        ) : (
                            <View className="py-12 items-center">
                                <View className="w-20 h-20 bg-primary/10 rounded-3xl items-center justify-center mb-5">
                                    <Plus size={40} color="#FF6B00" strokeWidth={2.5} />
                                </View>
                                <Text className="text-accent-dark font-extrabold text-xl">{t('upload_cover_photo')}</Text>
                                <Text className="text-accent text-sm mt-2 font-bold px-10 text-center">{t('showcase_best_work')}</Text>
                            </View>
                        )}
                        {serviceImage && (
                            <TouchableOpacity
                                onPress={() => setServiceImage(null)}
                                className="absolute top-4 right-4 bg-black/60 p-2.5 rounded-full"
                            >
                                <X size={20} color="white" />
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>

                    <View className="space-y-6">
                        <View>
                            <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">{t('listing_name')}</Text>
                            <TextInput
                                placeholder={t('listing_name_placeholder')}
                                placeholderTextColor="#9CA3AF"
                                value={formData.serviceName}
                                onChangeText={(text) => setFormData({ ...formData, serviceName: text })}
                                className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-5 text-black font-extrabold text-lg"
                                style={{ color: '#000000' }}
                            />
                        </View>

                        <View className="mt-4">
                            <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">{t('base_package_price')}</Text>
                            <View className="flex-row items-center bg-white border-2 border-gray-100 rounded-2xl px-5 py-5">
                                <Text className="text-black font-extrabold text-xl mr-3">₹</Text>
                                <TextInput
                                    placeholder={t('price_placeholder')}
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="number-pad"
                                    value={formData.servicePrice}
                                    onChangeText={(text) => setFormData({ ...formData, servicePrice: text })}
                                    className="flex-1 text-black font-extrabold text-xl"
                                    maxLength={8}
                                />
                            </View>
                        </View>
                    </View>
                </>
            )}
        </View>
    );

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 pt-4 flex-row justify-between items-center" style={{ backgroundColor: colors.background }}>
                <Text className="font-extrabold text-sm tracking-widest uppercase" style={{ color: colors.text }}>
                    {t('registration')} • {t('step')} {step}/3
                </Text>
                <View className="flex-row">
                    {[1, 2, 3].map((s) => (
                        <View
                            key={s}
                            className={`h-1.5 rounded-full mx-1 ${step >= s ? 'w-8 bg-primary' : 'w-4'}`}
                            style={{ backgroundColor: step >= s ? '#FF6B00' : colors.border }}
                        />
                    ))}
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 pt-10 pb-12" keyboardShouldPersistTaps="handled">
                    {fetching ? (
                        <View className="flex-1 items-center justify-center py-20">
                            <ActivityIndicator size="large" color="#FF6B00" />
                            <Text className="text-accent mt-4 font-bold tracking-wider">{t('syncing_profile')}</Text>
                        </View>
                    ) : (
                        <>
                            {step === 1 && renderStep1()}
                            {step === 2 && renderStep2()}
                            {step === 3 && renderStep3()}
                        </>
                    )}

                    <View className="mt-12 mb-6">
                        <TouchableOpacity
                            onPress={handleNext}
                            disabled={loading || (step === 1 && (!formData.businessName || !formData.category))}
                            activeOpacity={0.8}
                            className={`bg-black py-6 rounded-3xl flex-row items-center justify-center shadow-lg ${loading || (step === 1 && (!formData.businessName || !formData.category)) ? 'opacity-50' : ''}`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white font-extrabold text-xl mr-3">
                                        {step === 3 ? t('finalize_registration') : t('continue')}
                                    </Text>
                                    <ArrowRight size={22} color="white" strokeWidth={3} />
                                </>
                            )}
                        </TouchableOpacity>

                        {step > 1 && (
                            <TouchableOpacity
                                onPress={() => setStep(step - 1)}
                                className="mt-6 items-center"
                            >
                                <Text className="text-accent font-extrabold text-base border-b-2 border-gray-100 pb-1">{t('previous_step')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
