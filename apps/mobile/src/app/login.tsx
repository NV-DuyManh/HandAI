import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { AppButton } from '../components/ui/AppButton';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAppBranding, isHandAIMode } from '../config/appMode';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const auth = useContext(AuthContext);
  const isHandAI = isHandAIMode();
  const branding = getAppBranding();

  React.useEffect(() => {
    if (isHandAI) {
      router.replace('/(tabs)' as any);
    }
  }, [isHandAI, router]);

  const handleLogin = async () => {
    if (!auth) return;
    if (!email.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      await auth.login({ email: email.trim(), password });
    } catch (e: any) {
      let message = 'Lỗi kết nối máy chủ. Vui lòng kiểm tra và thử lại.';
      if (e.response?.status === 401) {
        message = isHandAI
          ? 'Tài khoản hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.'
          : 'Tài khoản hoặc mật khẩu không đúng. Gợi ý: minh.student@mathvision.local / MathVision123!';
      } else if (e.response?.data?.error?.message) {
        message = e.response.data.error.message;
      } else if (e.response?.data?.message) {
        message = e.response.data.message;
      } else if (e.message && e.message !== 'Network Error') {
        message = e.message;
      }
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandSection}>
          <View style={[styles.logoBadge, SHADOWS.medium]}>
            <Ionicons
              name={isHandAI ? 'create-outline' : 'calculator'}
              size={40}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.appName}>{branding.name}</Text>
          <Text style={styles.appTagline}>{branding.detailedSubtitle}</Text>
        </View>

        <View style={[styles.card, SHADOWS.small]}>
          <Text style={styles.title}>Đăng nhập</Text>
          <Text style={styles.subtitle}>
            {isHandAI
              ? 'Nhận diện chữ viết tay học sinh tiểu học'
              : 'Cùng giải và kiểm tra bài toán hôm nay nhé!'}
          </Text>

          {errorMessage ? (
            <View
              style={styles.errorBanner}
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
            >
              <Ionicons name="alert-circle" size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email hoặc Mã học sinh</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={COLORS.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Ví dụ: student1@school.edu.vn"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="username"
                  textContentType="username"
                  accessibilityLabel="Tài khoản email hoặc mã học sinh"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={COLORS.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Nhập mật khẩu của em"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  accessibilityLabel="Mật khẩu"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.spacerSmall} />

            <AppButton
              title="Đăng nhập"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              variant="primary"
            />
          </View>
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Tài khoản được nhà trường hoặc phụ huynh cấp.
          </Text>
          {__DEV__ && (
            <TouchableOpacity
              style={{ marginTop: 14, padding: 8, alignItems: 'center' }}
              onPress={() => router.push('/dev-demo')}
              accessibilityRole="button"
              accessibilityLabel="Chẩn đoán kết nối thiết bị"
            >
              <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '700' }}>
                🛠️ Chẩn đoán kết nối API (Dev)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SIZES.large,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: SIZES.xlarge,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.medium,
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 0.2,
  },
  appTagline: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SIZES.xlarge,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SIZES.large,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: SIZES.inputRadius,
    padding: SIZES.medium,
    marginBottom: SIZES.large,
  },
  errorText: {
    marginLeft: SIZES.small,
    color: COLORS.errorText,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: SIZES.large,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: SIZES.inputRadius,
    paddingHorizontal: SIZES.medium,
    height: 52,
  },
  inputIcon: {
    marginRight: SIZES.small,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    height: '100%',
  },
  passwordInput: {
    paddingRight: SIZES.small,
  },
  eyeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacerSmall: {
    height: SIZES.medium,
  },
  footerNote: {
    marginTop: SIZES.xlarge,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
