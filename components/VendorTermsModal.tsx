import React, { useState } from "react";
import {
    View,
    Text,
    Modal,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { getVendorAgreementFullText } from "../legal/vendorAgreementSections";
import { acceptVendorTermsAndSync } from "../lib/vendorTermsAcceptance";

/** Same legal text as TermsAcceptanceGate; can record acceptance from login. */
export default function VendorTermsModal({
    visible,
    onClose,
}: {
    visible: boolean;
    onClose: () => void;
}) {
    const { colors } = useTheme();
    const fullText = getVendorAgreementFullText();
    const [checked, setChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleClose = () => {
        setChecked(false);
        setSubmitting(false);
        onClose();
    };

    const handleAccept = async () => {
        if (!checked || submitting) return;
        setSubmitting(true);
        try {
            await acceptVendorTermsAndSync();
            handleClose();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
            <View style={[styles.shell, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={handleClose} style={styles.closeHit} hitSlop={12}>
                        <Ionicons name="close" size={26} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>Vendor Terms & Conditions</Text>
                    <View style={{ width: 40 }} />
                </View>
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
                    disabled={submitting}
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
                        styles.accept,
                        (!checked || submitting) && styles.ctaDisabled,
                        { backgroundColor: colors.primary },
                    ]}
                    onPress={handleAccept}
                    disabled={!checked || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.acceptText}>Accept Vendor Terms & Conditions</Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.closeBtn, { borderColor: colors.border }]} onPress={handleClose}>
                    <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>Close without accepting</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    shell: { flex: 1, paddingBottom: 24 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    closeHit: { padding: 8 },
    title: { fontSize: 18, fontWeight: "700", flex: 1, textAlign: "center" },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 32 },
    body: { fontSize: 14, lineHeight: 22 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginHorizontal: 16,
        marginTop: 8,
        paddingVertical: 8,
    },
    checkLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
    accept: {
        marginHorizontal: 16,
        marginTop: 8,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
    },
    ctaDisabled: { opacity: 0.45 },
    acceptText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
    closeBtn: {
        marginHorizontal: 16,
        marginTop: 10,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: "center",
    },
    closeBtnText: { fontSize: 15, fontWeight: "600" },
});
