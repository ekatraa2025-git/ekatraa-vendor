import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react-native';
import { useTheme } from './ThemeContext';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'brand';

export interface ShowToastOptions {
  variant?: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

export interface ShowConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export interface ShowAcknowledgeOptions {
  title: string;
  message?: string;
  buttonLabel?: string;
  onPress?: () => void | Promise<void>;
}

interface ToastContextValue {
  showToast: (opts: ShowToastOptions) => void;
  showConfirm: (opts: ShowConfirmOptions) => void;
  showAcknowledge: (opts: ShowAcknowledgeOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const VARIANT: Record<
  Exclude<ToastVariant, 'brand'>,
  { bgLight: string; bgDark: string; border: string; icon: string }
> = {
  success: { bgLight: '#ECFDF5', bgDark: '#064E3B', border: '#10B981', icon: '#059669' },
  error: { bgLight: '#FEF2F2', bgDark: '#450A0A', border: '#EF4444', icon: '#DC2626' },
  warning: { bgLight: '#FFFBEB', bgDark: '#422006', border: '#F59E0B', icon: '#D97706' },
  info: { bgLight: '#EFF6FF', bgDark: '#172554', border: '#3B82F6', icon: '#2563EB' },
};

function ToastIcon({ variant, color }: { variant: ToastVariant; color: string }) {
  const size = 22;
  if (variant === 'success') return <CheckCircle2 size={size} color={color} />;
  if (variant === 'error') return <XCircle size={size} color={color} />;
  if (variant === 'warning') return <AlertTriangle size={size} color={color} />;
  return <Info size={size} color={color} />;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [toast, setToast] = useState<(ShowToastOptions & { variant: ToastVariant }) | null>(null);
  const [confirm, setConfirm] = useState<ShowConfirmOptions | null>(null);
  const [ack, setAck] = useState<ShowAcknowledgeOptions | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-24)).current;

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const dismissToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -16, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showToast = useCallback(
    (opts: ShowToastOptions) => {
      clearHideTimer();
      const variant = opts.variant ?? 'info';
      setToast({
        variant,
        title: opts.title,
        message: opts.message,
        duration: opts.duration ?? 3800,
      });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    translateY.setValue(-20);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      dismissToast();
    }, toast.duration ?? 3800);

    return () => clearHideTimer();
  }, [toast, dismissToast, opacity, translateY]);

  const showConfirm = useCallback((opts: ShowConfirmOptions) => {
    setConfirm(opts);
  }, []);

  const showAcknowledge = useCallback((opts: ShowAcknowledgeOptions) => {
    setAck(opts);
  }, []);

  const value = useMemo(
    () => ({ showToast, showConfirm, showAcknowledge }),
    [showToast, showConfirm, showAcknowledge]
  );

  const palette = toast
    ? toast.variant === 'brand'
      ? {
          bg: isDarkMode ? `${colors.primary}28` : '#FFF7ED',
          border: colors.primary,
          icon: colors.primaryDark,
        }
      : (() => {
          const v = VARIANT[toast.variant];
          return {
            bg: isDarkMode ? v.bgDark : v.bgLight,
            border: v.border,
            icon: v.icon,
          };
        })()
    : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && palette && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastWrap,
            {
              paddingTop: insets.top + 8,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Pressable
            onPress={dismissToast}
            style={[
              styles.toastCard,
              {
                backgroundColor: palette.bg,
                borderColor: palette.border,
                shadowColor: isDarkMode ? '#000' : palette.border,
              },
            ]}
          >
            <ToastIcon variant={toast.variant} color={palette.icon} />
            <View style={styles.toastTextCol}>
              <Text style={[styles.toastTitle, { color: colors.text }]} numberOfLines={2}>
                {toast.title}
              </Text>
              {toast.message ? (
                <Text style={[styles.toastMsg, { color: colors.textSecondary }]} numberOfLines={4}>
                  {toast.message}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={dismissToast} hitSlop={12} accessibilityLabel="Dismiss">
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      )}

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirm(null)}>
          <Pressable
            style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.dialogTitle, { color: colors.text }]}>{confirm?.title}</Text>
            {confirm?.message ? (
              <Text style={[styles.dialogBody, { color: colors.textSecondary }]}>{confirm.message}</Text>
            ) : null}
            <View style={styles.dialogRow}>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setConfirm(null)}
              >
                <Text style={[styles.dialogBtnText, { color: colors.text }]}>
                  {confirm?.cancelLabel ?? 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dialogBtn,
                  confirm?.destructive
                    ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                    : { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={async () => {
                  const c = confirm;
                  setConfirm(null);
                  if (c?.onConfirm) await c.onConfirm();
                }}
              >
                <Text
                  style={[
                    styles.dialogBtnText,
                    { color: confirm?.destructive ? '#FFF' : '#FFF' },
                  ]}
                >
                  {confirm?.confirmLabel ?? 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!ack} transparent animationType="fade" onRequestClose={() => setAck(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAck(null)}>
          <Pressable
            style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.dialogTitle, { color: colors.text }]}>{ack?.title}</Text>
            {ack?.message ? (
              <Text style={[styles.dialogBody, { color: colors.textSecondary }]}>{ack.message}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.dialogBtnFull, { backgroundColor: colors.primary }]}
              onPress={async () => {
                const a = ack;
                setAck(null);
                if (a?.onPress) await a.onPress();
              }}
            >
              <Text style={[styles.dialogBtnText, { color: '#FFF' }]}>{ack?.buttonLabel ?? 'OK'}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 99999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    maxWidth: 420,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  toastTextCol: { flex: 1, minWidth: 0 },
  toastTitle: { fontSize: 16, fontWeight: '700' },
  toastMsg: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  dialogTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  dialogBody: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  dialogRow: { flexDirection: 'row', gap: 12 },
  dialogBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  dialogBtnFull: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  dialogBtnText: { fontSize: 16, fontWeight: '700' },
});

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

/** Map server notification type to toast variant */
export function notificationToastVariant(
  type: 'order_update' | 'system_update' | 'quotation' | 'general'
): ToastVariant {
  switch (type) {
    case 'order_update':
      return 'brand';
    case 'quotation':
      return 'success';
    case 'system_update':
      return 'warning';
    default:
      return 'info';
  }
}
