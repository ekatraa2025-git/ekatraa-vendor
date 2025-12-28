import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Plus, Store, User, MapPin, Check, Search, X, ArrowRight } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore - expo-location might not have types in this environment
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';

const MOCK_LOCATIONS = [
    'Indiranagar, Bengaluru, Karnataka, India',
    'Koramangala, Bengaluru, Karnataka, India',
    'HSR Layout, Bengaluru, Karnataka, India',
    'Jayanagar, Bengaluru, Karnataka, India',
    'Whitefield, Bengaluru, Karnataka, India',
    'MG Road, Bengaluru, Karnataka, India',
];

export default function OnboardingScreen() {
    const router = useRouter();
    const { phone: phoneParam } = useLocalSearchParams<{ phone: string }>();
    const [step, setStep] = useState(1);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [serviceImage, setServiceImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [locationQuery, setLocationQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        businessName: '',
        category: '',
        description: '',
        phone: phoneParam || '',
        address: '',
        serviceName: '',
        servicePrice: '',
    });

    useEffect(() => {
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
            } catch (error) {
                console.error('Error fetching initial onboarding data:', error);
            } finally {
                setFetching(false);
            }
        };

        fetchInitialData();
    }, []);

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

    const handleNext = async () => {
        if (step < 3) {
            setStep(step + 1);
        } else {
            try {
                setLoading(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('No user found');

                // 1. Update Vendor Profile
                const { error: vendorError } = await supabase
                    .from('vendors')
                    .upsert({
                        id: user.id,
                        business_name: formData.businessName,
                        category: formData.category,
                        phone: formData.phone,
                        address: locationQuery,
                        description: formData.description,
                        logo_url: profileImage, // In real app, upload this first
                    });

                if (vendorError) throw vendorError;

                // 2. Create Initial Service
                const { error: serviceError } = await supabase
                    .from('services')
                    .insert({
                        vendor_id: user.id,
                        name: formData.serviceName,
                        category: formData.category, // Default to business category
                        price_amount: parseFloat(formData.servicePrice),
                        image_urls: serviceImage ? [serviceImage] : [],
                        is_active: true
                    } as any);

                if (serviceError) throw serviceError;

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
        setFormData({ ...formData, address: loc });
        setLocationQuery(loc);
        setSuggestions([]);
    };

    const renderStep1 = () => (
        <View className="flex-1">
            <Text className="text-2xl font-bold text-black mb-2">Business Profile</Text>
            <Text className="text-accent mb-8">Tell us about your service or business</Text>

            <View className="items-center mb-10">
                <TouchableOpacity
                    onPress={() => pickImage('profile')}
                    className="w-32 h-32 bg-surface rounded-full border-2 border-dashed border-gray-300 items-center justify-center overflow-hidden"
                >
                    {profileImage ? (
                        <Image source={{ uri: profileImage }} className="w-full h-full" />
                    ) : (
                        <View className="items-center">
                            <Camera size={32} color="#9CA3AF" />
                            <Text className="text-[10px] text-accent mt-1 uppercase font-bold">Add Logo</Text>
                        </View>
                    )}
                    <View className="absolute bottom-0 right-2 bg-primary p-2 rounded-full border-4 border-white">
                        <Plus size={16} color="white" />
                    </View>
                </TouchableOpacity>
            </View>

            <View className="space-y-6">
                <View>
                    <Text className="text-sm font-bold text-accent-dark mb-2">Business Name</Text>
                    <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 py-4">
                        <Store size={22} color="#FF6B00" className="mr-3" />
                        <TextInput
                            placeholder="e.g. Royal Catering Services"
                            placeholderTextColor="#9CA3AF"
                            value={formData.businessName}
                            onChangeText={(text) => setFormData({ ...formData, businessName: text })}
                            className="flex-1 text-black font-semibold text-base py-1"
                            style={{ color: '#000000', minHeight: 40 }}
                        />
                    </View>
                </View>

                <View className="mt-4">
                    <Text className="text-sm font-bold text-accent-dark mb-2">Category</Text>
                    <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 py-4">
                        <Plus size={22} color="#FF6B00" className="mr-3" />
                        <TextInput
                            placeholder="e.g. Venue, Catering, Decor"
                            placeholderTextColor="#9CA3AF"
                            value={formData.category}
                            onChangeText={(text) => setFormData({ ...formData, category: text })}
                            className="flex-1 text-black font-semibold text-base py-1"
                            style={{ color: '#000000', minHeight: 40 }}
                        />
                    </View>
                </View>
            </View>
        </View>
    );

    const renderStep2 = () => (
        <View className="flex-1">
            <Text className="text-2xl font-bold text-black mb-2">Contact Details</Text>
            <Text className="text-accent mb-8">Where can clients reach you?</Text>

            <View className="space-y-6">
                <View>
                    <Text className="text-sm font-bold text-accent-dark mb-2">Phone Number</Text>
                    <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4">
                        <Text className="text-accent font-bold mr-3">+91</Text>
                        <TextInput
                            value={formData.phone}
                            editable={false}
                            className="flex-1 text-black font-semibold text-base py-1"
                            style={{ color: '#000000', minHeight: 40 }}
                        />
                        <Check size={20} color="#10B981" />
                    </View>
                    <Text className="text-[10px] text-green-600 mt-2 font-bold uppercase tracking-wider">Verified Number</Text>
                </View>

                <View className="mt-4">
                    <Text className="text-sm font-bold text-accent-dark mb-2">Location / Address</Text>
                    <View className="bg-white border border-gray-200 rounded-2xl p-2">
                        <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-50">
                            <Text className="text-accent text-xs font-bold uppercase tracking-widest">Pinpoint Location</Text>
                            <TouchableOpacity
                                onPress={getCurrentLocation}
                                className="flex-row items-center"
                            >
                                <MapPin size={14} color="#FF6B00" />
                                <Text className="text-primary text-xs font-bold ml-1">Use Current</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row items-start px-2 py-2">
                            <MapPin size={22} color="#FF6B00" className="mr-3 mt-1" />
                            <TextInput
                                placeholder="Search area or enter full address"
                                placeholderTextColor="#9CA3AF"
                                multiline
                                numberOfLines={3}
                                value={locationQuery}
                                onChangeText={setLocationQuery}
                                className="flex-1 text-black font-semibold text-base"
                                style={{ color: '#000000', minHeight: 80, textAlignVertical: 'top' }}
                            />
                        </View>

                        {suggestions.length > 0 && (
                            <View className="border-t border-gray-50 pt-2 px-2 pb-2">
                                {suggestions.map((loc, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => selectSuggestion(loc)}
                                        className="flex-row items-center py-3 border-b border-gray-50 last:border-0"
                                    >
                                        <Search size={16} color="#4B5563" className="mr-3" />
                                        <Text className="text-accent-dark text-sm flex-1" numberOfLines={1}>{loc}</Text>
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
            <Text className="text-2xl font-bold text-black mb-2">First Service</Text>
            <Text className="text-accent mb-8">Add your first service to start getting bookings</Text>

            <TouchableOpacity
                onPress={() => pickImage('service')}
                className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-3xl p-2 mb-8 items-center overflow-hidden"
            >
                {serviceImage ? (
                    <Image source={{ uri: serviceImage }} className="w-full h-48 rounded-2xl" resizeMode="cover" />
                ) : (
                    <View className="py-10 items-center">
                        <View className="w-16 h-16 bg-white border border-gray-100 rounded-2xl items-center justify-center mb-4">
                            <Plus size={32} color="#FF6B00" />
                        </View>
                        <Text className="text-black font-bold text-lg">Add Service Photo</Text>
                        <Text className="text-accent text-xs mt-1">High quality photos attract 3x more bookings</Text>
                    </View>
                )}
                {serviceImage && (
                    <TouchableOpacity
                        onPress={() => setServiceImage(null)}
                        className="absolute top-4 right-4 bg-black/50 p-2 rounded-full"
                    >
                        <X size={20} color="white" />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>

            <View className="space-y-6">
                <View>
                    <Text className="text-sm font-bold text-accent-dark mb-2">Service Name</Text>
                    <TextInput
                        placeholder="e.g. Wedding Hall Rental"
                        placeholderTextColor="#9CA3AF"
                        value={formData.serviceName}
                        onChangeText={(text) => setFormData({ ...formData, serviceName: text })}
                        className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-black font-semibold text-base"
                        style={{ color: '#000000', minHeight: 56 }}
                    />
                </View>

                <View className="mt-4">
                    <Text className="text-sm font-bold text-accent-dark mb-2">Base Price (₹)</Text>
                    <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 py-4">
                        <Text className="text-black font-bold mr-2">₹</Text>
                        <TextInput
                            placeholder="e.g. 50000"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="number-pad"
                            value={formData.servicePrice}
                            onChangeText={(text) => setFormData({ ...formData, servicePrice: text })}
                            className="flex-1 text-black font-semibold text-base"
                            style={{ color: '#000000', minHeight: 40 }}
                        />
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="h-1 bg-gray-100 w-full mb-8">
                <View
                    className="h-1 bg-primary"
                    style={{ width: `${(step / 3) * 100}%` }}
                />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 pb-8">
                    <View className="flex-row items-center mb-10">
                        {[1, 2, 3].map((s) => (
                            <React.Fragment key={s}>
                                <View className={`w-10 h-10 rounded-full items-center justify-center ${step >= s ? 'bg-primary' : 'bg-gray-100'}`}>
                                    {step > s ? (
                                        <Check size={18} color="white" strokeWidth={3} />
                                    ) : (
                                        <Text className={`${step >= s ? 'text-white' : 'text-gray-400'} font-bold`}>{s}</Text>
                                    )}
                                </View>
                                {s < 3 && <View className={`h-1 flex-1 mx-2 ${step > s ? 'bg-primary' : 'bg-gray-100'}`} />}
                            </React.Fragment>
                        ))}
                    </View>

                    {fetching ? (
                        <View className="flex-1 items-center justify-center py-20">
                            <ActivityIndicator size="large" color="#FF6B00" />
                            <Text className="text-accent mt-4 font-medium">Loading your profile...</Text>
                        </View>
                    ) : (
                        <>
                            {step === 1 && renderStep1()}
                            {step === 2 && renderStep2()}
                            {step === 3 && renderStep3()}
                        </>
                    )}

                    <View className="mt-10 mb-8">
                        <TouchableOpacity
                            onPress={handleNext}
                            disabled={loading}
                            activeOpacity={0.8}
                            className={`bg-accent-dark py-5 rounded-2xl flex-row items-center justify-center ${loading ? 'opacity-70' : ''}`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white font-bold text-lg mr-2">
                                        {step === 3 ? 'Complete Setup' : 'Continue'}
                                    </Text>
                                    <ArrowRight size={20} color="white" />
                                </>
                            )}
                        </TouchableOpacity>

                        {step > 1 && (
                            <TouchableOpacity
                                onPress={() => setStep(step - 1)}
                                className="mt-5 items-center"
                            >
                                <Text className="text-accent font-bold text-base">Back to previous step</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
