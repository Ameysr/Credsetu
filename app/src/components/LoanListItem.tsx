import React from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../api/client';
import type { Loan } from '../api/types';
import { colors, fontSize, radius, spacing } from '../theme';
import { describeDueDate, formatDate } from '../utils/dates';
import { formatMoney } from '../utils/money';

interface Props {
  loan: Loan;
  busy: boolean;
  onMarkRepaid: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
}

export function LoanListItem({ loan, busy, onMarkRepaid, onDelete }: Props): React.JSX.Element {
  const dueLabel = describeDueDate(loan);
  const initial = loan.friendName.trim().charAt(0).toUpperCase() || '•';

  function confirmDelete(): void {
    Alert.alert(
      'Delete entry',
      `Remove the ${formatMoney(loan.amountMinor, loan.currency)} entry for ${loan.friendName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(loan) },
      ],
    );
  }

  function openReceipt(): void {
    if (!loan.receiptUrl) return;
    void Linking.openURL(`${API_BASE_URL}${loan.receiptUrl}`);
  }

  return (
    <Pressable
      onLongPress={confirmDelete}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.card,
        loan.isOverdue && styles.overdueCard,
        loan.isRepaid && styles.repaidCard,
        pressed && styles.cardPressed,
      ]}
      accessibilityHint="Long press to delete"
    >
      {/* Top Row: Avatar Initial, Name, and Amount */}
      <View style={styles.topRow}>
        <View style={styles.friendInfo}>
          <View
            style={[
              styles.avatar,
              loan.isOverdue && styles.avatarOverdue,
              loan.isRepaid && styles.avatarRepaid,
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                loan.isOverdue && styles.avatarTextOverdue,
                loan.isRepaid && styles.avatarTextRepaid,
              ]}
            >
              {initial}
            </Text>
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.name} numberOfLines={1}>
              {loan.friendName}
            </Text>
            <View style={styles.metaRow}>
              <Text
                style={[
                  styles.metaDate,
                  loan.isOverdue && styles.metaOverdue,
                  loan.isRepaid && styles.metaRepaid,
                ]}
              >
                {loan.isRepaid ? 'Settled' : `${formatDate(loan.dueDate)} · ${dueLabel}`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.amountBlock}>
          <Text
            style={[
              styles.amount,
              loan.isOverdue && styles.amountOverdue,
              loan.isRepaid && styles.amountRepaid,
            ]}
          >
            {formatMoney(loan.amountMinor, loan.currency)}
          </Text>
        </View>
      </View>

      {/* Optional Note */}
      {loan.note ? (
        <View style={styles.noteContainer}>
          <Text style={styles.note} numberOfLines={2}>
            {loan.note}
          </Text>
        </View>
      ) : null}

      {/* Footer Row: Actions & Badges */}
      <View style={styles.footerRow}>
        <View style={styles.footerLeft}>
          {loan.receiptUrl ? (
            <Pressable onPress={openReceipt} hitSlop={8} style={styles.receiptChip}>
              <Text style={styles.receiptIcon}>📎</Text>
              <Text style={styles.receiptText}>Receipt</Text>
            </Pressable>
          ) : (
            <Text style={styles.longPressHint}>Hold to delete</Text>
          )}
        </View>

        <View style={styles.footerRight}>
          {loan.isRepaid ? (
            <View style={styles.repaidBadge}>
              <Text style={styles.repaidCheck}>✓</Text>
              <Text style={styles.repaidBadgeText}>Repaid</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => onMarkRepaid(loan)}
              disabled={busy}
              hitSlop={6}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && styles.actionBtnPressed,
                busy && styles.actionBtnBusy,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${loan.friendName}'s loan repaid`}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.primaryText} />
              ) : (
                <Text style={styles.actionBtnText}>Mark repaid</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
  },
  cardPressed: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderHighlight,
  },
  overdueCard: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  repaidCard: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverdue: {
    backgroundColor: '#35161E',
    borderColor: colors.dangerBorder,
  },
  avatarRepaid: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  avatarText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  avatarTextOverdue: {
    color: colors.danger,
  },
  avatarTextRepaid: {
    color: colors.textMuted,
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaDate: {
    fontSize: fontSize.xs,
    color: colors.textDim,
  },
  metaOverdue: {
    color: colors.danger,
    fontWeight: '600',
  },
  metaRepaid: {
    color: colors.success,
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  amountOverdue: {
    color: colors.danger,
  },
  amountRepaid: {
    color: colors.textDim,
  },
  noteContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  note: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.xs,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
  },
  receiptIcon: {
    fontSize: 10,
  },
  receiptText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  longPressHint: {
    fontSize: fontSize.xxs,
    color: colors.textDim,
    letterSpacing: 0.2,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  actionBtn: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    minWidth: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPressed: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    transform: [{ scale: 0.97 }],
  },
  actionBtnBusy: {
    opacity: 0.7,
  },
  actionBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.1,
  },
  repaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  repaidCheck: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: '700',
  },
  repaidBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.success,
  },
});
