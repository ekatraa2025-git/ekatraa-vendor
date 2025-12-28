import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, FlatList, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Edit3, Trash2, Eye, Star, ChevronRight, X, Check } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

import * as ImagePicker from 'expo-image-picker';

export default function ServicesScreen() {
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState<any[]>([]);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingService, setEditingService] = useState<any>(null);
    const [isNew, setIsNew] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        fetchServices();
    }, []);

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

    const handleSaveService = async () => {
        if (!editingService?.name || !editingService?.price_amount) {
            Alert.alert('Required Fields', 'Please enter service name and price.');
            return;
        }

        try {
            setUpdating(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const serviceData = {
                name: editingService.name,
                price_amount: parseFloat(editingService.price_amount),
                category: editingService.category || 'Service',
                is_active: editingService.is_active ?? true,
                image_urls: selectedImage ? [selectedImage] : (editingService.image_urls || []),
                vendor_id: user.id
            };

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
        setEditingService({ name: '', price_amount: '', category: '', is_active: true });
        setIsNew(true);
        setSelectedImage(null);
        setEditModalVisible(true);
    };

    const openEditModal = (service: any) => {
        setEditingService(service);
        setIsNew(false);
        setSelectedImage(null);
        setEditModalVisible(true);
    };

    const renderServiceCard = ({ item }: { item: any }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            className="bg-white border border-gray-100 rounded-[32px] overflow-hidden mb-6 shadow-sm"
        >
            <View className="relative">
                <Image
                    source={{ uri: item.image_urls?.[0] || 'https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=400&h=300&auto=format&fit=crop' }}
                    className="w-full h-48"
                />
                <View className="absolute top-4 right-4 bg-white/90 px-3 py-1 rounded-full flex-row items-center">
                    <Star size={12} color="#FF6B00" fill="#FF6B00" />
                    <Text className="text-accent-dark text-[10px] font-bold ml-1">4.8</Text>
                </View>
                <View className={`absolute top-4 left-4 ${item.is_active ? 'bg-green-500' : 'bg-gray-400'} px-3 py-1 rounded-full`}>
                    <Text className="text-white text-[10px] font-bold uppercase">{item.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
            </View>

            <View className="p-6">
                <View className="flex-row justify-between items-start">
                    <View className="flex-1 mr-4">
                        <Text className="text-accent text-[10px] uppercase font-bold tracking-widest">{item.category || 'Service'}</Text>
                        <Text className="text-xl font-bold text-accent-dark mt-1" numberOfLines={1}>{item.name}</Text>
                    </View>
                    <Text className="text-primary font-bold text-lg">₹{item.price_amount}</Text>
                </View>

                <View className="flex-row items-center mt-6 pt-6 border-t border-gray-50">
                    <TouchableOpacity
                        onPress={() => openEditModal(item)}
                        className="flex-1 flex-row items-center justify-center py-2"
                    >
                        <Edit3 size={18} color="#4B5563" />
                        <Text className="text-accent font-semibold ml-2">Edit</Text>
                    </TouchableOpacity>
                    <View className="w-[1px] h-6 bg-gray-100" />
                    <TouchableOpacity className="flex-1 flex-row items-center justify-center py-2">
                        <Eye size={18} color="#4B5563" />
                        <Text className="text-accent font-semibold ml-2">Preview</Text>
                    </TouchableOpacity>
                    <View className="w-[1px] h-6 bg-gray-100" />
                    <TouchableOpacity
                        onPress={() => deleteService(item.id)}
                        className="flex-1 flex-row items-center justify-center py-2"
                    >
                        <Trash2 size={18} color="#EF4444" />
                        <Text className="text-red-500 font-semibold ml-2">Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#FF6B00" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 flex-row justify-between items-center bg-white z-10">
                <View>
                    <Text className="text-2xl font-bold text-accent-dark">My Services</Text>
                    <Text className="text-accent text-xs">Manage your product catalog</Text>
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
                ListEmptyComponent={() => (
                    <View className="flex-1 items-center justify-center py-20">
                        <Text className="text-accent font-medium">No services found</Text>
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
                        className="bg-surface rounded-3xl p-6 mb-8 flex-row items-center"
                    >
                        <View className="flex-1">
                            <Text className="text-accent-dark font-bold text-lg">Add New Listing</Text>
                            <Text className="text-accent text-xs mt-1">Increase your reach by adding more items</Text>
                        </View>
                        <ChevronRight size={20} color="#FF6B00" />
                    </TouchableOpacity>
                ) : null}
            />

            <Modal
                animationType="slide"
                transparent={true}
                visible={editModalVisible}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-[40px] p-8 pb-12">
                        <View className="flex-row justify-between items-center mb-8">
                            <Text className="text-2xl font-bold text-accent-dark">{isNew ? 'New Service' : 'Edit Service'}</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <X size={24} color="#4B5563" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="space-y-6">
                                <TouchableOpacity
                                    onPress={pickImage}
                                    className="bg-surface border-2 border-dashed border-gray-200 rounded-[32px] overflow-hidden mb-6 items-center justify-center h-48"
                                >
                                    {selectedImage || editingService?.image_urls?.[0] ? (
                                        <Image
                                            source={{ uri: selectedImage || editingService?.image_urls?.[0] }}
                                            className="w-full h-full"
                                        />
                                    ) : (
                                        <View className="items-center">
                                            <Plus size={32} color="#9CA3AF" />
                                            <Text className="text-accent mt-2 font-bold text-xs uppercase tracking-widest">Add Photo</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <View>
                                    <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">Service Name</Text>
                                    <TextInput
                                        value={editingService?.name}
                                        onChangeText={(t) => setEditingService({ ...editingService, name: t })}
                                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-semibold"
                                        placeholder="Enter service name"
                                    />
                                </View>

                                <View className="mt-4">
                                    <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">Category</Text>
                                    <TextInput
                                        value={editingService?.category}
                                        onChangeText={(t) => setEditingService({ ...editingService, category: t })}
                                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-semibold"
                                        placeholder="e.g. Catering, Venue"
                                    />
                                </View>

                                <View className="mt-4">
                                    <Text className="text-sm font-bold text-accent-dark mb-2 uppercase tracking-widest text-[10px]">Price (₹)</Text>
                                    <TextInput
                                        value={editingService?.price_amount?.toString()}
                                        onChangeText={(t) => setEditingService({ ...editingService, price_amount: t })}
                                        keyboardType="numeric"
                                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-black font-semibold"
                                        placeholder="Enter price"
                                    />
                                </View>

                                <View className="mt-4 flex-row items-center justify-between bg-surface p-4 rounded-2xl">
                                    <View>
                                        <Text className="text-accent-dark font-bold">Active Status</Text>
                                        <Text className="text-accent text-[10px]">Show this service to clients</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setEditingService({ ...editingService, is_active: !editingService.is_active })}
                                        className={`w-14 h-8 rounded-full items-center justify-center ${editingService?.is_active ? 'bg-primary' : 'bg-gray-300'}`}
                                    >
                                        <View className={`w-6 h-6 bg-white rounded-full absolute ${editingService?.is_active ? 'right-1' : 'left-1'}`} />
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
            </Modal>
        </SafeAreaView>
    );
}
