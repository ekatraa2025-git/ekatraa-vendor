import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    Modal,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import {
    VENDOR_TERMS_VERSION,
    getVendorAgreementFullText,
} from "../legal/vendorAgreementSections";

const STORAGE_ACCEPT = "ekatraa_vendor_terms_acceptance";
const STORAGE_EMAIL_PENDING = "ekatraa_vendor_terms_email_pending";

async function loadAccepted() {
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

export default function TermsAcceptanceGate({ children }: { children: React.ReactNode }) {
    const { colors } = useTheme();
    const [ready, setReady] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const row = await loadAccepted();
            if (!cancelled) {
                setAccepted(!!row);
                setReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!accepted || !ready) return;
        (async () => {
            const pending = await SecureStore.getItemAsync(STORAGE_EMAIL_PENDING);
            if (pending === "1") {
                const row = await loadAccepted();
                if (row?.acceptedAt) await trySendAcceptanceToBackend(row.acceptedAt);
            }
        })();
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async () => {
            const p = await SecureStore.getItemAsync(STORAGE_EMAIL_PENDING);
            const row = await loadAccepted();
            if (p === "1" && row?.acceptedAt) await trySendAcceptanceToBackend(row.acceptedAt);
        });
        return () => subscription.unsubscribe();
    }, [accepted, ready]);

    const onAccept = useCallback(async () => {
        if (!checked) return;
        const acceptedAt = new Date().toISOString();
        await SecureStore.setItemAsync(
            STORAGE_ACCEPT,
            JSON.stringify({ version: VENDOR_TERMS_VERSION, acceptedAt })
        );
        await trySendAcceptanceToBackend(acceptedAt);
        setAccepted(true);
    }, [checked]);

    if (!ready) {
        return (
            <View style={[styles.boot, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (accepted) {
        return <>{children}</>;
    }

    const fullText = getVendorAgreementFullText();

    return (
        <Modal visible animationType="fade">
            <View style={[styles.shell, { backgroundColor: colors.background }]}>
                <Text style={[styles.title, { color: colors.text }]}>Vendor Terms & Conditions</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    Please read and accept to continue using the Ekatraa Vendor app.
                </Text>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator
                >
                    <Text style={[styles.body, { color: colors.text }]}>{fullText}</Text>
                </ScrollView>
                <TouchableOpacity
                    style={styles.row}
                    onPress={() => setChecked(!checked)}
                    activeOpacity={0.7}
                >
                    <Text style={{ fontSize: 22, color: checked ? colors.primary : colors.textSecondary }}>
                        {checked ? "☑" : "☐"}
                    </Text>
                    <Text style={[styles.checkLabel, { color: colors.text }]}>
                        I agree to the Vendor Terms & Conditions
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.cta,
                        !checked && styles.ctaDisabled,
                        { backgroundColor: colors.primary },
                    ]}
                    onPress={onAccept}
                    disabled={!checked}
                >
                    <Text style={styles.ctaText}>Accept & Continue</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    boot: { flex: 1, justifyContent: "center", alignItems: "center" },
    shell: { flex: 1, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 24 },
    title: { fontSize: 22, fontWeight: "800" },
    sub: { fontSize: 14, marginTop: 6, marginBottom: 12 },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 16 },
    body: { fontSize: 13, lineHeight: 20 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginTop: 12,
        paddingVertical: 8,
    },
    checkLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
    cta: {
        marginTop: 12,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: "center",
    },
    ctaDisabled: { opacity: 0.45 },
    ctaText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
