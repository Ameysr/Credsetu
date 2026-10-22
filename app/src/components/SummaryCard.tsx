import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Summary } from '../api/types';
import { colors, fontSize, radius, spacing } from '../theme';
import { formatMoney, formatMoneyCompact } from '../utils/money';

interface Props {
  summary: Summary | null;
  loading: boolean;
}

export function SummaryCard({ summary, loading }: Props): React.JSX.Element {
  const currency = summary?.currency ?? 'INR';
  const totals = summary?.totals;
  const overdue = totals?.overdueMinor ?? 0;

  return (
    <View style={styles.card}>
      {/* Top Header Tag */}
      <View style={styles.headerRow}>
        <View style={styles.tagBadge}>
          <View style={styles.tagDot} />
          <Text style={styles.headerLabel}>Portfolio Overview</Text>
        </View>
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {/* Main Metric: Total Lent */}
      <View style={styles.heroMetric}>
        <Text style={styles.heroCaption}>Total Lent</Text>
        <Text style={styles.totalAmount} accessibilityLabel="Total lent">
          {formatMoneyCompact(totals?.lentMinor ?? 0, currency)}
        </Text>
      </View>

      {/* Subtle Hairline Divider */}
      <View style={styles.divider} />

      {/* Metrics Row: Repaid & Outstanding */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <View style={styles.labelWithDot}>
            <View style={[styles.miniDot, { backgroundColor: colors.success }]} />
            <Text style={styles.metricLabel}>Repaid</Text>
          </View>
          <Text style={[styles.metricValue, { color: colors.success }]}>
            {formatMoney(totals?.repaidMinor ?? 0, currency)}
          </Text>
          <Text style={styles.metricMeta}>
            {summary?.counts.repaid ?? 0} of {summary?.counts.total ?? 0} loans
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <View style={styles.labelWithDot}>
            <View style={[styles.miniDot, { backgroundColor: colors.accentGold }]} />
            <Text style={styles.metricLabel}>Outstanding</Text>
          </View>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {formatMoney(totals?.outstandingMinor ?? 0, currency)}
          </Text>
          <Text style={styles.metricMeta}>
            {summary?.counts.outstanding ?? 0} pending
          </Text>
        </View>
      </View>

      {/* Overdue Alert Bar */}
      <View style={[styles.overdueBox, overdue > 0 ? styles.overdueActive : styles.overdueClear]}>
        <View style={styles.overdueLeft}>
          <View style={[styles.statusDot, overdue > 0 ? styles.dotDanger : styles.dotClear]} />
          <Text style={[styles.overdueLabel, overdue > 0 ? styles.overdueLabelDanger : styles.overdueLabelClear]}>
            {overdue > 0 ? `Overdue · ${summary?.counts.overdue ?? 0} late` : 'All loans on track'}
          </Text>
        </View>
        <Text style={[styles.overdueAmount, overdue > 0 ? styles.overdueAmountDanger : styles.overdueAmountClear]}>
          {formatMoney(overdue, currency)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  headerLabel: {
    fontSize: fontSize.xxs,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroMetric: {
    marginVertical: spacing.xs,
  },
  heroCaption: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: fontSize.display,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  metricItem: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: '100%',
    backgroundColor: colors.borderSubtle,
  },
  labelWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  miniDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  metricLabel: {
    fontSize: fontSize.xxs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metricMeta: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 2,
  },
  overdueBox: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  overdueActive: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  overdueClear: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderSubtle,
  },
  overdueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotDanger: {
    backgroundColor: colors.danger,
  },
  dotClear: {
    backgroundColor: colors.primary,
  },
  overdueLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  overdueLabelDanger: {
    color: colors.danger,
  },
  overdueLabelClear: {
    color: colors.textMuted,
  },
  overdueAmount: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  overdueAmountDanger: {
    color: colors.danger,
  },
  overdueAmountClear: {
    color: colors.textDim,
  },
});
