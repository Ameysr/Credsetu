import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError, api } from '../api/client';
import { API_BASE_URL_HINT } from '../config';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { colors, fontSize, radius, spacing } from '../theme';

const RESEND_COOLDOWN_SECONDS = 30;

type Step = 'phone' | 'otp';

function normalisePhone(input: string): string {
  return input.replace(/[\s()-]/g, '');
}

function phoneProblem(phone: string): string | null {
  if (!phone) return 'Enter your phone number';
  if (!/^\+?[1-9]\d{9,14}$/.test(phone)) return 'Use 10-15 digits, optionally starting with +';
  return null;
}

export function LoginScreen(): React.JSX.Element {
  const { signIn } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+919876543210');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);

    cooldownTimer.current = setInterval(() => {
      setCooldown((seconds) => {
        if (seconds <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  }, []);

  const requestOtp = useCallback(async () => {
    const normalised = normalisePhone(phone);
    const problem = phoneProblem(normalised);

    if (problem) {
      setFieldError(problem);
      return;
    }

    setFieldError(null);
    setFormError(null);
    setIsSubmitting(true);

    try {
      const response = await api.requestOtp(normalised);
      setPhone(normalised);
      setDevCode(response.devCode ?? null);
      if (response.devCode) {
        setCode(response.devCode);
      } else {
        setCode('');
      }
      setStep('otp');
      startCooldown();
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Could not send the code. Try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, startCooldown]);

  const verifyOtp = useCallback(async () => {
    if (code.length !== 6) {
      setFieldError('Enter the 6-digit code');
      return;
    }

    setFieldError(null);
    setFormError(null);
    setIsSubmitting(true);

    try {
      const session = await api.verifyOtp(phone, code);
      await signIn(session);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not verify the code.');
    } finally {
      setIsSubmitting(false);
    }
  }, [code, phone, signIn]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.brand}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>ML</Text>
          </View>
          <Text style={styles.title}>MiniLedger</Text>
          <Text style={styles.subtitle}>Peer-to-peer personal loan tracker.</Text>
        </View>

        {/* Auth Card */}
        <View style={styles.card}>
          {step === 'phone' ? (
            <>
              <FormField
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
                autoFocus
                error={fieldError}
                hint="Default demo: +919876543210"
              />
              <PrimaryButton
                label="Send code"
                onPress={requestOtp}
                loading={isSubmitting}
                style={styles.mainBtn}
              />
            </>
          ) : (
            <>
              {devCode ? (
                <View style={styles.mockOtpBanner}>
                  <View style={styles.mockOtpTag}>
                    <View style={styles.mockOtpDot} />
                    <Text style={styles.mockOtpTitle}>DEVELOPER OTP</Text>
                  </View>
                  <Text style={styles.mockOtpCode}>{devCode}</Text>
                  <Text style={styles.mockOtpHint}>Auto-filled for quick testing</Text>
                </View>
              ) : null}

              <FormField
                label="6-digit verification code"
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                error={fieldError}
                inputStyle={styles.otpInput}
                accessory={
                  <Pressable
                    onPress={() => {
                      setStep('phone');
                      setCode('');
                      setFieldError(null);
                      setFormError(null);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.link}>Edit number</Text>
                  </Pressable>
                }
              />

              <PrimaryButton
                label="Verify & continue"
                onPress={verifyOtp}
                loading={isSubmitting}
                style={styles.mainBtn}
              />

              <View style={styles.resendRow}>
                <Pressable
                  onPress={cooldown > 0 || isSubmitting ? undefined : requestOtp}
                  disabled={cooldown > 0 || isSubmitting}
                  hitSlop={8}
                >
                  <Text style={[styles.link, cooldown > 0 && styles.linkDisabled]}>
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerTag}>CONNECTED API</Text>
          <Text style={styles.footer}>{API_BASE_URL_HINT}</Text>
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
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  logoText: {
    fontSize: fontSize.xxl,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textDim,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 6,
  },
  mockOtpBanner: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  mockOtpTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mockOtpDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  mockOtpTitle: {
    fontSize: fontSize.xxs,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  mockOtpCode: {
    fontSize: fontSize.xxl,
    fontWeight: '900',
    color: colors.success,
    letterSpacing: 6,
    marginVertical: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mockOtpHint: {
    fontSize: fontSize.xxs,
    color: colors.textMuted,
  },
  otpInput: {
    fontSize: fontSize.xl,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: colors.text,
  },
  mainBtn: {
    marginTop: spacing.xs,
  },
  link: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  linkDisabled: {
    color: colors.textDim,
    textDecorationLine: 'none',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  formError: {
    marginTop: spacing.lg,
    fontSize: fontSize.xs,
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '500',
  },
  footerContainer: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  footerTag: {
    fontSize: fontSize.xxs,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 1,
    marginBottom: 2,
  },
  footer: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
