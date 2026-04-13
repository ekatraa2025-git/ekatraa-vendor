import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, FlatList, ActivityIndicator, Modal, TextInput, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus, Edit3, Trash2, Eye, Star, ChevronRight, X, Check, Store, ChevronDown, Layers } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { resolveStorageImageUrl } from '../../lib/storageImageUrl';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { readAsStringAsync } from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { AppScreenSkeleton } from '../../components/AppSkeleton';

import * as ImagePicker from 'expo-image-picker';
import { getTierPrice, listPricedTiers } from '../../lib/catalogTierPricing';

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

function normalizeCategoryValue(value: string | null | undefined): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-');
}

function looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getOccasionDisplayValue(item: any): string {
    return String(
        item?.occasion_name ||
        item?.occasionName ||
        item?.occasion ||
        item?.occasion_id ||
        item?.occasionId ||
        ''
    ).trim();
}

function isMissingOccasionColumnError(error: any): boolean {
    const msg = String(error?.message || '').toLowerCase();
    if (!msg) return false;
    const mentionsOccasion = msg.includes('occasion_id') || msg.includes('occasion_name');
    const isColumnIssue =
        msg.includes('column') ||
        msg.includes('schema cache') ||
        msg.includes('does not exist') ||
        msg.includes('could not find');
    return mentionsOccasion && isColumnIssue;
}

function stripOccasionFields<T extends Record<string, any>>(payload: T): T {
    const next = { ...payload };
    delete (next as any).occasion_id;
    delete (next as any).occasion_name;
    return next;
}

