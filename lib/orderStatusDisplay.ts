/**
 * Vendor-facing order status chip: quotation → final invoice → customer approval.
 */

export type VendorOrderStatusKind =
    | 'approved'
    | 'invoice_sent'
    | 'quotation_sent'
    | 'order_status';

export function getVendorOrderStatusBadge(order: {
    status?: string;
    quotation_submitted?: boolean;
    quotations?: unknown[] | null;
    vendor_invoice?: { status?: string | null } | null;
}): { label: string; kind: VendorOrderStatusKind } {
    const inv = order?.vendor_invoice;
    const invStatus = String(inv?.status ?? '').toLowerCase();

    if (inv && invStatus === 'accepted') {
        return { label: 'Approved', kind: 'approved' };
    }
    if (inv && invStatus === 'submitted') {
        return { label: 'Invoice Sent', kind: 'invoice_sent' };
    }

    const hasQuote =
        !!order?.quotation_submitted ||
        (Array.isArray(order?.quotations) && order.quotations.length > 0);

    if (hasQuote) {
        return { label: 'Quotation Sent', kind: 'quotation_sent' };
    }

    const raw = String(order?.status ?? 'pending');
    const label = raw.replace(/_/g, ' ');
    return { label: label.charAt(0).toUpperCase() + label.slice(1), kind: 'order_status' };
}

export function getVendorOrderBadgeColors(
    kind: VendorOrderStatusKind,
    orderStatus: string | undefined,
    isDarkMode: boolean
): { bg: string; fg: string } {
    switch (kind) {
        case 'approved':
            return isDarkMode
                ? { bg: '#064E3B', fg: '#6EE7B7' }
                : { bg: '#D1FAE5', fg: '#059669' };
        case 'invoice_sent':
            return isDarkMode
                ? { bg: '#4C1D95', fg: '#DDD6FE' }
                : { bg: '#EDE9FE', fg: '#5B21B6' };
        case 'quotation_sent':
            return isDarkMode
                ? { bg: '#064E3B', fg: '#6EE7B7' }
                : { bg: '#D1FAE5', fg: '#059669' };
        default: {
            const s = String(orderStatus || '').toLowerCase();
            if (s === 'pending')
                return isDarkMode
                    ? { bg: '#7C2D12', fg: '#FBBF24' }
                    : { bg: '#FED7AA', fg: '#D97706' };
            if (s === 'completed')
                return isDarkMode
                    ? { bg: '#1E3A8A', fg: '#93C5FD' }
                    : { bg: '#DBEAFE', fg: '#2563EB' };
            if (s === 'cancelled')
                return isDarkMode
                    ? { bg: '#450A0A', fg: '#FCA5A5' }
                    : { bg: '#FEE2E2', fg: '#B91C1C' };
            return isDarkMode
                ? { bg: '#374151', fg: '#9CA3AF' }
                : { bg: '#F3F4F6', fg: '#4B5563' };
        }
    }
}
