import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError, api } from '../api/client';
import type { Loan, LoanStatus, Summary } from '../api/types';
import { EmptyState } from '../components/EmptyState';
import { LoanListItem } from '../components/LoanListItem';
import { PrimaryButton } from '../components/PrimaryButton';
import { SummaryCard } from '../components/SummaryCard';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, fontSize, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const FILTERS: Array<{ value: LoanStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'repaid', label: 'Repaid' },
];

const EMPTY_COPY: Record<LoanStatus, { title: string; description: string }> = {
  all: { title: 'No entries yet', description: 'Add your first loan record to begin tracking.' },
  outstanding: { title: 'Nothing outstanding', description: 'All your loans have been fully settled.' },
  overdue: { title: 'No overdue payments', description: 'None of your friends are currently past due.' },
  repaid: { title: 'No repaid loans yet', description: 'Settled payments will show up here.' },
};

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { user, signOut } = useAuth();

  const [status, setStatus] = useState<LoanStatus>('all');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);

      try {
        const [loansResponse, summaryResponse] = await Promise.all([
          api.listLoans(status),
          api.summary(),
        ]);
        setLoans(loansResponse.loans);
        setSummary(summaryResponse);
        setError(null);
      } catch (caught) {
        if (caught instanceof ApiError && caught.isUnauthorized) {
          await signOut();
          return;
        }
        setError(caught instanceof ApiError ? caught.message : 'Could not load your entries.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [status, signOut],
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  const markRepaid = useCallback(
    async (loan: Loan) => {
      setBusyLoanId(loan.id);
      try {
        await api.markRepaid(loan.id);
        await load();
      } catch (caught) {
        Alert.alert('Could not update', caught instanceof ApiError ? caught.message : 'Try again.');
      } finally {
        setBusyLoanId(null);
      }
    },
    [load],
  );

  const deleteLoan = useCallback(
    async (loan: Loan) => {
      setBusyLoanId(loan.id);
      try {
        await api.deleteLoan(loan.id);
        await load();
      } catch (caught) {
        Alert.alert('Could not delete', caught instanceof ApiError ? caught.message : 'Try again.');
      } finally {
        setBusyLoanId(null);
      }
    },
    [load],
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={loans}
      keyExtractor={(loan) => loan.id}
      renderItem={({ item }) => (
        <LoanListItem
          loan={item}
          busy={busyLoanId === item.id}
          onMarkRepaid={markRepaid}
          onDelete={deleteLoan}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void load('refresh')}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerContainer}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.branding}>
              <View style={styles.brandIconBox}>
                <Text style={styles.brandIconText}>ML</Text>
              </View>
              <View>
                <Text style={styles.heading}>MiniLedger</Text>
                <Text style={styles.subheading}>{user?.phone}</Text>
              </View>
            </View>

            <Pressable
              onPress={() => void signOut()}
              hitSlop={8}
              style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>

          {/* Portfolio Summary Card */}
          <SummaryCard summary={summary} loading={isLoading} />

          {/* New Loan Entry Action Button */}
          <PrimaryButton
            label="Create new loan entry"
            icon={<Text style={styles.btnPlus}>+</Text>}
            onPress={() => navigation.navigate('AddLoan')}
            style={styles.addButton}
          />

          {/* Activity Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activity</Text>
            <Text style={styles.entryCount}>
              {loans.length} {loans.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>

          {/* Filter Pills */}
          <View style={styles.filters}>
            {FILTERS.map((filter) => {
              const isActive = filter.value === status;
              return (
                <Pressable
                  key={filter.value}
                  onPress={() => setStatus(filter.value)}
                  style={[styles.filter, isActive && styles.filterActive]}
                >
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => void load('initial')} hitSlop={8} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        isLoading ? undefined : (
          <EmptyState
            title={EMPTY_COPY[status].title}
            description={EMPTY_COPY[status].description}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  headerContainer: {
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandIconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: fontSize.sm,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 1,
    letterSpacing: 0.2,
  },
  signOutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutBtnPressed: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderHighlight,
  },
  signOutText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
  },
  addButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  btnPlus: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.primaryText,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  entryCount: {
    fontSize: fontSize.xs,
    color: colors.textDim,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    marginBottom: spacing.lg,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterLabelActive: {
    color: colors.primaryText,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: '500',
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: colors.danger,
    marginLeft: spacing.sm,
  },
  retryText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