export default function ServicesScreen() {
    const { colors, isDarkMode } = useTheme();
    const { showToast, showConfirm } = useToast();
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState<any[]>([]);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingService, setEditingService] = useState<any>(null);
    const [isNew, setIsNew] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [previewServiceData, setPreviewServiceData] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
    const [catalogServices, setCatalogServices] = useState<any[]>([]);
    const [catalogServicePickerVisible, setCatalogServicePickerVisible] = useState(false);
    const [pricingTypePickerVisible, setPricingTypePickerVisible] = useState(false);
    const [selectedCatalogService, setSelectedCatalogService] = useState<any>(null);
    const [occasions, setOccasions] = useState<{ id: string; name: string }[]>([]);
    const [occasionPickerVisible, setOccasionPickerVisible] = useState(false);
    const [bulkModalVisible, setBulkModalVisible] = useState(false);
    const [bulkOccasionIds, setBulkOccasionIds] = useState<string[]>([]);
    const [bulkCategoryIds, setBulkCategoryIds] = useState<string[]>([]);
    const [bulkCatalogServices, setBulkCatalogServices] = useState<any[]>([]);
    /** serviceId -> Set of tier keys */
    const [bulkTierByService, setBulkTierByService] = useState<Record<string, Set<string>>>({});
    const [bulkCategories, setBulkCategories] = useState<{ id: string; name: string }[]>([]);
    const [bulkCategoriesLoading, setBulkCategoriesLoading] = useState(false);
    const [bulkCatalogServicesLoading, setBulkCatalogServicesLoading] = useState(false);
    const [bulkSaving, setBulkSaving] = useState(false);
    const [serviceSearchQuery, setServiceSearchQuery] = useState('');
    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
    const [serviceGalleryUrls, setServiceGalleryUrls] = useState<string[]>([]);
    const [serviceGallerySigned, setServiceGallerySigned] = useState<Record<string, string>>({});
    const visibleServiceGalleryRefs = useRef<string[]>([]);
    const [descriptionOverrides, setDescriptionOverrides] = useState<Record<string, string>>({});
    /** Canonical catalog category id from Profile (vendors.category_id or match on vendors.category name). */
    const [vendorCategoryId, setVendorCategoryId] = useState<string | null>(null);
    const [vendorCategoryLabel, setVendorCategoryLabel] = useState<string>('');
    const [vendorCategoryLoading, setVendorCategoryLoading] = useState(true);
    // Cache for image URLs to avoid repeated API calls
    const imageUrlCache: { [key: string]: string } = {};

    const categoryMatchesVendor = useCallback(
        (categoryId: string | null | undefined, categoryName: string | null | undefined): boolean => {
            const categoryIdNorm = normalizeCategoryValue(categoryId);
            const categoryNameNorm = normalizeCategoryValue(categoryName);
            const vendorIdNorm = normalizeCategoryValue(vendorCategoryId);
            const vendorLabelNorm = normalizeCategoryValue(vendorCategoryLabel);

            if (vendorIdNorm && categoryIdNorm && categoryIdNorm === vendorIdNorm) return true;
            if (vendorLabelNorm && categoryNameNorm && categoryNameNorm === vendorLabelNorm) return true;
            if (vendorLabelNorm && categoryIdNorm && categoryIdNorm === vendorLabelNorm) return true;
            if (vendorIdNorm && categoryNameNorm && categoryNameNorm === vendorIdNorm) return true;
            return false;
        },
        [vendorCategoryId, vendorCategoryLabel]
    );

    const loadVendorCategory = useCallback(async () => {
        setVendorCategoryLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setVendorCategoryId(null);
                setVendorCategoryLabel('');
                return;
            }
            const { data: v } = await supabase
                .from('vendors')
                .select('category, category_id, gallery_urls')
                .eq('id', user.id)
                .maybeSingle();

            if (!v) {
                setVendorCategoryId(null);
                setVendorCategoryLabel('');
                setServiceGalleryUrls([]);
                setServiceGallerySigned({});
                return;
            }

            const gallery = Array.isArray((v as any).gallery_urls) ? (v as any).gallery_urls.filter(Boolean) : [];
            setServiceGalleryUrls(gallery);
            setServiceGallerySigned({});

            const nameFromRow = typeof v.category === 'string' ? v.category.trim() : '';
            const idRaw = v.category_id != null && v.category_id !== '' ? String(v.category_id).trim() : '';

            const apiUrl = getApiUrl();
            if (!apiUrl) {
                // Best effort when API is unavailable.
                if (idRaw && !looksLikeUuid(idRaw)) {
                    setVendorCategoryId(idRaw);
                    setVendorCategoryLabel(nameFromRow || idRaw);
                } else {
                    setVendorCategoryId(null);
                    setVendorCategoryLabel(nameFromRow || '');
                }
                return;
            }

            const res = await fetch(`${apiUrl}/api/public/categories`);
            if (!res.ok) {
                setVendorCategoryId(null);
                setVendorCategoryLabel(nameFromRow);
                return;
            }
            const all = await res.json();
            if (!Array.isArray(all)) {
                setVendorCategoryId(null);
                setVendorCategoryLabel(nameFromRow);
                return;
            }

            const idNorm = normalizeCategoryValue(idRaw);
            const nameNorm = normalizeCategoryValue(nameFromRow);
            const match = all.find(
                (c: { id?: string; name?: string }) =>
                    normalizeCategoryValue(c.id) === idNorm ||
                    normalizeCategoryValue(c.name) === nameNorm ||
                    normalizeCategoryValue(c.id) === nameNorm ||
                    normalizeCategoryValue(c.name) === idNorm
            );
            if (match?.id) {
                setVendorCategoryId(String(match.id));
                setVendorCategoryLabel(String(match.name || nameFromRow || match.id));
            } else {
                // If category_id is a readable slug/id, keep it. Ignore legacy UUID ids.
                if (idRaw && !looksLikeUuid(idRaw)) {
                    setVendorCategoryId(idRaw);
                    setVendorCategoryLabel(nameFromRow || idRaw);
                } else {
                    setVendorCategoryId(null);
                    setVendorCategoryLabel(nameFromRow);
                }
            }
        } catch {
            setVendorCategoryId(null);
            setVendorCategoryLabel('');
        } finally {
            setVendorCategoryLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchServices();
        fetchOccasions();
        loadVendorCategory();
    }, [loadVendorCategory]);

    useFocusEffect(
        useCallback(() => {
            loadVendorCategory();
        }, [loadVendorCategory])
    );

    useEffect(() => {
        if (!editModalVisible || isNew || !vendorCategoryId || !vendorCategoryLabel) return;
        setCategories([{ id: vendorCategoryId, name: vendorCategoryLabel }]);
    }, [editModalVisible, isNew, vendorCategoryId, vendorCategoryLabel]);

    const getApiUrl = () =>
        process.env.EXPO_PUBLIC_API_URL ||
        Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
        Constants.expoConfig?.extra?.API_URL;

    const fetchOccasions = async () => {
        try {
            const apiUrl = getApiUrl();
            if (!apiUrl) return;
            const response = await fetch(`${apiUrl}/api/public/occasions`);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    setOccasions(data.map((o: any) => ({ id: o.id, name: o.name || o.id })));
                }
            }
        } catch (e) {
            console.warn('[OCCASIONS]', e);
        }
    };

    const fetchCategoriesForOccasion = async (
        occasionId: string
    ): Promise<
        { id: string; name: string; icon_url?: string; display_order?: number }[]
    > => {
        if (!vendorCategoryId) {
            setCategories([]);
            return [];
        }
        try {
            const apiUrl = getApiUrl();
            if (!apiUrl || !occasionId) {
                setCategories([]);
                return [];
            }
            const response = await fetch(
                `${apiUrl}/api/public/categories?occasion_id=${encodeURIComponent(occasionId)}`
            );
            if (response.ok) {
                const apiData = await response.json();
                if (apiData && Array.isArray(apiData) && apiData.length > 0) {
                    const mapped = apiData.map((item: any) => ({
                        id: item.id || String(item.name),
                        name: item.name || String(item.id),
                        icon_url: item.icon_url,
                        display_order: item.display_order,
                    }));
                    const filtered = mapped.filter((c) => categoryMatchesVendor(c.id, c.name));
                    setCategories(filtered);
                    return filtered;
                }
            }
            setCategories([]);
            return [];
        } catch (error) {
            console.error('[CATEGORIES]', error);
            setCategories([]);
            return [];
        }
    };

    const fetchCatalogServices = async (occasionId: string, categoryId: string) => {
        try {
            const apiUrl = getApiUrl();
            if (apiUrl && occasionId && categoryId) {
                const servicesUrl = new URL(`${apiUrl}/api/public/services`);
                servicesUrl.searchParams.set('occasion_id', occasionId);
                servicesUrl.searchParams.set('category_id', String(categoryId));
                const response = await fetch(servicesUrl.toString());
                if (response.ok) {
                    const data = await response.json();
                    const raw = Array.isArray(data) ? data : [];
                    setCatalogServices(
                        raw.filter((s: { category_id?: string }) => s.category_id === categoryId)
                    );
                    return;
                }
            }
        } catch (error) {
            console.error('[CATALOG_SERVICES]', error);
        }
        setCatalogServices([]);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchServices();
        setRefreshing(false);
    };

    const filteredServices = useMemo(() => {
        const q = serviceSearchQuery.trim().toLowerCase();
        if (!q) return services;
        return services.filter((svc) =>
            String(svc?.name || '').toLowerCase().includes(q) ||
            String(svc?.category || '').toLowerCase().includes(q) ||
            String(svc?.pricing_type || '').toLowerCase().includes(q) ||
            String(svc?.description || '').toLowerCase().includes(q)
        );
    }, [services, serviceSearchQuery]);

    const resolveVisibleServiceGallery = useCallback(
        async (refs: string[]) => {
            if (!refs.length) return;
            const pending = refs.filter((ref) => ref && !serviceGallerySigned[ref]);
            if (!pending.length) return;
            const resolved = await Promise.all(
                pending.map(async (ref) => {
                    try {
                        const signed = await getImageUrl(ref);
                        return [ref, signed] as const;
                    } catch {
                        return [ref, ref] as const;
                    }
                })
            );
            setServiceGallerySigned((prev) => {
                const next = { ...prev };
                for (const [ref, signed] of resolved) {
                    if (!next[ref]) next[ref] = signed;
                }
                return next;
            });
        },
        [serviceGallerySigned]
    );

    const handleServiceGalleryViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: Array<{ item: string }> }) => {
            const refs = viewableItems
                .map((v) => v.item)
                .filter((item): item is string => !!item && item !== '__add__');
            visibleServiceGalleryRefs.current = refs;
            resolveVisibleServiceGallery(refs);
        },
        [resolveVisibleServiceGallery]
    );

    const getImageUrl = async (urlOrPath: string | null | undefined): Promise<string> => {
        if (!urlOrPath) return '';
        if (imageUrlCache[urlOrPath]) return imageUrlCache[urlOrPath];
        const resolved = await resolveStorageImageUrl(urlOrPath, 86400);
        imageUrlCache[urlOrPath] = resolved;
        return resolved;
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
            const baseRows = data || [];

            // Enrich vendor services with mapped occasions from catalog linkage:
            // services.offerable_service_id -> service_occasions.service_id -> occasions.name
            const offerableIds = Array.from(
                new Set(
                    baseRows
                        .map((row: any) => row?.offerable_service_id)
                        .filter((id: any) => typeof id === 'string' && id.trim().length > 0)
                )
            );

            if (offerableIds.length === 0) {
                setServices(baseRows);
                return;
            }

            const descriptionByOfferableId: Record<string, string> = {};
            const { data: offerableRows } = await supabase
                .from('offerable_services')
                .select('id, description')
                .in('id', offerableIds as string[]);
            for (const row of offerableRows || []) {
                const oid = String((row as any)?.id || '');
                if (!oid) continue;
                const desc = String((row as any)?.description || '').trim();
                if (desc) descriptionByOfferableId[oid] = desc;
            }

            const { data: soRows } = await supabase
                .from('service_occasions')
                .select('service_id, occasion_id')
                .in('service_id', offerableIds as string[]);

            const links = Array.isArray(soRows) ? soRows : [];
            const occasionIds = Array.from(
                new Set(
                    links
                        .map((row: any) => row?.occasion_id)
                        .filter((id: any) => typeof id === 'string' && id.trim().length > 0)
                )
            );

            const occasionNameById: Record<string, string> = {};
            if (occasionIds.length > 0) {
                const { data: occRows } = await supabase
                    .from('occasions')
                    .select('id, name')
                    .in('id', occasionIds as string[]);
                for (const occ of occRows || []) {
                    const oid = String((occ as any).id || '');
                    if (!oid) continue;
                    occasionNameById[oid] = String((occ as any).name || oid);
                }
            }

            const occasionMapByOfferable: Record<string, { ids: Set<string>; names: Set<string> }> = {};
            for (const link of links) {
                const serviceId = String((link as any)?.service_id || '');
                const occasionId = String((link as any)?.occasion_id || '');
                if (!serviceId || !occasionId) continue;
                if (!occasionMapByOfferable[serviceId]) {
                    occasionMapByOfferable[serviceId] = { ids: new Set<string>(), names: new Set<string>() };
                }
                occasionMapByOfferable[serviceId].ids.add(occasionId);
                occasionMapByOfferable[serviceId].names.add(occasionNameById[occasionId] || occasionId);
            }

            const enriched = baseRows.map((row: any) => {
                const linked = row?.offerable_service_id ? occasionMapByOfferable[String(row.offerable_service_id)] : null;
                const serviceId = String(row?.id || '');
                const hasLocalOverride = serviceId && Object.prototype.hasOwnProperty.call(descriptionOverrides, serviceId);
                const effectiveDescription = hasLocalOverride
                    ? descriptionOverrides[serviceId]
                    : String(row?.description || '').trim() ||
                      (row?.offerable_service_id ? descriptionByOfferableId[String(row.offerable_service_id)] || '' : '');

                if (!linked) {
                    return {
                        ...row,
                        description: effectiveDescription,
                    };
                }
                const linkedIds = Array.from(linked.ids);
                const linkedNames = Array.from(linked.names);
                return {
                    ...row,
                    description: effectiveDescription,
                    occasion_id: row?.occasion_id || (linkedIds.length === 1 ? linkedIds[0] : null),
                    occasion_name: row?.occasion_name || (linkedNames.length ? linkedNames.join(', ') : null),
                };
            });

            setServices(enriched);
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setSelectedServiceIds((prev) => prev.filter((id) => services.some((svc) => svc.id === id)));
    }, [services]);

    const pickImages = async () => {
        const existingCount = Array.isArray(editingService?.image_urls) ? editingService.image_urls.length : 0;
        const remaining = Math.max(0, 12 - existingCount - selectedImages.length);
        if (remaining <= 0) {
            showToast({ variant: 'warning', title: 'Limit reached', message: 'You can add up to 12 images per service.' });
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: false,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
            quality: 0.8,
        });

        if (!result.canceled) {
            const picked = Array.isArray(result.assets) ? result.assets.map((a) => a.uri).filter(Boolean) : [];
            if (!picked.length) return;
            setSelectedImages((prev) => [...prev, ...picked].slice(0, 12 - existingCount));
        }
    };

    const openPreviewModal = (service: any) => {
        setPreviewServiceData(service);
        setPreviewModalVisible(true);
    };

    const handleSaveService = async () => {
        if (isNew && (!editingService?.occasion_id || !editingService?.category || !editingService?.name || !editingService?.price_amount)) {
            showToast({ variant: 'warning', title: 'Required fields', message: 'Please select occasion, category, catalog service, and pricing tier.' });
            return;
        }
        if (
            isNew &&
            vendorCategoryId &&
            editingService?.category_id &&
            editingService.category_id !== vendorCategoryId
        ) {
            showToast({ variant: 'warning', title: 'Category mismatch', message: 'Service category must match your business category in Profile.' });
            return;
        }
        if (!isNew && (!editingService?.name || !editingService?.price_amount)) {
            showToast({ variant: 'warning', title: 'Required fields', message: 'Please enter service name and price.' });
            return;
        }
        if (!isNew && vendorCategoryId && editingService?.category_id && editingService.category_id !== vendorCategoryId) {
            showToast({ variant: 'warning', title: 'Category mismatch', message: 'Category must match your business category in Profile.' });
            return;
        }

        try {
            setUpdating(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let imageUrls = (editingService.image_urls || []).filter((uri: string) => uri && !uri.startsWith('file') && !uri.startsWith('content'));
            if (selectedImages.length) {
                const uploaded: string[] = [];
                for (const localUri of selectedImages) {
                    const uploadedUrl = await uploadImage(localUri, 'service');
                    if (uploadedUrl) uploaded.push(uploadedUrl);
                }
                imageUrls = [...imageUrls, ...uploaded].slice(0, 12);
            }

            const categoryLabel =
                !isNew && vendorCategoryId && vendorCategoryLabel
                    ? vendorCategoryLabel
                    : editingService.category || 'Service';

            const serviceData: any = {
                name: editingService.name,
                price_amount: parseFloat(editingService.price_amount),
                category: categoryLabel,
                description: editingService?.description ? String(editingService.description).trim() : null,
                is_active: editingService.is_active ?? true,
                image_urls: imageUrls,
                vendor_id: user.id
            };
            if (editingService?.occasion_id) serviceData.occasion_id = editingService.occasion_id;
            if (editingService?.occasion_name) serviceData.occasion_name = editingService.occasion_name;
            if (editingService.pricing_type) serviceData.pricing_type = editingService.pricing_type;
            if (editingService.offerable_service_id) serviceData.offerable_service_id = editingService.offerable_service_id;

            let error;
            let savedRow: any = null;
            if (isNew) {
                let { data: insertData, error: insertError } = await supabase
                    .from('services')
                    .insert([serviceData])
                    .select('*')
                    .maybeSingle();
                if (insertError && isMissingOccasionColumnError(insertError)) {
                    const fallbackData = stripOccasionFields(serviceData);
                    const retry = await supabase
                        .from('services')
                        .insert([fallbackData])
                        .select('*')
                        .maybeSingle();
                    insertData = retry.data;
                    insertError = retry.error;
                }
                savedRow = insertData;
                error = insertError;
            } else {
                let { data: updateData, error: updateError } = await supabase
                    .from('services')
                    .update(serviceData)
                    .eq('id', editingService.id)
                    .select('*')
                    .maybeSingle();
                if (updateError && isMissingOccasionColumnError(updateError)) {
                    const fallbackData = stripOccasionFields(serviceData);
                    const retry = await supabase
                        .from('services')
                        .update(fallbackData)
                        .eq('id', editingService.id)
                        .select('*')
                        .maybeSingle();
                    updateData = retry.data;
                    updateError = retry.error;
                }
                savedRow = updateData;
                error = updateError;
            }

            if (error) throw error;

            if (savedRow) {
                const savedDescription = serviceData.description == null ? '' : String(serviceData.description);
                setDescriptionOverrides((prev) => ({ ...prev, [savedRow.id]: savedDescription }));
                setServices((prev) => {
                    const mergedSaved = { ...savedRow, description: savedDescription };
                    if (isNew) return [mergedSaved, ...prev];
                    return prev.map((svc) => (svc.id === savedRow.id ? { ...svc, ...mergedSaved } : svc));
                });
                setPreviewServiceData((prev: any) =>
                    prev?.id === savedRow.id ? { ...prev, ...savedRow, description: savedDescription } : prev
                );
            }

            setEditModalVisible(false);
            fetchServices();
            showToast({
                variant: 'success',
                title: `Service ${isNew ? 'created' : 'updated'}`,
                message: `Service ${isNew ? 'created' : 'updated'} successfully.`,
            });
        } catch (error: any) {
            showToast({ variant: 'error', title: 'Could not save', message: error.message || 'Failed to save service' });
        } finally {
            setUpdating(false);
        }
    };

    const deleteService = async (id: string) => {
        showConfirm({
            title: 'Delete service',
            message: 'Are you sure you want to delete this service?',
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('services')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;
                    setServices(services.filter(s => s.id !== id));
                    setSelectedServiceIds((prev) => prev.filter((sid) => sid !== id));
                    setDescriptionOverrides((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                    });
                } catch (error) {
                    console.error('Error deleting service:', error);
                }
            },
        });
    };

    const toggleServiceSelection = (id: string) => {
        setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));
    };

    const clearServiceSelection = () => {
        setSelectedServiceIds([]);
    };

    const selectAllFilteredServices = () => {
        setSelectedServiceIds(filteredServices.map((svc) => svc.id));
    };

    const deleteSelectedServices = () => {
        if (selectedServiceIds.length === 0) return;
        showConfirm({
            title: 'Delete selected services',
            message: `Delete ${selectedServiceIds.length} selected service(s)?`,
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from('services').delete().in('id', selectedServiceIds);
                    if (error) throw error;
                    setServices((prev) => prev.filter((svc) => !selectedServiceIds.includes(svc.id)));
                    setSelectedServiceIds([]);
                    showToast({ variant: 'success', title: 'Deleted', message: 'Selected services deleted.' });
                } catch (error: any) {
                    showToast({ variant: 'error', title: 'Delete failed', message: error?.message || 'Could not delete selected services' });
                }
            },
        });
    };

    const persistServiceGallery = async (next: string[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase
            .from('vendors')
            .update({ gallery_urls: next })
            .eq('id', user.id);
        if (error) throw error;
        setServiceGalleryUrls(next);
    };

    const addServiceGalleryImages = async () => {
        if (serviceGalleryUrls.length >= 12) {
            showToast({ variant: 'warning', title: 'Limit reached', message: 'You can add up to 12 gallery photos.' });
            return;
        }
        const remaining = Math.max(0, 12 - serviceGalleryUrls.length);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: false,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
            quality: 0.85,
        });
        if (result.canceled) return;
        try {
            setUpdating(true);
            const picked = Array.isArray(result.assets) ? result.assets : [];
            if (!picked.length) return;
            const uploadTargets = picked.slice(0, remaining);
            const uploaded: string[] = [];
            for (const asset of uploadTargets) {
                const fileName = await uploadImage(asset.uri, 'service-gallery');
                if (fileName) uploaded.push(fileName);
            }
            const next = [...serviceGalleryUrls, ...uploaded].slice(0, 12);
            await persistServiceGallery(next);
            resolveVisibleServiceGallery(visibleServiceGalleryRefs.current);
            showToast({ variant: 'success', title: 'Gallery updated', message: `${uploaded.length} image(s) added.` });
        } catch (e: any) {
            showToast({ variant: 'error', title: 'Upload failed', message: e?.message || 'Could not add images' });
        } finally {
            setUpdating(false);
        }
    };

    const removeServiceGalleryImage = (ref: string) => {
        showConfirm({
            title: 'Remove image',
            message: 'Remove this image from service gallery?',
            confirmLabel: 'Remove',
            destructive: true,
            onConfirm: async () => {
                try {
                    setUpdating(true);
                    const next = serviceGalleryUrls.filter((u) => u !== ref);
                    await persistServiceGallery(next);
                    setServiceGallerySigned((prev) => {
                        const cloned = { ...prev };
                        delete cloned[ref];
                        return cloned;
                    });
                } catch (e: any) {
                    showToast({ variant: 'error', title: 'Could not remove', message: e?.message || 'Could not remove image' });
                } finally {
                    setUpdating(false);
                }
            },
        });
    };

    const openAddModal = () => {
        if (vendorCategoryLoading) {
            showToast({ variant: 'info', title: 'Please wait', message: 'Loading your profile category…' });
            return;
        }
        if (!vendorCategoryId) {
            showToast({
                variant: 'warning',
                title: 'Category required',
                message: 'Set your business category in Profile first. It must match a catalog category so services stay in your line of business.',
            });
            return;
        }
        setEditingService({
            name: '',
            price_amount: '',
            description: '',
            category: '',
            category_id: '',
            occasion_id: '',
            occasion_name: '',
            pricing_type: '',
            offerable_service_id: '',
            is_active: true,
        });
        setIsNew(true);
        setSelectedImages([]);
        setSelectedCatalogService(null);
        setCatalogServices([]);
        setCategories([]);
        setEditModalVisible(true);
    };

    const openBulkModal = () => {
        if (vendorCategoryLoading) {
            showToast({ variant: 'info', title: 'Please wait', message: 'Loading your profile category…' });
            return;
        }
        if (!vendorCategoryId) {
            showToast({ variant: 'warning', title: 'Category required', message: 'Set your business category in Profile first.' });
            return;
        }
        setBulkOccasionIds([]);
        setBulkCategoryIds([]);
        setBulkCatalogServices([]);
        setBulkTierByService({});
        setBulkCategories([]);
        setBulkCategoriesLoading(false);
        setBulkCatalogServicesLoading(false);
        setBulkModalVisible(true);
    };

    useEffect(() => {
        if (bulkOccasionIds.length === 0 || !vendorCategoryId) {
            setBulkCategories([]);
            if (bulkOccasionIds.length === 0) {
                setBulkCategoryIds([]);
            }
            setBulkCategoriesLoading(false);
            return;
        }
        let cancelled = false;
        setBulkCategoriesLoading(true);
        (async () => {
            const apiUrl = getApiUrl();
            if (!apiUrl) {
                if (!cancelled) setBulkCategoriesLoading(false);
                return;
            }
            try {
                const responses = await Promise.all(
                    bulkOccasionIds.map(async (occasionId) => {
                        const res = await fetch(
                            `${apiUrl}/api/public/categories?occasion_id=${encodeURIComponent(occasionId)}`
                        );
                        if (!res.ok) return [];
                        const data = await res.json();
                        if (!Array.isArray(data)) return [];
                        return data.map((item: any) => ({
                            id: item.id || String(item.name),
                            name: item.name || String(item.id),
                        }));
                    })
                );
                const merged = responses.flat();
                const uniqueMap = new Map<string, { id: string; name: string }>();
                for (const c of merged) {
                    const key = String(c.id || c.name);
                    if (!uniqueMap.has(key)) uniqueMap.set(key, c);
                }
                const filtered = Array.from(uniqueMap.values()).filter((c) => categoryMatchesVendor(c.id, c.name));
                if (!cancelled) {
                    setBulkCategories(filtered);
                    const valid = new Set(filtered.map((c) => c.id));
                    setBulkCategoryIds((prev) => {
                        const next = prev.filter((id) => valid.has(id));
                        return next.length ? next : filtered.length === 1 ? [filtered[0].id] : [];
                    });
                }
            } catch {
                if (!cancelled) setBulkCategories([]);
            } finally {
                if (!cancelled) setBulkCategoriesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [bulkOccasionIds, vendorCategoryId, categoryMatchesVendor]);

    useEffect(() => {
        if (bulkOccasionIds.length === 0 || bulkCategoryIds.length === 0) {
            setBulkCatalogServices([]);
            setBulkCatalogServicesLoading(false);
            return;
        }
        let cancelled = false;
        setBulkCatalogServicesLoading(true);
        (async () => {
            const apiUrl = getApiUrl();
            if (!apiUrl) {
                if (!cancelled) setBulkCatalogServicesLoading(false);
                return;
            }
            try {
                const requests: Promise<any[]>[] = [];
                for (const occasionId of bulkOccasionIds) {
                    for (const categoryId of bulkCategoryIds) {
                        requests.push((async () => {
                            const url = new URL(`${apiUrl}/api/public/services`);
                            url.searchParams.set('occasion_id', occasionId);
                            url.searchParams.set('category_id', categoryId);
                            const res = await fetch(url.toString());
                            if (!res.ok) return [];
                            const data = await res.json();
                            return Array.isArray(data) ? data : [];
                        })());
                    }
                }
                const responses = await Promise.all(requests);
                const merged = responses
                    .flat()
                    .filter((s: { category_id?: string }) => !!s.category_id && bulkCategoryIds.includes(String(s.category_id)));
                const unique = new Map<string, any>();
                for (const svc of merged) {
                    const key = String(svc.id || svc.name);
                    if (!unique.has(key)) unique.set(key, svc);
                }
                if (!cancelled) setBulkCatalogServices(Array.from(unique.values()));
            } catch {
                if (!cancelled) setBulkCatalogServices([]);
            } finally {
                if (!cancelled) setBulkCatalogServicesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [bulkOccasionIds, bulkCategoryIds]);

    const toggleBulkTier = (serviceId: string, tierKey: string) => {
        setBulkTierByService((prev) => {
            const next = { ...prev };
            const cur = new Set(next[serviceId] || []);
            if (cur.has(tierKey)) cur.delete(tierKey);
            else cur.add(tierKey);
            next[serviceId] = cur;
            return next;
        });
    };

    const toggleBulkOccasion = (occasionId: string) => {
        setBulkOccasionIds((prev) => {
            const exists = prev.includes(occasionId);
            const next = exists ? prev.filter((id) => id !== occasionId) : [...prev, occasionId];
            return next;
        });
        setBulkCategoryIds([]);
        setBulkTierByService({});
    };

    const toggleBulkCategory = (categoryId: string) => {
        setBulkCategoryIds((prev) =>
            prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
        );
        setBulkTierByService({});
    };

    const selectAllBulkOccasions = () => {
        setBulkOccasionIds(occasions.map((o) => o.id));
    };

    const clearBulkOccasions = () => {
        setBulkOccasionIds([]);
        setBulkCategoryIds([]);
        setBulkTierByService({});
    };

    const selectAllBulkCategories = () => {
        setBulkCategoryIds(bulkCategories.map((c) => c.id));
        setBulkTierByService({});
    };

    const clearBulkCategories = () => {
        setBulkCategoryIds([]);
        setBulkTierByService({});
    };

    const selectAllBulkServiceTiers = () => {
        const next: Record<string, Set<string>> = {};
        for (const svc of bulkCatalogServices) {
            const priced = listPricedTiers(svc);
            if (!priced.length) continue;
            next[svc.id] = new Set(priced.map((t) => t.key));
        }
        setBulkTierByService(next);
    };

    const clearBulkServiceTiers = () => {
        setBulkTierByService({});
    };

    const handleBulkSave = async () => {
        if (bulkOccasionIds.length === 0 || bulkCategoryIds.length === 0) {
            showToast({ variant: 'warning', title: 'Required', message: 'Select at least one occasion and a category.' });
            return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const singleOccasionId = bulkOccasionIds.length === 1 ? bulkOccasionIds[0] : '';
        const singleOccasionName =
            singleOccasionId ? occasions.find((o) => o.id === singleOccasionId)?.name || singleOccasionId : '';
        const bulkCategoryLabelById: Record<string, string> = {};
        for (const category of bulkCategories) {
            bulkCategoryLabelById[category.id] = category.name;
        }
        const rows: any[] = [];
        for (const svc of bulkCatalogServices) {
            if (!bulkCategoryIds.includes(String(svc.category_id))) continue;
            const tiers = bulkTierByService[svc.id];
            if (!tiers || tiers.size === 0) continue;
            for (const tk of tiers) {
                const price = getTierPrice(svc, tk);
                if (price <= 0) continue;
                rows.push({
                    name: svc.name,
                    price_amount: price,
                    category: bulkCategoryLabelById[String(svc.category_id)] || svc.category || 'Service',
                    occasion_id: svc.occasion_id || singleOccasionId || null,
                    occasion_name: svc.occasion_name || singleOccasionName || null,
                    description: svc.description ? String(svc.description).trim() : null,
                    is_active: true,
                    image_urls: [],
                    vendor_id: user.id,
                    pricing_type: tk,
                    offerable_service_id: svc.id,
                });
            }
        }
        if (rows.length === 0) {
            showToast({ variant: 'warning', title: 'Nothing to add', message: 'Select at least one catalog service and pricing tier.' });
            return;
        }
        try {
            setBulkSaving(true);
            let { error } = await supabase.from('services').insert(rows);
            if (error && isMissingOccasionColumnError(error)) {
                const fallbackRows = rows.map((row) => stripOccasionFields(row));
                const retry = await supabase.from('services').insert(fallbackRows);
                error = retry.error;
            }
            if (error) throw error;
            setBulkModalVisible(false);
            fetchServices();
            showToast({ variant: 'success', title: 'Bulk add complete', message: `Added ${rows.length} service line(s).` });
        } catch (e: any) {
            showToast({ variant: 'error', title: 'Bulk add failed', message: e?.message || 'Bulk add failed' });
        } finally {
            setBulkSaving(false);
        }
    };

    const openEditModal = (service: any) => {
        setEditingService(service);
        setIsNew(false);
        setSelectedImages([]);
        if (vendorCategoryId && vendorCategoryLabel) {
            setCategories([{ id: vendorCategoryId, name: vendorCategoryLabel }]);
        } else {
            setCategories([]);
        }
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

    const ServiceThumb = ({ imageUrl }: { imageUrl: string | null | undefined }) => {
        const [displayUrl, setDisplayUrl] = useState<string>('');
        const [loadingThumb, setLoadingThumb] = useState(true);

        useEffect(() => {
            const loadImage = async () => {
                setLoadingThumb(true);
                if (!imageUrl || imageUrl.startsWith('file') || imageUrl.startsWith('content')) {
                    setLoadingThumb(false);
                    return;
                }
                try {
                    const url = await getImageUrl(imageUrl);
                    if (url) setDisplayUrl(url);
                } catch {
                    setDisplayUrl('');
                } finally {
                    setLoadingThumb(false);
                }
            };
            loadImage();
        }, [imageUrl]);

        if (!imageUrl) {
            return (
                <View className="w-24 h-24 rounded-2xl items-center justify-center" style={{ backgroundColor: colors.surface }}>
                    <Store size={20} color={colors.textSecondary} />
                </View>
            );
        }

        if (loadingThumb) {
            return (
                <View className="w-24 h-24 rounded-2xl items-center justify-center" style={{ backgroundColor: colors.surface }}>
                    <ActivityIndicator size="small" color="#FF6B00" />
                </View>
            );
        }

        return displayUrl ? (
            <Image source={{ uri: displayUrl }} className="w-24 h-24 rounded-2xl" resizeMode="cover" />
        ) : (
            <View className="w-24 h-24 rounded-2xl items-center justify-center" style={{ backgroundColor: colors.surface }}>
                <Store size={20} color={colors.textSecondary} />
            </View>
        );
    };

    const getServiceImages = (svc: any): string[] => {
        const fromArray = Array.isArray(svc?.image_urls) ? svc.image_urls.filter(Boolean) : [];
        if (fromArray.length > 0) return fromArray;
        if (svc?.image_url) return [svc.image_url];
        return [];
    };

    const ServiceImageCarousel = ({
        imageUrls,
        height = 192,
    }: {
        imageUrls: string[];
        height?: number;
    }) => {
        const [resolvedUrls, setResolvedUrls] = useState<string[]>([]);
        const [loadingCarousel, setLoadingCarousel] = useState(false);
        const [activeIndex, setActiveIndex] = useState(0);
        const [containerWidth, setContainerWidth] = useState(320);
        const depKey = imageUrls.join('|');

        useEffect(() => {
            let cancelled = false;
            const raw = (imageUrls || []).filter(Boolean);
            if (raw.length === 0) {
                setResolvedUrls([]);
                setLoadingCarousel(false);
                setActiveIndex(0);
                return;
            }
            setLoadingCarousel(true);
            (async () => {
                try {
                    const resolved = await Promise.all(
                        raw.map(async (u) => {
                            if (u.startsWith('file') || u.startsWith('content')) return u;
                            const r = await getImageUrl(u);
                            return r || '';
                        })
                    );
                    if (cancelled) return;
                    setResolvedUrls(resolved.filter(Boolean));
                    setActiveIndex(0);
                } finally {
                    if (!cancelled) setLoadingCarousel(false);
                }
            })();
            return () => {
                cancelled = true;
            };
        }, [depKey]);

        if (imageUrls.length === 0) {
            return (
                <View className="w-full items-center justify-center" style={{ height, backgroundColor: colors.surface }}>
                    <View className="items-center">
                        <Store size={40} color={colors.textSecondary} />
                        <Text className="text-xs mt-2 font-bold" style={{ color: colors.textSecondary }}>No Image</Text>
                    </View>
                </View>
            );
        }

        if (loadingCarousel && resolvedUrls.length === 0) {
            return (
                <View className="w-full items-center justify-center" style={{ height, backgroundColor: colors.surface }}>
                    <ActivityIndicator size="large" color="#FF6B00" />
                </View>
            );
        }

        if (resolvedUrls.length === 0) {
            return (
                <View className="w-full items-center justify-center" style={{ height, backgroundColor: colors.surface }}>
                    <View className="items-center">
                        <Store size={40} color={colors.textSecondary} />
                        <Text className="text-xs mt-2 font-bold" style={{ color: colors.textSecondary }}>Image Not Available</Text>
                    </View>
                </View>
            );
        }

        return (
            <View
                className="w-full relative"
                style={{ height, backgroundColor: colors.surface }}
                onLayout={(e) => {
                    const nextW = e.nativeEvent.layout.width || 0;
                    if (nextW > 0 && nextW !== containerWidth) setContainerWidth(nextW);
                }}
            >
                <FlatList
                    data={resolvedUrls}
                    horizontal
                    pagingEnabled
                    bounces={false}
                    keyExtractor={(u, i) => `${u}-${i}`}
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={resolvedUrls.length > 1}
                    renderItem={({ item }) => (
                        <Image
                            source={{ uri: item }}
                            style={{ width: containerWidth, height }}
                            resizeMode="cover"
                        />
                    )}
                    onMomentumScrollEnd={(e) => {
                        if (!containerWidth) return;
                        const next = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
                        setActiveIndex(next);
                    }}
                />
                {resolvedUrls.length > 1 ? (
                    <>
                        <View
                            className="absolute top-3 right-3 px-2 py-1 rounded-full"
                            style={{ backgroundColor: colors.surface + 'D9' }}
                        >
                            <Text className="text-[10px] font-bold" style={{ color: colors.text }}>
                                {activeIndex + 1}/{resolvedUrls.length}
                            </Text>
                        </View>
                        <View className="absolute bottom-3 w-full flex-row justify-center items-center">
                            {resolvedUrls.map((_, idx) => (
                                <View
                                    key={`dot-${idx}`}
                                    className="mx-1 rounded-full"
                                    style={{
                                        width: idx === activeIndex ? 14 : 7,
                                        height: 7,
                                        backgroundColor: idx === activeIndex ? colors.primary : '#FFFFFFB3',
                                    }}
                                />
                            ))}
                        </View>
                    </>
                ) : null}
            </View>
        );
    };

    const renderServiceCard = ({ item }: { item: any }) => (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => openPreviewModal(item)}
            className="px-3 py-2 mb-2 rounded-lg flex-row items-center"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
            <TouchableOpacity
                onPress={() => toggleServiceSelection(item.id)}
                className="w-7 h-7 rounded-full items-center justify-center mr-3"
                style={{
                    backgroundColor: selectedServiceIds.includes(item.id) ? colors.primary : colors.background,
                    borderWidth: 1,
                    borderColor: selectedServiceIds.includes(item.id) ? colors.primary : colors.border,
                }}
            >
                {selectedServiceIds.includes(item.id) ? <Check size={14} color="white" /> : null}
            </TouchableOpacity>
            <View className="flex-1 mr-3">
                <Text numberOfLines={1} className="text-sm font-semibold" style={{ color: colors.text }}>
                    {item.name}
                </Text>
                <Text numberOfLines={1} className="text-[11px] mt-0.5" style={{ color: colors.textSecondary }}>
                    {item.category || 'Service'} • {item.pricing_type ? getPricingTierLabel(item.pricing_type) : 'Custom'} • ₹{item.price_amount}
                </Text>
                <Text numberOfLines={1} className="text-[11px] mt-0.5" style={{ color: colors.textSecondary }}>
                    {getOccasionDisplayValue(item) ? `Occasion: ${getOccasionDisplayValue(item)}` : ''}
                </Text>
            </View>
            <TouchableOpacity onPress={() => openEditModal(item)} className="p-2 mr-1">
                <Edit3 size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteService(item.id)} className="p-2">
                <Trash2 size={16} color="#EF4444" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const renderServiceGallery = () => (
        <View className="mt-3 rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <View className="flex-row items-center justify-between mb-2">
                <Text className="font-bold" style={{ color: colors.text }}>Service Gallery</Text>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>{serviceGalleryUrls.length}/12</Text>
            </View>
            <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
                Add shared images for your service catalogue (same style as profile gallery).
            </Text>
            <FlatList
                horizontal
                data={[...serviceGalleryUrls, '__add__']}
                keyExtractor={(item, i) => (item === '__add__' ? 'service-gallery-add' : `${item}-${i}`)}
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={handleServiceGalleryViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 30 }}
                renderItem={({ item }) => {
                    if (item === '__add__') {
                        return (
                            <TouchableOpacity
                                onPress={addServiceGalleryImages}
                                disabled={updating || serviceGalleryUrls.length >= 12}
                                className="w-24 h-24 rounded-2xl mr-3 border-2 border-dashed items-center justify-center"
                                style={{ borderColor: colors.border, opacity: serviceGalleryUrls.length >= 12 ? 0.4 : 1 }}
                            >
                                <Plus size={24} color={colors.primary} />
                                <Text className="text-[10px] font-bold mt-1" style={{ color: colors.textSecondary }}>Add</Text>
                            </TouchableOpacity>
                        );
                    }
                    const uri = serviceGallerySigned[item] || item;
                    return (
                        <View className="mr-3 relative">
                            {serviceGallerySigned[item] ? (
                                <Image source={{ uri }} className="w-24 h-24 rounded-2xl" style={{ backgroundColor: colors.background }} />
                            ) : (
                                <View className="w-24 h-24 rounded-2xl items-center justify-center" style={{ backgroundColor: colors.background }}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                </View>
                            )}
                            <TouchableOpacity
                                onPress={() => removeServiceGalleryImage(item)}
                                className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-red-500 items-center justify-center"
                            >
                                <X size={14} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    );
                }}
            />
        </View>
    );

    if (loading) {
        return <AppScreenSkeleton cardCount={5} includeHero={false} />;
    }

    return (
        <SafeAreaView edges={['left', 'right']} className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-6 py-4 z-10">
                <View className="rounded-3xl p-5 flex-row justify-between items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <View className="flex-1 mr-3">
                        <Text className="text-2xl font-bold" style={{ color: colors.text }}>My Services</Text>
                        <Text className="text-xs" style={{ color: colors.textSecondary }}>Manage your product catalog</Text>
                        {vendorCategoryLabel ? (
                            <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                                Catalog category: {vendorCategoryLabel}
                            </Text>
                        ) : !vendorCategoryLoading ? (
                            <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                                Set your business category in Profile to add catalog services.
                            </Text>
                        ) : null}
                    </View>
                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            onPress={openBulkModal}
                            className="bg-primary/15 w-12 h-12 rounded-2xl items-center justify-center border border-primary/30"
                        >
                            <Layers size={22} color="#FF6B00" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={openAddModal}
                            className="bg-primary w-12 h-12 rounded-2xl items-center justify-center shadow-lg shadow-primary/20"
                        >
                            <Plus size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
                <View className="mt-3 rounded-2xl px-3 py-2 flex-row items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <TextInput
                        className="flex-1"
                        value={serviceSearchQuery}
                        onChangeText={setServiceSearchQuery}
                        placeholder="Filter services by name, category, tier"
                        placeholderTextColor={colors.textSecondary}
                        style={{ color: colors.text, fontWeight: '600', paddingVertical: 4 }}
                    />
                    {serviceSearchQuery.trim().length > 0 ? (
                        <TouchableOpacity
                            onPress={() => setServiceSearchQuery('')}
                            className="ml-2 w-7 h-7 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                        >
                            <X size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <View className="mt-3 rounded-2xl p-3 flex-row items-center justify-between" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>
                        {selectedServiceIds.length > 0 ? `${selectedServiceIds.length} selected` : `${filteredServices.length} shown`}
                    </Text>
                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            onPress={deleteSelectedServices}
                            disabled={selectedServiceIds.length === 0}
                            className="px-3 py-1.5 rounded-lg"
                            style={{
                                backgroundColor: '#FEE2E2',
                                borderWidth: 1,
                                borderColor: '#FECACA',
                                opacity: selectedServiceIds.length === 0 ? 0.45 : 1,
                            }}
                        >
                            <Text className="text-xs font-semibold" style={{ color: '#DC2626' }}>Delete selected</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={selectAllFilteredServices}
                            className="px-3 py-1.5 rounded-lg"
                            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                        >
                            <Text className="text-xs font-semibold" style={{ color: colors.text }}>Select all</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={clearServiceSelection}
                            className="px-3 py-1.5 rounded-lg"
                            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                        >
                            <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>Unselect all</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <FlatList
                data={filteredServices}
                renderItem={renderServiceCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={7}
                removeClippedSubviews
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
                        <Text className="font-medium" style={{ color: colors.textSecondary }}>
                            {services.length > 0 ? 'No services match your filter' : 'No services found'}
                        </Text>
                        <TouchableOpacity
                            onPress={openAddModal}
                            className="mt-4 bg-primary px-6 py-3 rounded-xl"
                        >
                            <Text className="text-white font-bold">Add Your First Service</Text>
                        </TouchableOpacity>
                    </View>
                )}
                ListFooterComponent={renderServiceGallery}
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
                                {isNew ? (
                                    <>
                                        <View>
                                            <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Occasion</Text>
                                            <TouchableOpacity
                                                onPress={() => setOccasionPickerVisible(true)}
                                                className="rounded-2xl px-4 py-4 flex-row items-center justify-between"
                                                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                            >
                                                <Text style={{ color: editingService?.occasion_name ? colors.text : colors.textSecondary, fontWeight: '600' }}>
                                                    {editingService?.occasion_name || 'Select occasion (filters catalog)'}
                                                </Text>
                                                <ChevronDown size={20} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Category from Profile — catalog is scoped to this category for every occasion */}
                                        <View>
                                            <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>Category (from profile)</Text>
                                            <View
                                                className="rounded-2xl px-4 py-4 flex-row items-center justify-between"
                                                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                            >
                                                <Text style={{ color: vendorCategoryLabel ? colors.text : colors.textSecondary, fontWeight: '600' }}>
                                                    {vendorCategoryLoading
                                                        ? 'Loading…'
                                                        : vendorCategoryLabel || 'Set in Profile'}
                                                </Text>
                                            </View>
                                            {!vendorCategoryLoading && !vendorCategoryId ? (
                                                <Text className="text-xs mt-2" style={{ color: colors.textSecondary }}>
                                                    Set your business category under Profile so only catalog items for your line of business appear.
                                                </Text>
                                            ) : null}
                                        </View>

                                        {/* Catalog Service Dropdown */}
                                        {editingService?.occasion_id && editingService?.category && vendorCategoryId ? (
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
                                        <View className="mt-4">
                                            <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>
                                                Description
                                            </Text>
                                            <TextInput
                                                value={editingService?.description || ''}
                                                onChangeText={(t) => setEditingService({ ...editingService, description: t })}
                                                multiline
                                                numberOfLines={4}
                                                className="rounded-2xl px-4 py-4 font-semibold"
                                                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, minHeight: 96, textAlignVertical: 'top' }}
                                                placeholder="Add service description"
                                                placeholderTextColor={colors.textSecondary}
                                            />
                                        </View>
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
                                        <View className="mt-4">
                                            <Text className="text-sm font-bold mb-2 uppercase tracking-widest text-[10px]" style={{ color: colors.text }}>
                                                Description
                                            </Text>
                                            <TextInput
                                                value={editingService?.description || ''}
                                                onChangeText={(t) => setEditingService({ ...editingService, description: t })}
                                                multiline
                                                numberOfLines={4}
                                                className="rounded-2xl px-4 py-4 font-semibold"
                                                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, minHeight: 96, textAlignVertical: 'top' }}
                                                placeholder="Add service description"
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

            {/* Occasion Picker (new service — matches customer-facing occasion → category → catalog) */}
            <Modal
                visible={occasionPickerVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setOccasionPickerVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View
                        className="rounded-t-3xl p-6"
                        style={{
                            backgroundColor: colors.surface,
                            height: '60%',
                        }}
                    >
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold" style={{ color: colors.text }}>Select Occasion</Text>
                            <TouchableOpacity onPress={() => setOccasionPickerVisible(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {occasions.length === 0 ? (
                            <View className="flex-1 items-center justify-center py-20">
                                <Text style={{ color: colors.textSecondary }}>No occasions loaded. Check API URL.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={occasions}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (vendorCategoryLoading) {
                                                showToast({ variant: 'info', title: 'Please wait', message: 'Loading your profile category…' });
                                                return;
                                            }
                                            if (!vendorCategoryId) {
                                                showToast({
                                                    variant: 'warning',
                                                    title: 'Category required',
                                                    message: 'Set your business category in Profile first.',
                                                });
                                                return;
                                            }
                                            setOccasionPickerVisible(false);
                                            const cats = await fetchCategoriesForOccasion(item.id);
                                            if (cats.length === 0) {
                                                showToast({
                                                    variant: 'warning',
                                                    title: 'Not available for this occasion',
                                                    message: 'Your business category is not linked to this occasion in the catalog. Try another occasion or update catalog mapping.',
                                                });
                                                return;
                                            }
                                            const c = cats[0];
                                            setEditingService({
                                                ...editingService,
                                                occasion_id: item.id,
                                                occasion_name: item.name,
                                                category: c.name,
                                                category_id: c.id,
                                                name: '',
                                                price_amount: '',
                                                pricing_type: '',
                                                offerable_service_id: '',
                                            });
                                            setSelectedCatalogService(null);
                                            setCatalogServices([]);
                                            fetchCatalogServices(item.id, c.id);
                                        }}
                                        className="py-4 px-4 rounded-xl mb-2 flex-row items-center justify-between"
                                        style={{
                                            backgroundColor:
                                                editingService?.occasion_id === item.id
                                                    ? colors.primary + '1A'
                                                    : colors.background,
                                            borderWidth: editingService?.occasion_id === item.id ? 1 : 0,
                                            borderColor:
                                                editingService?.occasion_id === item.id
                                                    ? colors.primary + '33'
                                                    : 'transparent',
                                        }}
                                    >
                                        <Text
                                            className="text-base font-bold"
                                            style={{
                                                color:
                                                    editingService?.occasion_id === item.id
                                                        ? colors.primary
                                                        : colors.text,
                                            }}
                                        >
                                            {item.name}
                                        </Text>
                                        {editingService?.occasion_id === item.id && (
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
                                                const oid = editingService?.occasion_id;
                                                setEditingService({
                                                    ...editingService,
                                                    category: item.name,
                                                    category_id: item.id,
                                                    name: '',
                                                    price_amount: '',
                                                    pricing_type: '',
                                                    offerable_service_id: '',
                                                });
                                                setSelectedCatalogService(null);
                                                setCatalogServices([]);
                                                if (oid) fetchCatalogServices(oid, item.id);
                                            } else {
                                                setEditingService({
                                                    ...editingService,
                                                    category: item.name,
                                                    category_id: item.id,
                                                });
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
                                            setEditingService({
                                                ...editingService,
                                                name: item.name,
                                                description: item?.description ? String(item.description) : (editingService?.description || ''),
                                                offerable_service_id: item.id,
                                                price_amount: '',
                                                pricing_type: '',
                                            });
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
                                        {listPricedTiers(selectedCatalogService).map((tier) => (
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
                                                Catalog tier
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

            {/* Bulk add: occasion + category + multi tier selection */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={bulkModalVisible}
                onRequestClose={() => !bulkSaving && setBulkModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View
                        className="rounded-t-3xl p-6"
                        style={{ backgroundColor: colors.surface, maxHeight: '92%' }}
                    >
                        <View className="flex-row justify-between items-center mb-4">
                            <View>
                                <Text className="text-xl font-bold" style={{ color: colors.text }}>Bulk add</Text>
                                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                    Catalog is limited to your business category from Profile and the occasions you pick.
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => !bulkSaving && setBulkModalVisible(false)}
                                disabled={bulkSaving}
                            >
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>
                                Occasion
                            </Text>
                            <View className="flex-row gap-2 mb-3">
                                <TouchableOpacity
                                    onPress={selectAllBulkOccasions}
                                    className="px-3 py-1.5 rounded-lg"
                                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Text className="text-xs font-semibold" style={{ color: colors.text }}>Select all</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={clearBulkOccasions}
                                    className="px-3 py-1.5 rounded-lg"
                                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>Clear</Text>
                                </TouchableOpacity>
                            </View>
                            <View className="flex-row flex-wrap gap-2 mb-4">
                                {occasions.map((o) => (
                                    <TouchableOpacity
                                        key={o.id}
                                        onPress={() => toggleBulkOccasion(o.id)}
                                        className="px-3 py-2 rounded-xl"
                                        style={{
                                            backgroundColor:
                                                bulkOccasionIds.includes(o.id) ? colors.primary + '22' : colors.background,
                                            borderWidth: 1,
                                            borderColor: bulkOccasionIds.includes(o.id) ? colors.primary : colors.border,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: bulkOccasionIds.includes(o.id) ? colors.primary : colors.text,
                                                fontWeight: '600',
                                                fontSize: 13,
                                            }}
                                        >
                                            {o.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>
                                Category
                            </Text>
                            <View className="flex-row gap-2 mb-3">
                                <TouchableOpacity
                                    onPress={selectAllBulkCategories}
                                    disabled={bulkCategories.length === 0}
                                    className="px-3 py-1.5 rounded-lg"
                                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, opacity: bulkCategories.length === 0 ? 0.5 : 1 }}
                                >
                                    <Text className="text-xs font-semibold" style={{ color: colors.text }}>Select all</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={clearBulkCategories}
                                    className="px-3 py-1.5 rounded-lg"
                                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>Clear</Text>
                                </TouchableOpacity>
                            </View>
                            {bulkOccasionIds.length === 0 ? (
                                <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
                                    Choose at least one occasion first. Categories listed are only those mapped to your selection.
                                </Text>
                            ) : bulkCategoriesLoading ? (
                                <View className="py-6 mb-4 items-center justify-center">
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text className="text-xs mt-3" style={{ color: colors.textSecondary }}>
                                        Loading categories…
                                    </Text>
                                </View>
                            ) : bulkCategories.length === 0 ? (
                                <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
                                    Your profile category is not linked to this occasion in the catalog. Try another occasion or update mappings.
                                </Text>
                            ) : null}
                            {!bulkCategoriesLoading ? (
                                <View className="flex-row flex-wrap gap-2 mb-4">
                                    {bulkCategories.map((c) => (
                                        <TouchableOpacity
                                            key={c.id}
                                            onPress={() => toggleBulkCategory(c.id)}
                                            className="px-3 py-2 rounded-xl"
                                            style={{
                                                backgroundColor:
                                                    bulkCategoryIds.includes(c.id) ? colors.primary + '22' : colors.background,
                                                borderWidth: 1,
                                                borderColor: bulkCategoryIds.includes(c.id) ? colors.primary : colors.border,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: bulkCategoryIds.includes(c.id) ? colors.primary : colors.text,
                                                    fontWeight: '600',
                                                    fontSize: 13,
                                                }}
                                            >
                                                {c.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : null}
                            {bulkOccasionIds.length > 0 && bulkCategoryIds.length > 0 && bulkCatalogServicesLoading ? (
                                <View className="py-8 mb-2 items-center justify-center">
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text className="text-xs mt-3" style={{ color: colors.textSecondary }}>
                                        Loading catalog services…
                                    </Text>
                                </View>
                            ) : null}
                            {bulkOccasionIds.length > 0 &&
                            bulkCategoryIds.length > 0 &&
                            !bulkCatalogServicesLoading &&
                            bulkCatalogServices.length === 0 ? (
                                <Text className="py-6 text-center" style={{ color: colors.textSecondary }}>
                                    No catalog services for this combination.
                                </Text>
                            ) : null}
                            {bulkCatalogServices.length > 0 ? (
                                <View className="flex-row gap-2 mb-3">
                                    <TouchableOpacity
                                        onPress={selectAllBulkServiceTiers}
                                        className="px-3 py-1.5 rounded-lg"
                                        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                    >
                                        <Text className="text-xs font-semibold" style={{ color: colors.text }}>Select all services & tiers</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={clearBulkServiceTiers}
                                        className="px-3 py-1.5 rounded-lg"
                                        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                    >
                                        <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>Clear</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                            {!bulkCatalogServicesLoading
                                ? bulkCatalogServices.map((svc) => {
                                const priced = listPricedTiers(svc);
                                if (priced.length === 0) return null;
                                return (
                                    <View
                                        key={svc.id}
                                        className="mb-4 p-4 rounded-2xl"
                                        style={{
                                            backgroundColor: colors.background,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                        }}
                                    >
                                        <Text className="font-bold" style={{ color: colors.text }}>
                                            {svc.name}
                                        </Text>
                                        <View className="flex-row flex-wrap gap-2 mt-3">
                                            {priced.map((t) => {
                                                const sel = bulkTierByService[svc.id]?.has(t.key);
                                                return (
                                                    <TouchableOpacity
                                                        key={t.key}
                                                        onPress={() => toggleBulkTier(svc.id, t.key)}
                                                        className="px-2 py-1.5 rounded-lg"
                                                        style={{
                                                            backgroundColor: sel ? colors.primary + '20' : colors.surface,
                                                            borderWidth: 1,
                                                            borderColor: sel ? colors.primary : colors.border,
                                                        }}
                                                    >
                                                        <Text
                                                            className="text-xs font-semibold"
                                                            style={{ color: sel ? colors.primary : colors.text }}
                                                        >
                                                            {t.label} ₹{t.price}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                );
                                })
                                : null}
                            <TouchableOpacity
                                onPress={handleBulkSave}
                                disabled={bulkSaving}
                                className="py-4 rounded-2xl items-center mt-2 mb-8"
                                style={{ backgroundColor: colors.primary, opacity: bulkSaving ? 0.7 : 1 }}
                            >
                                {bulkSaving ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold">Add selected tiers</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
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
                        <View className="flex-row justify-end p-5 pb-0">
                            <TouchableOpacity
                                onPress={() => setPreviewModalVisible(false)}
                                className="w-10 h-10 rounded-full items-center justify-center"
                                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                            >
                                <X size={20} color={colors.text} />
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
                                <View className="px-4 py-1.5 rounded-full mr-3" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                    <Text className="font-bold text-xs" style={{ color: colors.textSecondary }}>
                                        {getOccasionDisplayValue(previewServiceData)}
                                    </Text>
                                </View>
                                <View className="flex-row items-center">
                                    <Star size={14} color="#FF6B00" fill="#FF6B00" />
                                    <Text className="text-sm font-bold ml-1" style={{ color: colors.text }}>4.8 (120 reviews)</Text>
                                </View>
                            </View>
                            <View className="rounded-2xl p-4 mb-8" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                <Text className="text-[11px] uppercase font-bold tracking-widest mb-2" style={{ color: colors.textSecondary }}>
                                    Description
                                </Text>
                                <Text className="text-sm leading-6" style={{ color: colors.textSecondary }}>
                                    {previewServiceData?.description?.trim() || ''}
                                </Text>
                            </View>
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
