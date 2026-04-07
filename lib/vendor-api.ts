/**
 * Backend API client for vendor app.
 * Uses Supabase session token for vendor authentication.
 */
import { recoverFromAuthStorageError, supabase } from './supabase';
import Constants from 'expo-constants';

const getApiUrl = (): string => {
    return (
        process.env.EXPO_PUBLIC_API_URL ||
        Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
        Constants.expoConfig?.extra?.API_URL ||
        ''
    );
};

async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) await recoverFromAuthStorageError(error);
    const token = session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

async function getCurrentVendorId(): Promise<string | null> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        await recoverFromAuthStorageError(error);
        return null;
    }
    return user?.id ?? null;
}

function buildApiUrl(path: string): string {
    const base = getApiUrl().replace(/\/+$/, '');
    if (!base) return '';
    // If base already ends with /api, avoid duplicate /api/api.
    if (base.endsWith('/api')) {
        return `${base}${path.replace(/^\/api/, '')}`;
    }
    return `${base}${path}`;
}

export async function fetchVendorOrders(status?: string): Promise<{ data: any[] | null; error: string | null }> {
    const url = buildApiUrl(
        status && status !== 'all'
            ? `/api/vendor/orders?status=${encodeURIComponent(status)}`
            : '/api/vendor/orders'
    );
    if (!url) return { data: null, error: 'API URL not configured' };

    try {
        const headers = await getAuthHeaders();
        const res = await fetch(url, { headers });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            console.warn('[VendorAPI] API error:', res.status, data?.error || res.statusText);
            // Temporary compatibility: some deployments are missing /api/vendor/* routes.
            // If vendor route is 404, use admin APIs and filter by logged-in vendor id.
            if (res.status === 404) {
                const vendorId = await getCurrentVendorId();
                if (!vendorId) return { data: null, error: 'Not authenticated' };

                const adminOrdersRes = await fetch(buildApiUrl('/api/admin/orders'), { headers });
                const adminOrdersData = await adminOrdersRes.json().catch(() => []);
                if (!adminOrdersRes.ok || !Array.isArray(adminOrdersData)) {
                    return { data: null, error: 'Failed to load allocated orders' };
                }

                const filtered = adminOrdersData.filter((o: any) => {
                    const isOrderAllocated = o?.vendor_id === vendorId;
                    const isItemAllocated = Array.isArray(o?.allocation_vendors)
                        ? o.allocation_vendors.some((v: any) => v?.vendor_id === vendorId)
                        : false;
                    if (!isOrderAllocated && !isItemAllocated) return false;
                    if (status && status !== 'all') return o?.status === status;
                    return true;
                });

                // Attach quotation_submitted and latest quotation
                try {
                    const quotesRes = await fetch(buildApiUrl('/api/admin/quotations'), { headers });
                    const quotes = await quotesRes.json().catch(() => []);
                    const vendorQuotes = Array.isArray(quotes)
                        ? quotes.filter((q: any) => q?.vendor_id === vendorId)
                        : [];
                    const quoteByOrder = new Map<string, any>();
                    for (const q of vendorQuotes) {
                        if (!quoteByOrder.has(q.order_id)) quoteByOrder.set(q.order_id, q);
                    }
                    return {
                        data: filtered.map((o: any) => ({
                            ...o,
                            items: Array.isArray(o?.items) ? o.items : [],
                            total_order_price: Number(o?.total_amount || 0),
                            advance_paid: Number(o?.advance_amount || 0),
                            balance_due: Number(o?.total_amount || 0) - Number(o?.advance_amount || 0),
                            quotation_submitted: quoteByOrder.has(o.id),
                            quotation: quoteByOrder.get(o.id) || null,
                        })),
                        error: null,
                    };
                } catch {
                    return {
                        data: filtered.map((o: any) => ({
                            ...o,
                            items: Array.isArray(o?.items) ? o.items : [],
                            total_order_price: Number(o?.total_amount || 0),
                            advance_paid: Number(o?.advance_amount || 0),
                            balance_due: Number(o?.total_amount || 0) - Number(o?.advance_amount || 0),
                            quotation_submitted: false,
                            quotation: null,
                        })),
                        error: null,
                    };
                }
            }
            return { data: null, error: data?.error || res.statusText };
        }
        return { data: Array.isArray(data) ? data : [], error: null };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Network error' };
    }
}

