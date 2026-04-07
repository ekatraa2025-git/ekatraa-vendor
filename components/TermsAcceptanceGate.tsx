import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    Modal,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import { getVendorAgreementFullText } from "../legal/vendorAgreementSections";
import {
    acceptVendorTermsAndSync,
    loadAcceptedVendorTerms,
    syncPendingTermsEmailIfNeeded,
} from "../lib/vendorTermsAcceptance";

export default function TermsAcceptanceGate({ children }: { children: React.ReactNode }) {
    const { colors } = useTheme();
    const [ready, setReady] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const row = await loadAcceptedVendorTerms();
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
            await syncPendingTermsEmailIfNeeded();
        })();
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async () => {
            await syncPendingTermsEmailIfNeeded();
        });
        return () => subscription.unsubscribe();
    }, [accepted, ready]);

    const onAccept = useCallback(async () => {
        if (!checked) return;
        await acceptVendorTermsAndSync();
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
                    <Text style={styles.ctaText}>Accept Vendor Terms & Conditions</Text>
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
