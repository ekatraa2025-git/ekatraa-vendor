/**
 * Catalog (offerable_services) tier keys aligned with admin / consumer apps.
 */
export const CATALOG_TIER_DEFS: {
    key: string;
    priceField: keyof Record<string, unknown>;
    label: string;
}[] = [
    { key: 'basic', priceField: 'price_basic', label: 'Basic' },
    { key: 'classic_value', priceField: 'price_classic_value', label: 'Classic Value' },
    { key: 'signature', priceField: 'price_signature', label: 'Signature' },
    { key: 'prestige', priceField: 'price_prestige', label: 'Prestige' },
    { key: 'royal', priceField: 'price_royal', label: 'Royal' },
    { key: 'imperial', priceField: 'price_imperial', label: 'Imperial' },
];

export function getTierPrice(catalog: Record<string, unknown>, tierKey: string): number {
    const def = CATALOG_TIER_DEFS.find((t) => t.key === tierKey);
    if (!def) return 0;
    const v = catalog[def.priceField as string];
    const n = typeof v === 'number' ? v : v != null ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function listPricedTiers(catalog: Record<string, unknown>): { key: string; label: string; price: number }[] {
    return CATALOG_TIER_DEFS.map(({ key, label }) => ({
        key,
        label,
        price: getTierPrice(catalog, key),
    })).filter((t) => t.price > 0);
}
