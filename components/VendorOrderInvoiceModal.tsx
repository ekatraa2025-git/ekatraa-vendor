import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react-native';
import { fetchVendorInvoiceDraft, submitVendorOrderInvoice } from '../lib/vendor-api';
import { useToast } from '../context/ToastContext';

export type InvoiceLine = { description: string; quantity: string; unit_price: string };

type Props = {
    visible: boolean;
    onClose: () => void;
    orderId: string;
    colors: {
        text: string;
        textSecondary: string;
        background: string;
        surface: string;
        border: string;
        primary: string;
    };
    canEdit: boolean;
    onSubmitted: () => void;
};

export default function VendorOrderInvoiceModal({ visible, onClose, orderId, colors, canEdit, onSubmitted }: Props) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lines, setLines] = useState<InvoiceLine[]>([]);
    const [vendorName, setVendorName] = useState('');
    const [vendorLogoUrl, setVendorLogoUrl] = useState('');
    const [vendorGstin, setVendorGstin] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [cgstRate, setCgstRate] = useState('9');
    const [sgstRate, setSgstRate] = useState('9');

    const loadDraft = useCallback(async () => {
        if (!orderId) return;
        setLoading(true);
        try {
            const { data, error } = await fetchVendorInvoiceDraft(orderId);
            if (error || !data) {
                showToast({ variant: 'error', title: 'Could not load invoice', message: error || 'Could not load invoice draft.' });
                return;
            }
            const d = data.defaults || {};
            const inv = data.invoice;
            const baseLines = (inv?.line_items as { description?: string; quantity?: number; unit_price?: number }[])?.length
                ? (inv.line_items as { description?: string; quantity?: number; unit_price?: number }[]).map((r) => ({
                      description: String(r.description ?? ''),
                      quantity: String(r.quantity ?? ''),
                      unit_price: String(r.unit_price ?? ''),
                  }))
                : (d.line_items || []).map((r: { description?: string; quantity?: number; unit_price?: number }) => ({
                      description: String(r.description ?? ''),
                      quantity: String(r.quantity ?? ''),
                      unit_price: String(r.unit_price ?? ''),
                  }));
            setLines(baseLines.length ? baseLines : [{ description: '', quantity: '1', unit_price: '0' }]);
            setVendorName(inv?.vendor_display_name ?? d.vendor_display_name ?? '');
            setVendorLogoUrl(inv?.vendor_logo_url ?? d.vendor_logo_url ?? '');
            setVendorGstin(inv?.vendor_gstin ?? d.vendor_gstin ?? '');
            setInvoiceNumber(inv?.invoice_number ?? d.invoice_number ?? '');
            setNotes(inv?.notes ?? d.notes ?? '');
            setCgstRate(String(inv?.cgst_rate ?? d.cgst_rate ?? 9));
            setSgstRate(String(inv?.sgst_rate ?? d.sgst_rate ?? 9));
        } finally {
            setLoading(false);
        }
    }, [orderId, showToast]);

    useEffect(() => {
        if (visible && orderId) loadDraft();
    }, [visible, orderId, loadDraft]);

    const subtotal = lines.reduce((s, l) => {
        const q = Math.max(0, Number(l.quantity) || 0);
        const p = Math.max(0, Number(l.unit_price) || 0);
        return s + q * p;
    }, 0);
    const cgst = (subtotal * (Math.min(100, Math.max(0, Number(cgstRate) || 0)) || 0)) / 100;
    const sgst = (subtotal * (Math.min(100, Math.max(0, Number(sgstRate) || 0)) || 0)) / 100;
    const grand = subtotal + cgst + sgst;

    const addLine = () => setLines((prev) => [...prev, { description: '', quantity: '1', unit_price: '0' }]);
    const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

    const handleSubmit = async () => {
        if (!canEdit) return;
        const payload = {
            line_items: lines.map((l) => ({
                description: l.description,
                quantity: Number(l.quantity) || 0,
                unit_price: Number(l.unit_price) || 0,
            })),
            cgst_rate: Number(cgstRate) || 0,
            sgst_rate: Number(sgstRate) || 0,
            vendor_display_name: vendorName.trim(),
            vendor_logo_url: vendorLogoUrl.trim() || null,
            vendor_gstin: vendorGstin.trim() || null,
            invoice_number: invoiceNumber.trim() || null,
            notes: notes.trim() || null,
        };
        setSaving(true);
        const { error } = await submitVendorOrderInvoice(orderId, payload);
        setSaving(false);
        if (error) {
            showToast({ variant: 'error', title: 'Could not send invoice', message: error });
            return;
        }
        showToast({ variant: 'success', title: 'Invoice sent', message: 'Final invoice was sent to the customer.' });
        onSubmitted();
        onClose();
    };

    return (
        <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.surface }}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                    <View className="px-6 py-4 flex-row items-center justify-between border-b" style={{ borderBottomColor: colors.border }}>
                        <TouchableOpacity onPress={onClose}>
                            <ArrowLeft size={22} color={colors.text} />
                        </TouchableOpacity>
                        <Text className="text-lg font-bold" style={{ color: colors.text }}>
                            Final invoice
                        </Text>
                        <View style={{ width: 22 }} />
                    </View>
                    {loading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    ) : (
                        <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
                            {!canEdit ? (
                                <Text className="mb-4" style={{ color: colors.textSecondary }}>
                                    This invoice was accepted by the customer and cannot be edited.
                                </Text>
                            ) : null}
                            <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>
                                Vendor name (on invoice)
                            </Text>
                            <TextInput
                                value={vendorName}
                                onChangeText={setVendorName}
                                editable={canEdit}
                                className="rounded-2xl px-4 py-3 mb-4"
                                style={{
                                    backgroundColor: colors.background,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    color: colors.text,
                                }}
                            />
                            <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>
                                Logo URL (optional)
                            </Text>
                            <TextInput
                                value={vendorLogoUrl}
                                onChangeText={setVendorLogoUrl}
                                editable={canEdit}
                                placeholder="https://..."
                                placeholderTextColor={colors.textSecondary}
                                className="rounded-2xl px-4 py-3 mb-4"
                                style={{
                                    backgroundColor: colors.background,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    color: colors.text,
                                }}
                            />
                            <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>
                                GSTIN (optional)
                            </Text>
                            <TextInput
                                value={vendorGstin}
                                onChangeText={setVendorGstin}
                                editable={canEdit}
                                className="rounded-2xl px-4 py-3 mb-4"
                                style={{
                                    backgroundColor: colors.background,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    color: colors.text,
                                }}
                            />
                            <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>
                                Invoice number
                            </Text>
                            <TextInput
                                value={invoiceNumber}
                                onChangeText={setInvoiceNumber}
                                editable={canEdit}
                                className="rounded-2xl px-4 py-3 mb-4"
                                style={{
                                    backgroundColor: colors.background,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    color: colors.text,
                                }}
                            />
                            <View className="flex-row gap-3 mb-4">
                                <View className="flex-1">
                                    <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>
                                        CGST %
                                    </Text>
                                    <TextInput
                                        value={cgstRate}
                                        onChangeText={setCgstRate}
                                        editable={canEdit}
                                        keyboardType="decimal-pad"
                                        className="rounded-2xl px-4 py-3"
                                        style={{
                                            backgroundColor: colors.background,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            color: colors.text,
                                        }}
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>
                                        SGST %
                                    </Text>
                                    <TextInput
                                        value={sgstRate}
                                        onChangeText={setSgstRate}
                                        editable={canEdit}
                                        keyboardType="decimal-pad"
                                        className="rounded-2xl px-4 py-3"
                                        style={{
                                            backgroundColor: colors.background,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            color: colors.text,
                                        }}
                                    />
                                </View>
                            </View>
                            <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>
                                Line items
                            </Text>
                            {lines.map((line, idx) => (
                                <View key={idx} className="mb-3 p-3 rounded-2xl" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                                    <TextInput
                                        value={line.description}
                                        onChangeText={(t) =>
                                            setLines((prev) => prev.map((p, i) => (i === idx ? { ...p, description: t } : p)))
                                        }
                                        editable={canEdit}
                                        placeholder="Description"
                                        placeholderTextColor={colors.textSecondary}
                                        className="mb-2 font-semibold"
                                        style={{ color: colors.text }}
                                    />
                                    <View className="flex-row gap-2">
                                        <TextInput
                                            value={line.quantity}
                                            onChangeText={(t) =>
                                                setLines((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: t } : p)))
                                            }
                                            editable={canEdit}
                                            keyboardType="decimal-pad"
                                            placeholder="Qty"
                                            placeholderTextColor={colors.textSecondary}
                                            className="flex-1 rounded-xl px-3 py-2"
                                            style={{ borderWidth: 1, borderColor: colors.border, color: colors.text }}
                                        />
                                        <TextInput
                                            value={line.unit_price}
                                            onChangeText={(t) =>
                                                setLines((prev) => prev.map((p, i) => (i === idx ? { ...p, unit_price: t } : p)))
                                            }
                                            editable={canEdit}
                                            keyboardType="decimal-pad"
                                            placeholder="Unit ₹"
                                            placeholderTextColor={colors.textSecondary}
                                            className="flex-1 rounded-xl px-3 py-2"
                                            style={{ borderWidth: 1, borderColor: colors.border, color: colors.text }}
                                        />
                                        {canEdit && lines.length > 1 ? (
                                            <TouchableOpacity onPress={() => removeLine(idx)} className="p-2">
                                                <Trash2 size={20} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            ))}
                            {canEdit ? (
                                <TouchableOpacity onPress={addLine} className="flex-row items-center mb-4">
                                    <Plus size={18} color={colors.primary} />
                                    <Text className="ml-2 font-bold" style={{ color: colors.primary }}>
                                        Add line
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                            <Text className="text-xs font-bold uppercase mb-2" style={{ color: colors.textSecondary }}>
                                Notes (optional)
                            </Text>
                            <TextInput
                                value={notes}
                                onChangeText={setNotes}
                                editable={canEdit}
                                multiline
                                numberOfLines={3}
                                className="rounded-2xl px-4 py-3 mb-4"
                                style={{
                                    backgroundColor: colors.background,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    color: colors.text,
                                    minHeight: 80,
                                    textAlignVertical: 'top',
                                }}
                            />
                            <View className="p-4 rounded-2xl mb-4" style={{ backgroundColor: colors.primary + '14', borderWidth: 1, borderColor: colors.primary + '44' }}>
                                <Text style={{ color: colors.text }}>Subtotal: ₹{subtotal.toFixed(2)}</Text>
                                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                                    CGST: ₹{cgst.toFixed(2)} · SGST: ₹{sgst.toFixed(2)}
                                </Text>
                                <Text className="text-lg font-bold mt-2" style={{ color: colors.text }}>
                                    Grand total: ₹{grand.toFixed(2)}
                                </Text>
                            </View>
                            {canEdit ? (
                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    disabled={saving}
                                    className="py-4 rounded-2xl items-center"
                                    style={{ backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }}
                                >
                                    {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Submit to customer</Text>}
                                </TouchableOpacity>
                            ) : null}
                        </ScrollView>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}
