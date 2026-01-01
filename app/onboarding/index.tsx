import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Plus, Store, User, MapPin, Check, Search, X, ArrowRight, ChevronDown, Tag } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

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
    const { phone: phoneParam } = useLocalSearchParams<{ phone: string }>();
    const [step, setStep] = useState(1);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [serviceImage, setServiceImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [locationQuery, setLocationQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [hasServices, setHasServices] = useState(false);
    const [serviceCount, setServiceCount] = useState(0);
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);

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
            const { data, error } = await supabase
                .from('vendor_categories')
                .select('id, name')
                .order('name');
            if (data) setCategories(data);
        } catch (error) {
            console.error('Error fetching categories:', error);
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
                if (vendor.logo_url) setProfileImage(vendor.logo_url);
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
            if (type === 'profile') setProfileImage(result.assets[0].uri);
            else setServiceImage(result.assets[0].uri);
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

    const handleNext = async () => {
        if (step < 3) {
            setStep(step + 1);
        } else {
            try {
                setLoading(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('No user found');

                let finalLogoUrl = profileImage;
                if (profileImage && (profileImage.startsWith('file:') || profileImage.startsWith('content:'))) {
                    finalLogoUrl = await uploadImage(profileImage, 'logo');
                }

                let finalServiceImageUrl = serviceImage;
                if (serviceImage && (serviceImage.startsWith('file:') || serviceImage.startsWith('content:'))) {
                    finalServiceImageUrl = await uploadImage(serviceImage, 'service');
                }

                const { error: vendorError } = await supabase
                    .from('vendors')
                    .upsert({
                        id: user.id,
                        business_name: formData.businessName,
                        category: formData.category,
                        phone: formData.phone,
                        address: locationQuery,
                        description: formData.description,
                        logo_url: finalLogoUrl,
                    });

                if (vendorError) throw vendorError;

                if (!hasServices && formData.serviceName && formData.servicePrice) {
                    const { error: serviceError } = await supabase
                        .from('services')
                        .insert({
                            vendor_id: user.id,
                            name: formData.serviceName,
                            category: formData.category || 'Service',
                            price_amount: parseFloat(formData.servicePrice),
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
                <View className="bg-white rounded-t-3xl h-[60%] p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-xl font-bold text-accent-dark">Select Category</Text>
                        <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                            <X size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={categories}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => {
                                    setFormData({ ...formData, category: item.name, categoryId: item.id });
                                    setShowCategoryModal(false);
                                }}
                                className={`py-4 px-4 rounded-xl mb-2 flex-row items-center justify-between ${formData.category === item.name ? 'bg-primary/10 border border-primary/20' : 'bg-gray-50'}`}
                            >
                                <Text className={`text-base font-bold ${formData.category === item.name ? 'text-primary' : 'text-accent-dark'}`}>
                                    {item.name}
                                </Text>
                                {formData.category === item.name && <Check size={20} color="#FF6B00" />}
                            </TouchableOpacity>
                        )}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </View>
        </Modal>
    );

    const renderStep1 = () => (
        <View className="flex-1">
            <Text className="text-3xl font-bold text-accent-dark mb-2">Business Profile</Text>
            <Text className="text-accent text-base mb-8">Tell us about your service or business</Text>

            <View className="items-center mb-10">
                <TouchableOpacity
                    onPress={() => pickImage('profile')}
                    className="w-36 h-36 bg-surface rounded-3xl border-2 border-dashed border-gray-200 items-center justify-center overflow-hidden shadow-sm"
                >
                    {profileImage ? (
                        <Image source={{ uri: profileImage }} className="w-full h-full" />
                    ) : (
                        <View className="items-center">
                            <Camera size={40} color="#FF6B00" strokeWidth={1.5} />
                            <Text className="text-xs text-accent mt-2 font-bold uppercase tracking-widest text-center px-4">Upload Logo or Profile Picture</Text>
                        </View>
                    )}
                    <View className="absolute bottom-2 right-2 bg-primary p-2.5 rounded-2xl border-4 border-white shadow-md">
                        <Plus size={18} color="white" strokeWidth={3} />
                    </View>
                </TouchableOpacity>
            </View>

            <View className="space-y-6">
                <View>
                    <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Business Name</Text>
                    <View className="flex-row items-center bg-white border-2 border-gray-100 rounded-2xl px-4 py-4 focus:border-primary">
                        <Store size={22} color="#000000" className="mr-3" strokeWidth={2.5} />
                        <TextInput
                            placeholder="e.g. Royal Catering Services"
                            placeholderTextColor="#9CA3AF"
                            value={formData.businessName}
                            onChangeText={(text) => setFormData({ ...formData, businessName: text })}
                            className="flex-1 text-black font-extrabold text-lg py-1"
                            style={{ color: '#000000' }}
                        />
                    </View>
                </View>

                <View className="mt-4">
                    <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Business Category</Text>
                    <TouchableOpacity
                        onPress={() => setShowCategoryModal(true)}
                        className="flex-row items-center bg-white border-2 border-gray-100 rounded-2xl px-4 py-4"
                    >
                        <Tag size={22} color="#000000" className="mr-3" strokeWidth={2.5} />
                        <Text className={`flex-1 font-extrabold text-lg ${formData.category ? 'text-black' : 'text-gray-400'}`}>
                            {formData.category || 'Select Category'}
                        </Text>
                        <ChevronDown size={22} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                <View className="mt-4">
                    <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Brief Description</Text>
                    <TextInput
                        placeholder="Tell clients what makes you special..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={4}
                        value={formData.description}
                        onChangeText={(text) => setFormData({ ...formData, description: text })}
                        className="bg-white border-2 border-gray-100 rounded-3xl px-5 py-5 text-black font-bold text-base h-32"
                        style={{ textAlignVertical: 'top' }}
                    />
                </View>
            </View>
            {renderCategoryModal()}
        </View>
    );

    const renderStep2 = () => (
        <View className="flex-1">
            <Text className="text-3xl font-bold text-accent-dark mb-2">Location & Contact</Text>
            <Text className="text-accent text-base mb-8">Where can clients reach you?</Text>

            <View className="space-y-6">
                <View>
                    <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Official Phone Number</Text>
                    <View className="flex-row items-center bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-4">
                        <Text className="text-accent font-extrabold text-lg mr-3">+91</Text>
                        <TextInput
                            value={formData.phone}
                            editable={false}
                            className="flex-1 text-black font-extrabold text-lg py-1"
                        />
                        <View className="bg-green-100 p-1 rounded-full">
                            <Check size={16} color="#059669" strokeWidth={3} />
                        </View>
                    </View>
                    <Text className="text-green-600 text-[10px] font-bold uppercase tracking-widest mt-2 ml-1">✓ Verified Phone Number</Text>
                </View>

                <View className="mt-4">
                    <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Service Location / Address</Text>
                    <View className="bg-white border-2 border-gray-100 rounded-3xl p-3">
                        <View className="flex-row items-center justify-between px-3 py-2 border-b border-gray-100 mb-2">
                            <Text className="text-accent text-[10px] font-bold uppercase tracking-widest">Pinpoint on Map</Text>
                            <TouchableOpacity
                                onPress={getCurrentLocation}
                                className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-full"
                            >
                                <MapPin size={14} color="#FF6B00" strokeWidth={2.5} />
                                <Text className="text-primary text-xs font-bold ml-1">Auto-detect</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row items-start px-2 py-2">
                            <MapPin size={24} color="#000000" className="mr-3 mt-1" strokeWidth={2} />
                            <TextInput
                                placeholder="Search area or enter full address..."
                                placeholderTextColor="#9CA3AF"
                                multiline
                                numberOfLines={4}
                                value={locationQuery}
                                onChangeText={setLocationQuery}
                                className="flex-1 text-black font-extrabold text-lg"
                                style={{ textAlignVertical: 'top', minHeight: 100 }}
                            />
                        </View>

                        {suggestions.length > 0 && (
                            <View className="border-t border-gray-50 pt-2 px-2 pb-2 mt-2">
                                {suggestions.map((loc, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => selectSuggestion(loc)}
                                        className="flex-row items-center py-4 border-b border-gray-50 bg-gray-50/50 rounded-xl px-4 mb-2"
                                    >
                                        <Search size={16} color="#4B5563" className="mr-3" />
                                        <Text className="text-accent-dark font-bold text-sm flex-1" numberOfLines={1}>{loc}</Text>
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
                    <Text className="text-3xl font-bold text-accent-dark mb-2">Your Listings</Text>
                    <Text className="text-accent text-base mb-8">You have {serviceCount} service{serviceCount > 1 ? 's' : ''} active</Text>

                    <View className="bg-green-50 border-2 border-green-100 rounded-3xl p-10 items-center mb-8 shadow-sm">
                        <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
                            <Check size={48} color="#059669" strokeWidth={3} />
                        </View>
                        <Text className="text-green-900 font-extrabold text-2xl mb-2">Profile Ready!</Text>
                        <Text className="text-green-700 text-center text-base font-medium leading-6">
                            Your existing services are listed. You're ready to start receiving new bookings.
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/services')}
                        className="bg-white border-2 border-gray-100 rounded-3xl p-6 flex-row items-center justify-between shadow-sm"
                    >
                        <View className="flex-1">
                            <Text className="text-accent-dark font-extrabold text-xl">Manage Catalog</Text>
                            <Text className="text-accent font-bold text-sm mt-1">Add or edit more services</Text>
                        </View>
                        <View className="bg-primary/10 p-3 rounded-2xl">
                            <ArrowRight size={24} color="#FF6B00" strokeWidth={2.5} />
                        </View>
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <Text className="text-3xl font-bold text-accent-dark mb-2">Starter Service</Text>
                    <Text className="text-accent text-base mb-8">Add your primary listing to get started</Text>

                    <TouchableOpacity
                        onPress={() => pickImage('service')}
                        className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-3 mb-8 items-center overflow-hidden shadow-sm"
                    >
                        {serviceImage ? (
                            <Image source={{ uri: serviceImage }} className="w-full h-56 rounded-2xl" resizeMode="cover" />
                        ) : (
                            <View className="py-12 items-center">
                                <View className="w-20 h-20 bg-primary/10 rounded-3xl items-center justify-center mb-5">
                                    <Plus size={40} color="#FF6B00" strokeWidth={2.5} />
                                </View>
                                <Text className="text-accent-dark font-extrabold text-xl">Upload Cover Photo</Text>
                                <Text className="text-accent text-sm mt-2 font-bold px-10 text-center">Showcase your best work to attract high-value clients.</Text>
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
                            <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Listing Name</Text>
                            <TextInput
                                placeholder="e.g. Premium Wedding Photography"
                                placeholderTextColor="#9CA3AF"
                                value={formData.serviceName}
                                onChangeText={(text) => setFormData({ ...formData, serviceName: text })}
                                className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-5 text-black font-extrabold text-lg"
                                style={{ color: '#000000' }}
                            />
                        </View>

                        <View className="mt-4">
                            <Text className="text-sm font-bold text-accent-dark mb-2 ml-1">Base Package Price (₹)</Text>
                            <View className="flex-row items-center bg-white border-2 border-gray-100 rounded-2xl px-5 py-5">
                                <Text className="text-black font-extrabold text-xl mr-3">₹</Text>
                                <TextInput
                                    placeholder="e.g. 25000"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="number-pad"
                                    value={formData.servicePrice}
                                    onChangeText={(text) => setFormData({ ...formData, servicePrice: text })}
                                    className="flex-1 text-black font-extrabold text-xl"
                                />
                            </View>
                        </View>
                    </View>
                </>
            )}
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 pt-4 flex-row justify-between items-center bg-white">
                <Text className="text-accent-dark font-extrabold text-sm tracking-widest uppercase">
                    Registration • Step {step}/3
                </Text>
                <View className="flex-row">
                    {[1, 2, 3].map((s) => (
                        <View
                            key={s}
                            className={`h-1.5 rounded-full mx-1 ${step >= s ? 'w-8 bg-primary' : 'w-4 bg-gray-100'}`}
                        />
                    ))}
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 pt-10 pb-12">
                    {fetching ? (
                        <View className="flex-1 items-center justify-center py-20">
                            <ActivityIndicator size="large" color="#FF6B00" />
                            <Text className="text-accent mt-4 font-bold tracking-wider">Syncing your profile...</Text>
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
                                        {step === 3 ? 'Finalize Registration' : 'Continue'}
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
                                <Text className="text-accent font-extrabold text-base border-b-2 border-gray-100 pb-1">Previous Step</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
