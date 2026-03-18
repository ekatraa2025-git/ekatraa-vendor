import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, FlatList, ActivityIndicator, Modal, TextInput, Alert, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Edit3, Trash2, Eye, Star, ChevronRight, X, Check, Store, ChevronDown } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { readAsStringAsync } from 'expo-file-system/legacy';
import Constants from 'expo-constants';

import * as ImagePicker from 'expo-image-picker';

const PRICING_TIER_LABELS: Record<string, string> = {
    basic: 'Basic',
    classic_value: 'Classic Value',
    signature: 'Signature',
    prestige: 'Prestige',
    royal: 'Royal',
    imperial: 'Imperial',
    standard: 'Signature',
    premium: 'Prestige',
};
function getPricingTierLabel(key: string): string {
    return PRICING_TIER_LABELS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ') : '');
}

export default function ServicesScreen() {
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState<any[]>([]);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingService, setEditingService] = useState<any>(null);
    const [isNew, setIsNew] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [previewServiceData, setPreviewServiceData] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
    const [catalogServices, setCatalogServices] = useState<any[]>([]);
    const [catalogServicePickerVisible, setCatalogServicePickerVisible] = useState(false);
    const [pricingTypePickerVisible, setPricingTypePickerVisible] = useState(false);
    const [selectedCatalogService, setSelectedCatalogService] = useState<any>(null);
    // Cache for image URLs to avoid repeated API calls
    const imageUrlCache: { [key: string]: string } = {};

    useEffect(() => {
        console.log('[DEBUG] ServicesScreen mounted');
        fetchServices();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL ||
                (Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL) ||
                (Constants.expoConfig?.extra?.API_URL);

            if (apiUrl) {
                // Prefer new flow: /api/public/categories (catalog categories)
                let response = await fetch(`${apiUrl}/api/public/categories`);
                if (response.ok) {
                    const apiData = await response.json();
                    if (apiData && Array.isArray(apiData) && apiData.length > 0) {
                        const mappedData = apiData.map((item: any) => ({
                            id: item.id || String(item.name),
                            name: item.name || String(item.id),
                            icon_url: item.icon_url,
                            display_order: item.display_order,
                        }));
                        setCategories(mappedData);
                        return;
                    }
                }
                // Fallback: legacy /api/categories (vendor_categories)
                response = await fetch(`${apiUrl}/api/categories`);
                if (response.ok) {
                    const apiData = await response.json();
                    if (apiData && Array.isArray(apiData) && apiData.length > 0) {
                        const mappedData = apiData.map((item: any) => ({
                            id: item.id || String(item.name),
                            name: item.name || String(item.id)
                        }));
                        setCategories(mappedData);
                        return;
                    }
                }
            }
            console.warn('[CATEGORIES] Failed to fetch categories from API');
        } catch (error) {
            console.error('[CATEGORIES] Error fetching categories:', error);
        }
    };

    const fetchCatalogServices = async (categoryId: string) => {
        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL ||
                (Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL) ||
                (Constants.expoConfig?.extra?.API_URL);

            if (apiUrl) {
                const response = await fetch(`${apiUrl}/api/public/services?category_id=${categoryId}`);
                if (response.ok) {
                    const data = await response.json();
                    setCatalogServices(Array.isArray(data) ? data : []);
                    return;
                }
            }
            console.warn('[CATALOG_SERVICES] Failed to fetch catalog services from API');
        } catch (error) {
            console.error('[CATALOG_SERVICES] Error fetching catalog services:', error);
        }
        setCatalogServices([]);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchServices();
        setRefreshing(false);
    };

    // Helper function to get signed URL from file path or existing URL
    const getImageUrl = async (urlOrPath: string | null | undefined): Promise<string> => {
        if (!urlOrPath) return '';

        try {
            // Check cache first
            if (imageUrlCache[urlOrPath]) {
                return imageUrlCache[urlOrPath];
            }

            let fileName = urlOrPath;

            // If it's already a full URL, extract the filename
            if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
                // If it's already a signed URL with token, return as-is
                if (urlOrPath.includes('token=')) {
                    imageUrlCache[urlOrPath] = urlOrPath;
                    return urlOrPath;
                }
                // Extract filename from Supabase storage URL
                // Format: https://...supabase.co/storage/v1/object/public/ekatraa2025/filename.jpg
                const urlMatch = urlOrPath.match(/\/ekatraa2025\/([^/?]+)/);
                if (urlMatch && urlMatch[1]) {
                    fileName = urlMatch[1];
                } else {
                    // Otherwise try to extract filename from end of URL
                    fileName = urlOrPath.split('/').pop()?.split('?')[0] || urlOrPath;
                }
            } else if (urlOrPath.includes('/')) {
                // Extract filename from path
                fileName = urlOrPath.split('/').pop() || urlOrPath;
            }

            // Generate signed URL (valid for 24 hours for better caching)
            try {
                const { data, error } = await supabase.storage
                    .from('ekatraa2025')
                    .createSignedUrl(fileName, 86400); // 24 hours expiry for faster loading

                if (error) {
                    console.error('[SIGNED URL ERROR]', error, 'fileName:', fileName);
                    // Fallback to public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('ekatraa2025')
                        .getPublicUrl(fileName);
                    imageUrlCache[urlOrPath] = publicUrl;
                    return publicUrl;
                }

                if (data && data.signedUrl) {
                    imageUrlCache[urlOrPath] = data.signedUrl;
                    return data.signedUrl;
                }
            } catch (storageError: any) {
                console.error('[STORAGE API ERROR]', storageError);
                // Fallback to public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('ekatraa2025')
                    .getPublicUrl(fileName);
                return publicUrl;
            }

            return urlOrPath; // Return original if all fails
        } catch (error) {
            console.error('[GET IMAGE URL ERROR]', error);
            return urlOrPath; // Return original if all fails
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

            console.log('[DEBUG] Upload successful:', fileName);
            // Return just the filename - we'll generate signed URLs when displaying
            return fileName;
        } catch (error: any) {
            console.error('[UPLOAD CATCH]', error);
            throw error;
        }
    };

    const fetchServices = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('services')
                .select('*')
                .eq('vendor_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setServices(data || []);
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
        }
    };

    const openPreviewModal = (service: any) => {
        setPreviewServiceData(service);
        setPreviewModalVisible(true);
    };

    const handleSaveService = async () => {
        if (isNew && (!editingService?.category || !editingService?.name || !editingService?.price_amount)) {
            Alert.alert('Required Fields', 'Please select category, catalog service, and pricing tier.');
            return;
        }
        if (!isNew && (!editingService?.name || !editingService?.price_amount)) {
            Alert.alert('Required Fields', 'Please enter service name and price.');
            return;
        }

        try {
            setUpdating(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let imageUrls = (editingService.image_urls || []).filter((uri: string) => uri && !uri.startsWith('file') && !uri.startsWith('content'));
            if (selectedImage) {
                const uploadedUrl = await uploadImage(selectedImage, 'service');
                imageUrls = [uploadedUrl];
            }

            const serviceData: any = {
                name: editingService.name,
                price_amount: parseFloat(editingService.price_amount),
                category: editingService.category || 'Service',
                is_active: editingService.is_active ?? true,
                image_urls: imageUrls,
                vendor_id: user.id
            };
            if (editingService.pricing_type) serviceData.pricing_type = editingService.pricing_type;
            if (editingService.offerable_service_id) serviceData.offerable_service_id = editingService.offerable_service_id;

            let error;
            if (isNew) {
                const { error: insertError } = await supabase
                    .from('services')
                    .insert([serviceData]);
                error = insertError;
            } else {
                const { error: updateError } = await supabase
                    .from('services')
                    .update(serviceData)
                    .eq('id', editingService.id);
                error = updateError;
            }

            if (error) throw error;

            setEditModalVisible(false);
            fetchServices();
            Alert.alert('Success', `Service ${isNew ? 'created' : 'updated'} successfully`);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save service');
        } finally {
            setUpdating(false);
        }
    };

    const deleteService = async (id: string) => {
        Alert.alert(
            'Delete Service',
            'Are you sure you want to delete this service?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('services')
                                .delete()
                                .eq('id', id);

                            if (error) throw error;
                            setServices(services.filter(s => s.id !== id));
                        } catch (error) {
                            console.error('Error deleting service:', error);
                        }
                    }
                }
            ]
        );
    };

    const openAddModal = () => {
        setEditingService({ name: '', price_amount: '', category: '', category_id: '', pricing_type: '', offerable_service_id: '', is_active: true });
        setIsNew(true);
        setSelectedImage(null);
        setSelectedCatalogService(null);
        setCatalogServices([]);
        setEditModalVisible(true);
    };

    const openEditModal = (service: any) => {
        setEditingService(service);
        setIsNew(false);
        setSelectedImage(null);
        setEditModalVisible(true);
    };

    // Component to handle image loading with signed URLs
    const ServiceImage = ({ imageUrl }: { imageUrl: string | null | undefined }) => {
        const [displayUrl, setDisplayUrl] = useState<string>('');
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            const loadImage = async () => {
                setLoading(true);
                if (!imageUrl || imageUrl.startsWith('file') || imageUrl.startsWith('content')) {
                    setLoading(false);
                    return;
                }
                try {
                    const url = await getImageUrl(imageUrl);
                    if (url) {
                        setDisplayUrl(url);
                    }
                } catch (error) {
                    console.error('[SERVICE IMAGE LOAD ERROR]', error);
                } finally {
                    setLoading(false);
                }
            };
            loadImage();
        }, [imageUrl]);

        const { colors } = useTheme();
        
        if (!imageUrl) {
            return (
                <View className="w-full h-48 items-center justify-center" style={{ backgroundColor: colors.surface }}>
                    <View className="items-center">
                        <Store size={40} color={colors.textSecondary} />
                        <Text className="text-xs mt-2 font-bold" style={{ color: colors.textSecondary }}>No Image</Text>
                    </View>
                </View>
            );
        }

        return (
            <View className="w-full h-48 relative" style={{ backgroundColor: colors.surface }}>
                {loading ? (
                    <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: colors.surface }}>
                        <ActivityIndicator size="large" color="#FF6B00" />
                    </View>
                ) : displayUrl ? (
                    <Image
                        source={{ uri: displayUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                        onError={(e) => {
                            console.error('[IMAGE LOAD ERROR] Service:', e.nativeEvent.error, 'URI:', displayUrl);
                            setDisplayUrl('');
                        }}
                    />
                ) : (
                    <View className="w-full h-full items-center justify-center" style={{ backgroundColor: colors.surface }}>
                        <View className="items-center">
                            <Store size={40} color={colors.textSecondary} />
                            <Text className="text-xs mt-2 font-bold" style={{ color: colors.textSecondary }}>Image Not Available</Text>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderServiceCard = ({ item }: { item: any }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => openPreviewModal(item)}
            className="rounded-[32px] overflow-hidden mb-6 shadow-sm"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
            <View className="relative">
                <ServiceImage imageUrl={item.image_urls?.[0]} />
                <View className="absolute top-4 right-4 px-3 py-1 rounded-full flex-row items-center" style={{ backgroundColor: colors.surface + 'E6' }}>
                    <Star size={12} color="#FF6B00" fill="#FF6B00" />
                    <Text className="text-[10px] font-bold ml-1" style={{ color: colors.text }}>4.8</Text>
                </View>
                <View className={`absolute top-4 left-4 ${item.is_active ? 'bg-green-500' : 'bg-gray-400'} px-3 py-1 rounded-full`}>
                    <Text className="text-white text-[10px] font-bold uppercase">{item.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
            </View>

            <View className="p-6">
                <View className="flex-row justify-between items-start">
                    <View className="flex-1 mr-4">
                        <Text className="text-[10px] uppercase font-bold tracking-widest" style={{ color: colors.textSecondary }}>{item.category || 'Service'}</Text>
                        <Text className="text-xl font-bold mt-1" numberOfLines={1} style={{ color: colors.text }}>{item.name}</Text>
                    </View>
                    <Text className="font-bold text-lg" style={{ color: colors.primary }}>₹{item.price_amount}</Text>
                </View>

                <View className="flex-row items-center mt-6 pt-6" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                    <TouchableOpacity
                        onPress={() => openEditModal(item)}
                        className="flex-1 flex-row items-center justify-center py-2"
                    >
                        <Edit3 size={18} color={colors.textSecondary} />
                        <Text className="font-semibold ml-2" style={{ color: colors.textSecondary }}>Edit</Text>
                    </TouchableOpacity>
                    <View className="w-[1px] h-6" style={{ backgroundColor: colors.border }} />
                    <TouchableOpacity
                        onPress={() => openPreviewModal(item)}
                        className="flex-1 flex-row items-center justify-center py-2"
                    >
                        <Eye size={18} color={colors.textSecondary} />
                        <Text className="font-semibold ml-2" style={{ color: colors.textSecondary }}>Preview</Text>
                    </TouchableOpacity>
                    <View className="w-[1px] h-6" style={{ backgroundColor: colors.border }} />
                    <TouchableOpacity
                        onPress={() => deleteService(item.id)}
                        className="flex-1 flex-row items-center justify-center py-2"
                    >
                        <Trash2 size={18} color="#EF4444" />
                        <Text className="font-semibold ml-2" style={{ color: '#EF4444' }}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color="#FF6B00" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4 flex-row justify-between items-center z-10" style={{ backgroundColor: colors.surface }}>
                <View>
                    <Text className="text-2xl font-bold" style={{ color: colors.text }}>My Services</Text>
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>Manage your product catalog</Text>
                </View>
                <TouchableOpacity
                    onPress={openAddModal}
                    className="bg-primary w-12 h-12 rounded-2xl items-center justify-center shadow-lg shadow-primary/20"
                >
                    <Plus size={24} color="white" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={services}
                renderItem={renderServiceCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 24 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#FF6B00']}
                        tintColor="#FF6B00"
                    />
                }
                ListEmptyComponent={() => (
                    <View className="flex-1 items-center justify-center py-20">
                        <Text className="font-medium" style={{ color: colors.textSecondary }}>No services found</Text>
                        <TouchableOpacity
                            onPress={openAddModal}
                            className="mt-4 bg-primary px-6 py-3 rounded-xl"
                        >
                            <Text className="text-white font-bold">Add Your First Service</Text>
                        </TouchableOpacity>
                    </View>
                )}
                ListHeaderComponent={() => services.length > 0 ? (
                    <TouchableOpacity
                        onPress={openAddModal}
                        className="rounded-3xl p-6 mb-8 flex-row items-center"
                        style={{ backgroundColor: colors.surface }}
                    >
                        <View className="flex-1">
                            <Text className="font-bold text-lg" style={{ color: colors.text }}>Add New Listing</Text>
                            <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>Increase your reach by adding more items</Text>
                        </View>
                        <ChevronRight size={20} color="#FF6B00" />
                    </TouchableOpacity>
                ) : null}
            />

            {/* Edit Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={editModalVisible}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                    className="flex-1"
                >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="rounded-t-[40px] p-8 pb-12" style={{ backgroundColor: colors.surface, maxHeight: '90%' }}>
                        <View className="flex-row justify-between items-center mb-8">
                            <Text className="text-2xl font-bold" style={{ color: colors.text }}>{isNew ? 'New Service' : 'Edit Service'}</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View className="space-y-6">
                                <TouchableOpacity
                                    onPress={pickImage}
                                    className="border-2 border-dashed rounded-[32px] overflow-hidden mb-6 items-center justify-center h-48"
                                    style={{ backgroundColor: colors.background, borderColor: colors.border }}
                                >
                                    {selectedImage ? (
                                        <Image
                                            source={{ uri: selectedImage }}
                                            className="w-full h-full"
                                            onError={(e) => console.error('[IMAGE LOAD ERROR] Modal Preview:', e.nativeEvent.error, 'URI:', selectedImage)}
                                        />
                                    ) : editingService?.image_urls?.[0] ? (
                                        <ServiceImage imageUrl={editingService.image_urls[0]} />
                                    ) : (
                                        <View className="items-center">
                                            <Plus size={32} color={colors.textSecondary} />
                                            <Text className="mt-2 font-bold text-xs uppercase tracking-widest" style={{ color: colors.textSecondary }}>Add Photo</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {isNew ? (
                                    <>
                                        {/* Category Dropdown */}
                                        <View>
                                            <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Category</Text>
                                            <TouchableOpacity
                                                onPress={() => setCategoryPickerVisible(true)}
                                                className="rounded-2xl px-4 py-4 flex-row items-center justify-between"
                                                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                            >
                                                <Text style={{ color: editingService?.category ? colors.text : colors.textSecondary, fontWeight: '600' }}>
                                                    {editingService?.category || 'Select a category'}
                                                </Text>
                                                <ChevronDown size={20} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Catalog Service Dropdown */}
                                        {editingService?.category ? (
                                            <View className="mt-4">
                                                <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Catalog Service</Text>
                                                <TouchableOpacity
                                                    onPress={() => setCatalogServicePickerVisible(true)}
                                                    className="rounded-2xl px-4 py-4 flex-row items-center justify-between"
                                                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                                >
                                                    <Text style={{ color: editingService?.name ? colors.text : colors.textSecondary, fontWeight: '600' }}>
                                                        {editingService?.name || 'Select a catalog service'}
                                                    </Text>
                                                    <ChevronDown size={20} color={colors.textSecondary} />
                                                </TouchableOpacity>
                                            </View>
                                        ) : null}

                                        {/* Pricing Type Dropdown */}
                                        {editingService?.name && selectedCatalogService ? (
                                            <View className="mt-4">
                                                <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Pricing Tier</Text>
                                                <TouchableOpacity
                                                    onPress={() => setPricingTypePickerVisible(true)}
                                                    className="rounded-2xl px-4 py-4 flex-row items-center justify-between"
                                                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                                >
                                                    <Text style={{ color: editingService?.pricing_type ? colors.text : colors.textSecondary, fontWeight: '600' }}>
                                                        {editingService?.pricing_type
                                                            ? `${getPricingTierLabel(editingService.pricing_type)} - ₹${editingService.price_amount}`
                                                            : 'Select pricing tier'}
                                                    </Text>
                                                    <ChevronDown size={20} color={colors.textSecondary} />
                                                </TouchableOpacity>
                                            </View>
                                        ) : null}

                                        {/* Price Summary Card */}
                                        {editingService?.price_amount && editingService?.pricing_type ? (
                                            <View className="mt-4 p-5 rounded-2xl" style={{ backgroundColor: colors.primary + '12', borderWidth: 1, borderColor: colors.primary + '30' }}>
                                                <Text className="text-[10px] font-bold uppercase tracking-widest" style={{ color: colors.primary }}>Selected Service</Text>
                                                <Text className="text-2xl font-bold mt-2" style={{ color: colors.primary }}>₹{editingService.price_amount}</Text>
                                                <Text className="text-xs mt-2 leading-5" style={{ color: colors.textSecondary }}>
                                                    {editingService.category} → {editingService.name}
                                                </Text>
                                                <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>
                                                    Tier: {getPricingTierLabel(editingService.pricing_type)}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <View>
                                            <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Service Name</Text>
                                            <TextInput
                                                value={editingService?.name}
                                                onChangeText={(t) => setEditingService({ ...editingService, name: t })}
                                                className="rounded-2xl px-4 py-4 font-semibold"
                                                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text }}
                                                placeholder="Enter service name"
                                                placeholderTextColor={colors.textSecondary}
                                            />
                                        </View>

                                        <View className="mt-4">
                                            <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Category</Text>
                                            <TouchableOpacity
                                                onPress={() => setCategoryPickerVisible(true)}
                                                className="rounded-2xl px-4 py-4 font-semibold flex-row items-center justify-between"
                                                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                            >
                                                <Text style={{ color: editingService?.category ? colors.text : colors.textSecondary }}>
                                                    {editingService?.category || 'Select a category'}
                                                </Text>
                                                <ChevronDown size={20} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        </View>

                                        <View className="mt-4">
                                            <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Price (₹)</Text>
                                            <TextInput
                                                value={editingService?.price_amount?.toString()}
                                                onChangeText={(t) => setEditingService({ ...editingService, price_amount: t })}
                                                keyboardType="numeric"
                                                className="rounded-2xl px-4 py-4 font-semibold"
                                                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text }}
                                                placeholder="Enter price"
                                                placeholderTextColor={colors.textSecondary}
                                            />
                                        </View>
                                    </>
                                )}

                                <View className="mt-4 flex-row items-center justify-between p-4 rounded-2xl" style={{ backgroundColor: colors.background }}>
                                    <View>
                                        <Text className="font-bold" style={{ color: colors.text }}>Active Status</Text>
                                        <Text className="text-[10px]" style={{ color: colors.textSecondary }}>Show this service to clients</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setEditingService({ ...editingService, is_active: !editingService.is_active })}
                                        className={`w-14 h-8 rounded-full items-center justify-center ${editingService?.is_active ? 'bg-primary' : ''}`}
                                        style={{ backgroundColor: editingService?.is_active ? colors.primary : colors.border }}
                                    >
                                        <View className={`w-6 h-6 rounded-full absolute ${editingService?.is_active ? 'right-1' : 'left-1'}`} style={{ backgroundColor: colors.surface }} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={handleSaveService}
                                disabled={updating}
                                className="bg-primary py-5 rounded-2xl mt-10 items-center flex-row justify-center"
                            >
                                {updating ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text className="text-white font-bold text-lg mr-2">{isNew ? 'Create Service' : 'Save Changes'}</Text>
                                        <Check size={20} color="white" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Category Picker Modal - Matching onboarding style */}
            <Modal
                visible={categoryPickerVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setCategoryPickerVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View 
                        className="rounded-t-3xl p-6" 
                        style={{ 
                            backgroundColor: colors.surface,
                            height: '60%'
                        }}
                    >
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold" style={{ color: colors.text }}>Select Category</Text>
                            <TouchableOpacity onPress={() => setCategoryPickerVisible(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {categories.length === 0 ? (
                            <View className="flex-1 items-center justify-center py-20">
                                <ActivityIndicator size="large" color="#FF6B00" />
                                <Text className="mt-4 font-bold" style={{ color: colors.textSecondary }}>Loading categories...</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={categories}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (isNew) {
                                                setEditingService({ ...editingService, category: item.name, category_id: item.id, name: '', price_amount: '', pricing_type: '', offerable_service_id: '' });
                                                setSelectedCatalogService(null);
                                                setCatalogServices([]);
                                                fetchCatalogServices(item.id);
                                            } else {
                                                setEditingService({ ...editingService, category: item.name });
                                            }
                                            setCategoryPickerVisible(false);
                                        }}
                                        className="py-4 px-4 rounded-xl mb-2 flex-row items-center justify-between"
                                        style={{
                                            backgroundColor: editingService?.category === item.name 
                                                ? colors.primary + '1A' 
                                                : colors.background,
                                            borderWidth: editingService?.category === item.name ? 1 : 0,
                                            borderColor: editingService?.category === item.name 
                                                ? colors.primary + '33' 
                                                : 'transparent'
                                        }}
                                    >
                                        <Text 
                                            className="text-base font-bold" 
                                            style={{ 
                                                color: editingService?.category === item.name 
                                                    ? colors.primary 
                                                    : colors.text 
                                            }}
                                        >
                                            {item.name}
                                        </Text>
                                        {editingService?.category === item.name && (
                                            <Check size={20} color="#FF6B00" />
                                        )}
                                    </TouchableOpacity>
                                )}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Catalog Service Picker Modal */}
            <Modal
                visible={catalogServicePickerVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setCatalogServicePickerVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View 
                        className="rounded-t-3xl p-6" 
                        style={{ backgroundColor: colors.surface, height: '70%' }}
                    >
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold" style={{ color: colors.text }}>Select Catalog Service</Text>
                            <TouchableOpacity onPress={() => setCatalogServicePickerVisible(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {catalogServices.length === 0 ? (
                            <View className="flex-1 items-center justify-center py-20">
                                <ActivityIndicator size="large" color="#FF6B00" />
                                <Text className="mt-4 font-bold" style={{ color: colors.textSecondary }}>Loading catalog services...</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={catalogServices}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setEditingService({ ...editingService, name: item.name, offerable_service_id: item.id, price_amount: '', pricing_type: '' });
                                            setSelectedCatalogService(item);
                                            setCatalogServicePickerVisible(false);
                                        }}
                                        className="py-4 px-4 rounded-xl mb-3"
                                        style={{
                                            backgroundColor: editingService?.name === item.name 
                                                ? colors.primary + '1A' 
                                                : colors.background,
                                            borderWidth: 1,
                                            borderColor: editingService?.name === item.name 
                                                ? colors.primary + '33' 
                                                : colors.border
                                        }}
                                    >
                                        <Text 
                                            className="text-base font-bold" 
                                            style={{ color: editingService?.name === item.name ? colors.primary : colors.text }}
                                        >
                                            {item.name}
                                        </Text>
                                        <View className="flex-row flex-wrap mt-2 gap-x-3 gap-y-1">
                                            {item.price_basic != null && <Text className="text-xs" style={{ color: colors.textSecondary }}>Basic: ₹{item.price_basic}</Text>}
                                            <Text className="text-xs" style={{ color: colors.textSecondary }}>Classic Value: ₹{item.price_classic_value ?? 0}</Text>
                                            <Text className="text-xs" style={{ color: colors.textSecondary }}>Signature: ₹{item.price_signature ?? 0}</Text>
                                            <Text className="text-xs" style={{ color: colors.textSecondary }}>Prestige: ₹{item.price_prestige ?? 0}</Text>
                                            <Text className="text-xs" style={{ color: colors.textSecondary }}>Royal: ₹{item.price_royal ?? 0}</Text>
                                            <Text className="text-xs" style={{ color: colors.textSecondary }}>Imperial: ₹{item.price_imperial ?? 0}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Pricing Type Picker Modal */}
            <Modal
                visible={pricingTypePickerVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setPricingTypePickerVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View 
                        className="rounded-t-3xl p-6" 
                        style={{ backgroundColor: colors.surface }}
                    >
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold" style={{ color: colors.text }}>Select Pricing Tier</Text>
                            <TouchableOpacity onPress={() => setPricingTypePickerVisible(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                                {selectedCatalogService && (
                                    <View>
                                        {[
                                            ...(selectedCatalogService.price_basic != null ? [{ key: 'basic', label: 'Basic', price: selectedCatalogService.price_basic ?? 0, desc: 'Entry level' }] : []),
                                            { key: 'classic_value', label: 'Classic Value', price: selectedCatalogService.price_classic_value ?? 0, desc: 'Economy option' },
                                            { key: 'signature', label: 'Signature', price: selectedCatalogService.price_signature ?? 0, desc: 'Popular choice' },
                                            { key: 'prestige', label: 'Prestige', price: selectedCatalogService.price_prestige ?? 0, desc: 'Premium quality' },
                                            { key: 'royal', label: 'Royal', price: selectedCatalogService.price_royal ?? 0, desc: 'Luxury tier' },
                                            { key: 'imperial', label: 'Imperial', price: selectedCatalogService.price_imperial ?? 0, desc: 'Top tier' },
                                        ].filter(t => t.price > 0).map((tier) => (
                                    <TouchableOpacity
                                        key={tier.key}
                                        onPress={() => {
                                            setEditingService({ ...editingService, pricing_type: tier.key, price_amount: tier.price.toString() });
                                            setPricingTypePickerVisible(false);
                                        }}
                                        className="py-5 px-5 rounded-xl mb-3 flex-row items-center justify-between"
                                        style={{
                                            backgroundColor: editingService?.pricing_type === tier.key 
                                                ? colors.primary + '1A' 
                                                : colors.background,
                                            borderWidth: 1,
                                            borderColor: editingService?.pricing_type === tier.key 
                                                ? colors.primary + '33' 
                                                : colors.border
                                        }}
                                    >
                                        <View>
                                            <Text 
                                                className="text-base font-bold" 
                                                style={{ color: editingService?.pricing_type === tier.key ? colors.primary : colors.text }}
                                            >
                                                {tier.label}
                                            </Text>
                                            <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                                {tier.desc}
                                            </Text>
                                        </View>
                                        <View className="flex-row items-center">
                                            <Text 
                                                className="text-lg font-bold mr-3" 
                                                style={{ color: editingService?.pricing_type === tier.key ? colors.primary : colors.text }}
                                            >
                                                ₹{tier.price}
                                            </Text>
                                            {editingService?.pricing_type === tier.key && (
                                                <Check size={20} color="#FF6B00" />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Preview Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={previewModalVisible}
                onRequestClose={() => setPreviewModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/70 px-6">
                    <View className="w-full rounded-[40px] overflow-hidden shadow-2xl" style={{ backgroundColor: colors.surface }}>
                        <View className="relative">
                            <View className="w-full h-64" style={{ backgroundColor: colors.background }}>
                                {previewServiceData?.image_urls?.[0] ? (
                                    <ServiceImage imageUrl={previewServiceData.image_urls[0]} />
                                ) : (
                                    <Image
                                        source={{ uri: 'https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=400&h=300&auto=format&fit=crop' }}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => setPreviewModalVisible(false)}
                                className="absolute top-6 right-6 w-10 h-10 bg-black/50 rounded-full items-center justify-center"
                            >
                                <X size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                        <View className="p-8">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="font-extrabold text-2xl" style={{ color: colors.text }}>{previewServiceData?.name}</Text>
                                <Text className="text-primary font-bold text-2xl">₹{previewServiceData?.price_amount}</Text>
                            </View>
                            <View className="flex-row items-center mb-6">
                                <View className="bg-primary/10 px-4 py-1.5 rounded-full mr-3">
                                    <Text className="text-primary font-bold text-xs uppercase">{previewServiceData?.category || 'Service'}</Text>
                                </View>
                                <View className="flex-row items-center">
                                    <Star size={14} color="#FF6B00" fill="#FF6B00" />
                                    <Text className="text-sm font-bold ml-1" style={{ color: colors.text }}>4.8 (120 reviews)</Text>
                                </View>
                            </View>
                            <Text className="text-sm leading-6 mb-8" style={{ color: colors.textSecondary }}>
                                High-quality {previewServiceData?.category?.toLowerCase() || 'service'} provided by Ekatraa verified partners.
                                Book now to ensure availability for your special event.
                            </Text>
                            <TouchableOpacity
                                onPress={() => setPreviewModalVisible(false)}
                                className="w-full py-5 items-center justify-center bg-black rounded-3xl"
                            >
                                <Text className="text-white font-extrabold text-lg">Close Preview</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
