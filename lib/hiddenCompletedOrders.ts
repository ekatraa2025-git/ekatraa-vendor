import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'ekatraa_vendor_orders_hidden_ids';

export async function loadHiddenOrderIds(): Promise<Set<string>> {
    try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw) as unknown;
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.filter((x) => typeof x === 'string'));
    } catch {
        return new Set();
    }
}

export async function saveHiddenOrderIds(ids: Set<string>): Promise<void> {
    try {
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify([...ids]));
    } catch (e) {
        console.warn('[hiddenCompletedOrders] save failed', e);
    }
}
