/**
 * Persisted vendor terms acceptance (startup gate + login modal).
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { VENDOR_TERMS_VERSION } from "../legal/vendorAgreementSections";

export const STORAGE_ACCEPT = "ekatraa_vendor_terms_acceptance";
const STORAGE_EMAIL_PENDING = "ekatraa_vendor_terms_email_pending";

export type AcceptedTermsRow = { version: string; acceptedAt: string } | null;

export async function loadAcceptedVendorTerms(): Promise<AcceptedTermsRow> {
    try {
        const raw = await SecureStore.getItemAsync(STORAGE_ACCEPT);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.version === VENDOR_TERMS_VERSION && parsed?.acceptedAt) return parsed;
    } catch {
        /* ignore */
    }
    return null;
}

function buildDeviceInfo(): string {
    const appVersion = Constants.expoConfig?.version ?? "";
    return [
        `platform=${Platform.OS}`,
        `osVersion=${String(Platform.Version)}`,
        `appVersion=${appVersion}`,
        `deviceName=${Constants.deviceName ?? ""}`,
    ].join("; ");
}

async function postTermsAcceptance(payload: {
    vendor_email: string | null;
    vendor_id: string | null;
    accepted_at: string;
    terms_version: string;
    device_info: string;
}) {
    const apiUrl =
        process.env.EXPO_PUBLIC_API_URL ||
        (Constants.expoConfig?.extra as { EXPO_PUBLIC_API_URL?: string; API_URL?: string } | undefined)
            ?.EXPO_PUBLIC_API_URL ||
        (Constants.expoConfig?.extra as { API_URL?: string } | undefined)?.API_URL;
    if (!apiUrl) return { ok: false as const, error: "No API URL" };
    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/public/vendor/terms-acceptance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const t = await res.text();
            return { ok: false as const, error: t || res.statusText };
        }
        return { ok: true as const };
    } catch (e: unknown) {
        return { ok: false as const, error: e instanceof Error ? e.message : "network" };
    }
}

async function trySendAcceptanceToBackend(acceptedAt: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const device_info = buildDeviceInfo();
    const result = await postTermsAcceptance({
        vendor_email: user?.email ?? null,
        vendor_id: user?.id ?? null,
        accepted_at: acceptedAt,
        terms_version: VENDOR_TERMS_VERSION,
        device_info,
    });
    if (result.ok) {
        await SecureStore.deleteItemAsync(STORAGE_EMAIL_PENDING);
        return;
    }
    await SecureStore.setItemAsync(STORAGE_EMAIL_PENDING, "1");
}

/** Record acceptance locally and best-effort sync to API (same as startup gate). */
export async function acceptVendorTermsAndSync(): Promise<void> {
    const acceptedAt = new Date().toISOString();
    await SecureStore.setItemAsync(
        STORAGE_ACCEPT,
        JSON.stringify({ version: VENDOR_TERMS_VERSION, acceptedAt })
    );
    await trySendAcceptanceToBackend(acceptedAt);
}

export async function syncPendingTermsEmailIfNeeded(): Promise<void> {
    const pending = await SecureStore.getItemAsync(STORAGE_EMAIL_PENDING);
    const row = await loadAcceptedVendorTerms();
    if (pending === "1" && row?.acceptedAt) await trySendAcceptanceToBackend(row.acceptedAt);
}
