import { supabase } from './supabase';
import Constants from 'expo-constants';

const BUCKET = 'ekatraa2025';

function getBackendApiBase(): string {
    const raw =
        process.env.EXPO_PUBLIC_API_URL ||
        Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
        Constants.expoConfig?.extra?.API_URL ||
        '';
    const base = raw.replace(/\/+$/, '');
    if (!base) return '';
    return base.endsWith('/api') ? base : `${base}/api`;
}

/**
 * Object path inside the bucket (may include folders, e.g. uploads/abc.jpg).
 * Returns null when the ref is already a signed URL — use that URL as-is.
 */
export function storagePathFromRef(ref: string): string | null {
    const s = ref.trim();
    if (!s) return null;

    if (s.startsWith('http://') || s.startsWith('https://')) {
        if (s.includes('token=')) return null;

        const m = s.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/[^/]+\/(.+?)(?:\?|$)/i);
        if (m?.[1]) {
            return decodeURIComponent(m[1].replace(/\+/g, ' '));
        }
        const m2 = s.match(/\/ekatraa2025\/(.+?)(?:\?|$)/i);
        if (m2?.[1]) {
            return decodeURIComponent(m2[1].replace(/\+/g, ' '));
        }
        return null;
    }

    return s.replace(/^\/+/, '');
}

async function fetchBackendSignedUrl(path: string): Promise<string | null> {
    const apiBase = getBackendApiBase();
    if (!apiBase) return null;
    try {
        const url = `${apiBase}/public/storage/signed-url?path=${encodeURIComponent(path)}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const j = (await res.json()) as { url?: string };
        return typeof j.url === 'string' ? j.url : null;
    } catch {
        return null;
    }
}

/**
 * Resolves a DB storage ref or Supabase object URL to a time-limited signed URL
 * so images load when the bucket is private. Nested paths (e.g. uploads/…) are preserved.
 */
export async function resolveStorageImageUrl(
    urlOrPath: string | null | undefined,
    ttlSeconds: number = 86400
): Promise<string> {
    if (!urlOrPath) return '';
    const s = urlOrPath.trim();
    if (!s) return '';

    if (s.startsWith('file:') || s.startsWith('content:') || s.startsWith('ph:') || s.startsWith('blob:')) {
        return s;
    }

    if (s.includes('token=') && (s.includes('supabase') || s.includes('storage'))) {
        return s;
    }

    if (s.startsWith('http') && !s.includes('supabase.co') && !s.includes('ekatraa2025')) {
        return s;
    }

    const extracted = storagePathFromRef(s);
    if (extracted === null && s.startsWith('http')) {
        return s;
    }
    const objectPath = extracted ?? s.replace(/^\/+/, '');

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(objectPath, ttlSeconds);
    if (!error && data?.signedUrl) {
        return data.signedUrl;
    }

    const backendUrl = await fetchBackendSignedUrl(objectPath);
    if (backendUrl) {
        return backendUrl;
    }

    if (__DEV__) {
        console.warn('[storage] Could not sign URL for path:', objectPath, error);
    }
    return '';
}
