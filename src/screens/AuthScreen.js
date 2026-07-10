import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
  const authBgPlayer = useVideoPlayer(require('../../assets/videos/login-bg.mp4'), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const { login, apiRequest } = useAuth();
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [signupUser, setSignupUser] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupError, setSignupError] = useState('');

  const switchTab = (t) => {
    setTab(t);
    setLoginError('');
    setSignupError('');
  };

  async function handleLogin() {
    if (!loginUser.trim() || !loginPass) {
      setLoginError('Enter your username and password.');
      return;
    }
    setLoginError('');
    setLoading(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginUser.trim(), password: loginPass }),
      });
      await login(data.token, data.user);
    } catch (e) {
      setLoginError(e.message || 'Login failed. Check your username and password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!signupUser.trim() || !signupPass || !signupConfirm) {
      setSignupError('Fill in all fields.');
      return;
    }
    if (signupPass.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }
    if (signupPass !== signupConfirm) {
      setSignupError('Passwords do not match.');
      return;
    }
    setSignupError('');
    setLoading(true);
    try {
      const data = await apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username: signupUser.trim(), password: signupPass }),
      });
      await login(data.token, data.user);
    } catch (e) {
      setSignupError(e.message || 'Signup failed. Try a different username.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.authScreenWrap}>
      <VideoView player={authBgPlayer} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <View style={styles.videoOverlay} />
    <KeyboardAvoidingView
      style={styles.contentWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brandRow}>
        <View style={styles.brandIcon}>
          <Text style={styles.brandIconText}>B</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>B24</Text>
          <Text style={styles.brandSub}>MESSENGER</Text>
        </View>
      </View>

      <View style={styles.cardWrap}>
        <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={18} />
        <View style={styles.cardInner}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
              onPress={() => switchTab('login')}
            >
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'signup' && styles.tabBtnActive]}
              onPress={() => switchTab('signup')}
            >
              <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {tab === 'login' ? (
            <>
              <Text style={styles.heading}>Welcome back</Text>
              <Text style={styles.subheading}>Sign in to continue</Text>

              <View style={styles.field}>
                <TextInput
                  value={loginUser}
                  onChangeText={setLoginUser}
                  placeholder="username"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Text style={styles.domainSuffix}>@b24.me</Text>
              </View>

              <View style={styles.field}>
                <TextInput
                  value={loginPass}
                  onChangeText={setLoginPass}
                  placeholder="password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

              <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitText}>Sign In</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.heading}>Create your account</Text>
              <Text style={styles.subheading}>One account for every B24 app</Text>

              <View style={styles.field}>
                <TextInput
                  value={signupUser}
                  onChangeText={setSignupUser}
                  placeholder="choose a username"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Text style={styles.domainSuffix}>@b24.me</Text>
              </View>

              <View style={styles.field}>
                <TextInput
                  value={signupPass}
                  onChangeText={setSignupPass}
                  placeholder="at least 8 characters"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <TextInput
                  value={signupConfirm}
                  onChangeText={setSignupConfirm}
                  placeholder="repeat password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              {signupError ? <Text style={styles.errorText}>{signupError}</Text> : null}

              <TouchableOpacity style={styles.submitBtn} onPress={handleSignup} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitText}>Create Account</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <Text style={styles.terms}>
        By continuing you agree to B24's Terms & Privacy Policy
      </Text>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff', justifyContent: 'center', padding: 24 },
  authScreenWrap: { flex: 1 },  videoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,15,26,0.55)' },  contentWrap: { flex: 1, justifyContent: 'center', padding: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 },
  brandIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: '#6d28d9',
    alignItems: 'center', justifyContent: 'center',
  },
  brandIconText: { color: 'white', fontWeight: '800', fontSize: 20 },
  brandTitle: { fontSize: 19, fontWeight: '800', color: '#0f0f1a' },
  brandSub: { fontSize: 11, color: '#9ca3af', fontWeight: '600', letterSpacing: 0.4 },
  cardWrap: { borderRadius: 24, overflow: 'hidden' },
  cardInner: { padding: 20, backgroundColor: 'rgba(255,255,255,0.35)' },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(15,15,26,0.05)', borderRadius: 14, padding: 4, marginBottom: 22 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  tabBtnActive: { backgroundColor: '#0f0f1a' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#6b6b7a' },
  tabTextActive: { color: 'white' },
  heading: { fontSize: 18, fontWeight: '800', color: '#0f0f1a', marginBottom: 4 },
  subheading: { fontSize: 12.5, color: '#9ca3af', marginBottom: 20 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    paddingHorizontal: 14, marginBottom: 12,
  },
  input: { flex: 1, fontSize: 14, color: '#0f0f1a', paddingVertical: 13 },
  domainSuffix: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  errorText: { fontSize: 12, color: '#ef4444', marginTop: 4, marginBottom: 4 },
  submitBtn: {
    marginTop: 8, backgroundColor: '#6d28d9', borderRadius: 15,
    paddingVertical: 14, alignItems: 'center',
  },
  submitText: { color: 'white', fontSize: 14, fontWeight: '700' },
  terms: { textAlign: 'center', marginTop: 24, fontSize: 11.5, color: '#9ca3af', paddingHorizontal: 10 },
});
