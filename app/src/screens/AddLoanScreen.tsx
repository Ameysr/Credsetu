import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError, api } from '../api/client';
import { DateField } from '../components/DateField';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSize, radius, spacing } from '../theme';
import { defaultDueDate } from '../utils/dates';

type Props = NativeStackScreenProps<RootStackParamList, 'AddLoan'>;

type FieldErrors = Partial<Record<'friendName' | 'amount' | 'dueDate' | 'note', string>>;

function mimeTypeFor(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;

  const extension = asset.uri.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return 'image/jpeg';
  }
}

export function AddLoanScreen({ navigation }: Props): React.JSX.Element {
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const pickReceipt = useCallback(async () => {
    setFormError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFormError('Photo access is needed to attach a receipt. You can add the entry without one.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (asset) setReceipt(asset);
  }, []);

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (!friendName.trim()) next.friendName = 'Who did you lend to?';

    const trimmedAmount = amount.trim();
    if (!trimmedAmount) {
      next.amount = 'Enter an amount';
    } else if (!/^\d+(\.\d{1,2})?$/.test(trimmedAmount) || Number(trimmedAmount) <= 0) {
      next.amount = 'Use a positive amount with at most 2 decimals';
    }

    if (Number.isNaN(dueDate.getTime())) next.dueDate = 'Pick a valid date';

    return next;
  }

  const save = useCallback(async () => {
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setFormError(null);
    setIsSaving(true);

    try {
      const { loan } = await api.createLoan({
        friendName: friendName.trim(),
        amount: amount.trim(),
        dueDate: dueDate.toISOString(),
        note: note.trim() || undefined,
      });

      if (receipt) {
        try {
          await api.uploadReceipt(loan.id, {
            uri: receipt.uri,
            name: receipt.fileName ?? `receipt-${loan.id}.jpg`,
            type: mimeTypeFor(receipt),
          });
        } catch (caught) {
          Alert.alert(
            'Entry saved',
            `The receipt could not be attached. ${caught instanceof ApiError ? caught.message : ''}`.trim(),
          );
        }
      }

      navigation.goBack();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422 && Array.isArray(caught.details)) {
        const mapped: FieldErrors = {};
        for (const detail of caught.details as Array<{ path?: string; message?: string }>) {
          if (detail?.path && detail.message) mapped[detail.path as keyof FieldErrors] = detail.message;
        }
        setErrors(mapped);
      } else {
        setFormError(caught instanceof ApiError ? caught.message : 'Could not save the entry.');
      }
    } finally {
      setIsSaving(false);
    }
  }, [amount, dueDate, friendName, note, navigation, receipt]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
        >
          <Text style={styles.headerAction}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Loan Entry</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <FormField
            label="Friend's name"
            value={friendName}
            onChangeText={setFriendName}
            placeholder="e.g. Alex"
            autoFocus
            maxLength={100}
            error={errors.friendName}
          />

          <FormField
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            prefix="₹"
            keyboardType="decimal-pad"
            error={errors.amount}
            hint="Enter amount in Rupees (up to 2 decimals)."
          />

          <DateField label="Due date" value={dueDate} onChange={setDueDate} />

          <FormField
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Dinner, Concert tickets, Split bill"
            maxLength={500}
            error={errors.note}
          />

          <Text style={styles.sectionLabel}>RECEIPT (OPTIONAL)</Text>

          {receipt ? (
            <View style={styles.receiptContainer}>
              <Image source={{ uri: receipt.uri }} style={styles.thumbnail} />
              <View style={styles.receiptInfo}>
                <Text style={styles.receiptName} numberOfLines={1}>
                  {receipt.fileName ?? 'Selected receipt photo'}
                </Text>
                <Pressable onPress={() => setReceipt(null)} hitSlop={8} style={styles.removeBtn}>
                  <Text style={styles.removeText}>Remove image</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => void pickReceipt()}
              style={({ pressed }) => [styles.uploadArea, pressed && styles.uploadAreaPressed]}
            >
              <Text style={styles.uploadIcon}>📎</Text>
              <Text style={styles.uploadTitle}>Attach receipt photo</Text>
              <Text style={styles.uploadSubtitle}>JPEG, PNG, WebP up to 5MB</Text>
            </Pressable>
          )}

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <PrimaryButton
            label="Save entry"
            onPress={() => void save()}
            loading={isSaving}
            style={styles.saveButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  cancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  cancelBtnPressed: {
    opacity: 0.6,
  },
  headerAction: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  headerSpacer: {
    width: 48,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  uploadArea: {
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    marginBottom: spacing.lg,
  },
  uploadAreaPressed: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  uploadIcon: {
    fontSize: fontSize.xl,
    marginBottom: spacing.xs,
  },
  uploadTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  uploadSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 2,
  },
  receiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  receiptInfo: {
    flex: 1,
  },
  receiptName: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '600',
  },
  removeBtn: {
    marginTop: 4,
  },
  removeText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: '600',
  },
  formError: {
    marginBottom: spacing.md,
    fontSize: fontSize.xs,
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '500',
  },
  saveButton: {
    marginTop: spacing.sm,
  },
});
