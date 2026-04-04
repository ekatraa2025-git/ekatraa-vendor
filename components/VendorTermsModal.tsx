import React from "react";
import {
    View,
    Text,
    Modal,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { getVendorAgreementFullText } from "../legal/vendorAgreementSections";

/** Same legal text as TermsAcceptanceGate at startup; read-only from login. */
export default function VendorTermsModal({
    visible,
    onClose,
}: {
    visible: boolean;
    onClose: () => void;
}) {
    const { colors } = useTheme();
    const fullText = getVendorAgreementFullText();

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <View style={[styles.shell, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeHit} hitSlop={12}>
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
                    style={[styles.done, { backgroundColor: colors.primary }]}
                    onPress={onClose}
                >
                    <Text style={styles.doneText}>Close</Text>
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
    done: { marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
    doneText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