export async function fetchVendorOrderDetail(orderId: string): Promise<{ data: any | null; error: string | null }> {
    const url = buildApiUrl(`/api/vendor/orders/${orderId}`);
    if (!url) return { data: null, error: 'API URL not configured' };

    try {
        const headers = await getAuthHeaders();
        const res = await fetch(url, { headers });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: data?.error || res.statusText };
        return { data, error: null };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Network error' };
    }
}

export interface SubmitQuotationPayload {
    order_id: string;
    service_type?: string;
    amount: number;
    venue_address?: string;
    specifications?: string;
    quantity_requirements?: string;
    quality_standards?: string;
    delivery_terms?: string;
    payment_terms?: string;
    attachments?: Record<string, string[]>;
    valid_until?: string;
    confirmation_date?: string;
    quotation_submitted_at?: string;
}

export async function requestOrderCompletion(orderId: string): Promise<{ data: any | null; error: string | null }> {
    const url = buildApiUrl(`/api/vendor/orders/${orderId}/request-completion`);
    if (!url) return { data: null, error: 'API URL not configured' };

    try {
        const headers = await getAuthHeaders();
        const res = await fetch(url, { method: 'POST', headers });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: data?.error || res.statusText };
        return { data, error: null };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Network error' };
    }
}

export async function confirmOrderCompletion(orderId: string, otp: string): Promise<{ data: any | null; error: string | null }> {
    const url = buildApiUrl(`/api/vendor/orders/${orderId}/confirm-completion`);
    if (!url) return { data: null, error: 'API URL not configured' };

    try {
        const headers = await getAuthHeaders();
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ otp }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: data?.error || res.statusText };
        return { data, error: null };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Network error' };
    }
}

export async function requestOrderStart(orderId: string): Promise<{ data: any | null; error: string | null }> {
    const url = buildApiUrl(`/api/vendor/orders/${orderId}/request-start`);
    if (!url) return { data: null, error: 'API URL not configured' };

    try {
        const headers = await getAuthHeaders();
        const res = await fetch(url, { method: 'POST', headers });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: data?.error || res.statusText };
        return { data, error: null };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Network error' };
    }
}

export async function confirmOrderStart(orderId: string, otp: string): Promise<{ data: any | null; error: string | null }> {
    const url = buildApiUrl(`/api/vendor/orders/${orderId}/confirm-start`);
    if (!url) return { data: null, error: 'API URL not configured' };

    try {
        const headers = await getAuthHeaders();
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ otp }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: data?.error || res.statusText };
        return { data, error: null };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Network error' };
    }
}

export async function fetchVendorInvoiceDraft(orderId: string): Promise<{ data: any | null; error: string | null }> {
    const url = buildApiUrl(`/api/vendor/orders/${orderId}/invoice`);
    if (!url) return { data: null, error: 'API URL not configured' };
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(url, { headers });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: data?.error || res.statusText };
        return { data, error: null };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Network error' };
    }
}

export async function submitVendorOrderInvoice(orderId: string, payload: Record<string, unknown>): Promise<{ data: any | null; error: string | null }> {
    const url = buildApiUrl(`/api/vendor/orders/${orderId}/invoice`);
    if (!url) return { data: null, error: 'API URL not configured' };
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: data?.error || res.statusText };
        return { data, error: null };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Network error' };
    }
}

export async function submitVendorQuotation(payload: SubmitQuotationPayload): Promise<{ data: any | null; error: string | null }> {
    const url = buildApiUrl('/api/vendor/quotations');
    if (!url) return { data: null, error: 'API URL not configured' };

    try {
        const headers = await getAuthHeaders();
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);

        // Fallback: if vendor route returns 404, try admin vendor-submit endpoint
        if (res.status === 404) {
            const fallbackUrl = buildApiUrl('/api/admin/quotations/vendor-submit');
            if (fallbackUrl) {
                const fallbackRes = await fetch(fallbackUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                });
                const fallbackData = await fallbackRes.json().catch(() => null);
                if (!fallbackRes.ok) return { data: null, error: fallbackData?.error || fallbackRes.statusText };
                if (fallbackData && (fallbackData.id || fallbackData.order_id)) return { data: fallbackData, error: null };
                return { data: null, error: 'Invalid response from server' };
            }
        }

        if (!res.ok) return { data: null, error: data?.error || res.statusText };
        if (data && typeof data === 'object' && (data.id || data.order_id)) return { data, error: null };
        return { data: null, error: data?.error || 'Invalid response from server' };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Network error' };
    }
}
