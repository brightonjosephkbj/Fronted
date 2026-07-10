import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Image, Modal, Alert, Pressable, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { BlurView } from 'expo-blur';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useFontPrefs } from '../context/FontPrefsContext';
import { ChevronLeft, ChevronRight, X, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Avatar from '../components/Avatar';

function GlassCard({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

function resolveBackground(banner) {
  if (banner?.type === 'photo' && banner.value) return { type: 'photo', value: banner.value };
  return { type: 'color', value: banner?.value || '#ffffff' };
}

const BANNER_CACHE_KEY = 'b24_profile_banner';
const WALLPAPER_CACHE_KEY = 'b24_default_wallpaper';
const BANNER_COLORS = ['#4f46e5', '#9333ea', '#f97316', '#0ea5a4', '#db2777', '#16a34a', '#0f172a', '#eab308'];
const CURRENT_APP_VERSION = '1.0.0';

function verifiedColor(tick) {
  if (tick === 'cyan') return '#06b6d4';
  if (tick === 'blue') return '#3b82f6';
  return '#a855f7'; // purple default
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { user, logout, apiRequest, apiUpload, apiUploadFile, updateUserAvatar } = useAuth();
  const { fontSize, setFontSize, fontFamily, setFontFamily, sizeOptions, familyOptions } = useFontPrefs();

  const [lastSeen, setLastSeen] = useState(true);
  const [freezeLastSeen, setFreezeLastSeen] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [profilePhotoVisible, setProfilePhotoVisible] = useState(true);
  const [antiDelete, setAntiDelete] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [bannerPreviewOpen, setBannerPreviewOpen] = useState(false);
  const [bannerPickerOpen, setBannerPickerOpen] = useState(false);
  const [localBanner, setLocalBanner] = useState(null);
  const [wallpaper, setWallpaper] = useState(null); // null = default Papercut
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontFamilyPickerOpen, setFontFamilyPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [appLockEnabled, setAppLockEnabledState] = useState(false);
  const [updateSheetOpen, setUpdateSheetOpen] = useState(false);
  const [updateStage, setUpdateStage] = useState('idle'); // idle | checking | uptodate | available | downloading | error
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const banner = resolveBackground(localBanner || user?.banner);

  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(BANNER_CACHE_KEY);
        if (cached) setLocalBanner(JSON.parse(cached));
      } catch (e) {
        // no cached banner yet, keep using the account default
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const wp = await AsyncStorage.getItem(WALLPAPER_CACHE_KEY);
        if (wp) setWallpaper(wp);
      } catch (e) {}
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const pin = await AsyncStorage.getItem('appLockPin');
          setPinSet(!!pin);
        } catch (e) {
          // ignore - defaults to Off
        }
        try {
          const enabled = await AsyncStorage.getItem('appLockEnabled');
          setAppLockEnabledState(enabled === 'true');
        } catch (e) {
          // ignore - defaults to Off
        }
      })();
    }, [])
  );

  async function loadBlockedUsers() {
    setBlockedLoading(true);
    try {
      const data = await apiRequest('/friends/blocked');
      setBlockedUsers(data?.blocked || []);
    } catch (e) {
      // offline or backend unreachable - keep whatever we had
    } finally {
      setBlockedLoading(false);
    }
  }

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  function openBlockedList() {
    setBlockedOpen(true);
    loadBlockedUsers();
  }

  async function unblockUser(target) {
    try {
      await apiRequest('/friends/remove', {
        method: 'POST',
        body: JSON.stringify({ user_id: target.id }),
      });
      setBlockedUsers(prev => prev.filter(u => u.id !== target.id));
    } catch (e) {
      Alert.alert('Error', "Couldn't unblock this contact. Try again.");
    }
  }

  async function handleToggleAppLock(value) {
    if (value && !pinSet) {
      // Can't turn on a lock with no PIN to check against — send them to
      // set one first, then they can flip this switch once it's set.
      Alert.alert('Set a PIN first', 'Choose a PIN before turning App Lock on.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set PIN', onPress: () => navigation.navigate('SetPin') },
      ]);
      return;
    }
    setAppLockEnabledState(value);
    try {
      await AsyncStorage.setItem('appLockEnabled', value ? 'true' : 'false');
    } catch (e) {
      Alert.alert('Error', "Couldn't save App Lock setting. Try again.");
      setAppLockEnabledState(!value);
    }
  }

  async function handleSelectBannerColor(color) {
    const newBanner = { type: 'color', value: color };
    setLocalBanner(newBanner);
    setBannerPickerOpen(false);
    try {
      await AsyncStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(newBanner));
    } catch (e) {}
    try {
      await apiRequest('/profile/banner', { method: 'POST', body: JSON.stringify(newBanner) });
    } catch (e) {
      // backend doesn't have a banner endpoint yet - it still applies locally
    }
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Enable photo library permission to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    try {
      const res = await apiUploadFile('/media/upload', uri, {
        filename: 'avatar.jpg',
        mimeType: 'image/jpeg',
        fields: { type: 'avatar' },
      });
      await updateUserAvatar(res.url);
      try {
        await apiRequest('/profile/avatar', { method: 'POST', body: JSON.stringify({ avatar_url: res.url }) });
      } catch (e) {
        // backend doesn't have a dedicated avatar endpoint yet - it still applies locally
      }
    } catch (e) {
      Alert.alert('Error', "Couldn't update your profile picture.");
    }
  }

  async function handleLogout() {
    try { await apiRequest('/auth/logout', { method: 'POST' }); } catch (e) {}
    logout();
  }

  async function handleSelectWallpaper(color) {
    setWallpaper(color);
    setWallpaperPickerOpen(false);
    try {
      if (color) await AsyncStorage.setItem(WALLPAPER_CACHE_KEY, color);
      else await AsyncStorage.removeItem(WALLPAPER_CACHE_KEY);
    } catch (e) {}
  }

  function handleSelectFont(size) {
    setFontSize(size);
    setFontPickerOpen(false);
  }

  function handleSelectFontFamily(family) {
    setFontFamily(family);
    setFontFamilyPickerOpen(false);
  }

  async function handleManageStorage() {
    let totalBytes = 0;
    const keys = [BANNER_CACHE_KEY, WALLPAPER_CACHE_KEY, 'b24_font_size', 'b24_font_family', 'b24_chats_cache', 'b24_chat_meta'];
    for (const key of keys) {
      try {
        const val = await AsyncStorage.getItem(key);
        if (val) totalBytes += val.length;
      } catch (e) {}
    }
    const kb = (totalBytes / 1024).toFixed(1);
    Alert.alert(
      'Local storage',
      `Cached chats, settings, and preferences on this device: ~${kb} KB.`,
      [
        { text: 'OK', style: 'cancel' },
        {
          text: 'Clear cache', style: 'destructive', onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['b24_chats_cache', 'b24_chat_meta']);
              Alert.alert('Cleared', 'Cached chat data removed. It will reload from the server next time you open a chat list.');
            } catch (e) {
              Alert.alert('Error', "Couldn't clear cache. Try again.");
            }
          },
        },
      ]
    );
  }

  function handleNetworkUsage() {
    Alert.alert(
      'Network usage',
      "This app doesn't track data usage per-feature yet — that needs work we haven't done. Nothing to show here for now."
    );
  }

  function openUpdateSheet() {
    setUpdateStage('idle');
    setUpdateInfo(null);
    setDownloadProgress(0);
    setUpdateSheetOpen(true);
  }

  async function handleCheckForUpdates() {
    setUpdateStage('checking');
    try {
      const data = await apiRequest(`/app/version?current_version=${CURRENT_APP_VERSION}`);
      if (data?.update_available && data?.apk_url) {
        setUpdateInfo(data);
        setUpdateStage('available');
      } else {
        setUpdateStage('uptodate');
      }
    } catch (e) {
      setUpdateStage('error');
    }
  }

  async function handleDownloadAndInstall() {
    if (!updateInfo?.apk_url) return;
    setUpdateStage('downloading');
    setDownloadProgress(0);
    try {
      const fileUri = FileSystem.cacheDirectory + 'b24-update.apk';
      const downloadResumable = FileSystem.createDownloadResumable(
        updateInfo.apk_url,
        fileUri,
        {},
        (progress) => {
          const pct = progress.totalBytesExpectedToWrite
            ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
            : 0;
          setDownloadProgress(pct);
        }
      );
      const result = await downloadResumable.downloadAsync();
      if (!result?.uri) throw new Error('Download failed');

      // Installing an update over the same package keeps AsyncStorage and
      // the backend DB exactly as they are — nothing local gets wiped.
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });
      // Android's own installer takes over from here. Once the user
      // confirms, the updated app reopens fresh with all local data intact.
      setUpdateSheetOpen(false);
    } catch (e) {
      Alert.alert('Update failed', "Couldn't download or open the update. Try again.");
      setUpdateStage('available');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 14 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={14} />
          <ChevronLeft size={22} color="#0f0f1a" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setBannerPreviewOpen(true)}
        style={[styles.profileCard, { backgroundColor: banner.type === 'color' ? banner.value : '#ffffff' }]}
      >
        {banner.type === 'photo' && (
          <Image source={{ uri: banner.value }} style={StyleSheet.absoluteFillObject} />
        )}
        <GlassCard style={styles.profileInner} tint={0.4}>
          <TouchableOpacity activeOpacity={0.85} onPress={pickAvatar} style={{ position: 'relative' }}>
            <Avatar
              uri={user?.avatar_url}
              letter={user?.username?.[0]}
              size={76}
            />
            <View style={styles.avatarCameraBadge}>
              <Camera size={14} color="white" />
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{user?.username || 'you'}</Text>
          <Text style={styles.username}>{user?.username}@b24.me</Text>
          <Text style={styles.bio}>{user?.bio || "Hey there, I'm using B24"}</Text>
        </GlassCard>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Account & Identity</Text>
      <GlassCard style={{ padding: 0 }}>
        <Row label="Username" sub={user?.username} />
        <Row label="Phone number" sub={user?.phone || 'Not set'} />
        <Row label="Two-step verification" sub="Off" last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Profile Banner</Text>
      <GlassCard style={{ padding: 0 }}>
        <NavRow label="Change banner" sub={banner.type === 'photo' ? 'Photo' : 'Color'} onPress={() => setBannerPickerOpen(true)} last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Privacy</Text>
      <GlassCard style={{ padding: 0 }}>
        <ToggleRow label="Last seen & online" value={lastSeen} onChange={setLastSeen} />
        <ToggleRow label="Freeze last seen" value={freezeLastSeen} onChange={setFreezeLastSeen} />
        <ToggleRow label="Ghost mode" value={ghostMode} onChange={setGhostMode} />
        <ToggleRow label="Profile photo visibility" value={profilePhotoVisible} onChange={setProfilePhotoVisible} />
        <NavRow label="Blocked contacts" sub={String(blockedUsers.length)} onPress={openBlockedList} />
        <ToggleRow label="Read receipts" value={readReceipts} onChange={setReadReceipts} />
        <ToggleRow label="Anti-delete messages" value={antiDelete} onChange={setAntiDelete} last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Security</Text>
      <GlassCard style={{ padding: 0 }}>
        <NavRow
          label="App Lock PIN"
          sub={pinSet ? 'Set' : 'Not set'}
          onPress={() => navigation.navigate('SetPin')}
        />
        <ToggleRow
          label="Require PIN on launch"
          value={appLockEnabled}
          onChange={handleToggleAppLock}
          last
        />
      </GlassCard>

      <Text style={styles.sectionTitle}>Notifications</Text>
      <GlassCard style={{ padding: 0 }}>
        <ToggleRow label="Message notifications" value={notifications} onChange={setNotifications} last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Chats</Text>
      <GlassCard style={{ padding: 0 }}>
        <NavRow label="Default wallpaper" sub={wallpaper ? 'Custom color' : 'Papercut (default)'} onPress={() => setWallpaperPickerOpen(true)} />
        <NavRow label="Font size" sub={fontSize} onPress={() => setFontPickerOpen(true)} />
        <NavRow label="Font family" sub={fontFamily} onPress={() => setFontFamilyPickerOpen(true)} />
        <NavRow label="Chat backup" sub="Never" onPress={() => Alert.alert('Coming soon', "Chat backup isn't built yet — on the list next.")} last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Storage & Data</Text>
      <GlassCard style={{ padding: 0 }}>
        <NavRow label="Manage storage" onPress={handleManageStorage} />
        <NavRow label="Network usage" onPress={handleNetworkUsage} last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Help & About</Text>
      <GlassCard style={{ padding: 0 }}>
        <NavRow label="Help center" onPress={() => setHelpOpen(true)} />
        <NavRow label="Terms & Privacy Policy" onPress={() => setTermsOpen(true)} />
        <NavRow label="Check for updates" sub={CURRENT_APP_VERSION} onPress={openUpdateSheet} last />
      </GlassCard>

      <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Danger Zone</Text>
      <GlassCard style={{ padding: 0 }}>
        <TouchableOpacity style={styles.row} onPress={handleLogout}>
          <Text style={styles.dangerText}>Log out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, styles.rowLast]}>
          <Text style={styles.dangerText}>Delete account</Text>
        </TouchableOpacity>
      </GlassCard>

      <View style={{ height: 30 }} />

      <Modal visible={bannerPreviewOpen} transparent animationType="fade" onRequestClose={() => setBannerPreviewOpen(false)}>
        <View style={[styles.bannerModal, { backgroundColor: banner.type === 'color' ? banner.value : '#000' }]}>
          {banner.type === 'photo' && (
            <Image source={{ uri: banner.value }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          )}
          <TouchableOpacity style={styles.bannerCloseBtn} onPress={() => setBannerPreviewOpen(false)}>
            <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={20} />
            <X size={20} color="#0f0f1a" />
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={bannerPickerOpen} transparent animationType="fade" onRequestClose={() => setBannerPickerOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <GlassCard style={styles.pickerCard} tint={0.85}>
            <Text style={styles.pickerTitle}>Choose a banner color</Text>
            <View style={styles.pickerGrid}>
              {BANNER_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => handleSelectBannerColor(color)}
                  style={[styles.pickerSwatch, { backgroundColor: color }, banner.value === color && styles.pickerSwatchActive]}
                />
              ))}
            </View>
            <TouchableOpacity onPress={() => setBannerPickerOpen(false)} style={styles.pickerCancel}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={wallpaperPickerOpen} transparent animationType="fade" onRequestClose={() => setWallpaperPickerOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <GlassCard style={styles.pickerCard} tint={0.85}>
            <Text style={styles.pickerTitle}>Default wallpaper</Text>
            <View style={styles.pickerGrid}>
              <TouchableOpacity
                onPress={() => handleSelectWallpaper(null)}
                style={[styles.pickerSwatch, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }, !wallpaper && styles.pickerSwatchActive]}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#6b6b7a' }}>Default</Text>
              </TouchableOpacity>
              {BANNER_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => handleSelectWallpaper(color)}
                  style={[styles.pickerSwatch, { backgroundColor: color }, wallpaper === color && styles.pickerSwatchActive]}
                />
              ))}
            </View>
            <TouchableOpacity onPress={() => setWallpaperPickerOpen(false)} style={styles.pickerCancel}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={fontPickerOpen} transparent animationType="fade" onRequestClose={() => setFontPickerOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <GlassCard style={styles.pickerCard} tint={0.85}>
            <Text style={styles.pickerTitle}>Font size</Text>
            {sizeOptions.map((size, i) => (
              <TouchableOpacity
                key={size}
                style={[styles.row, i < sizeOptions.length - 1 && styles.rowBorder, { width: '100%' }]}
                onPress={() => handleSelectFont(size)}
              >
                <Text style={[styles.rowLabel, { flex: 1, fontSize: size === 'Small' ? 12 : size === 'Large' ? 17 : 14 }]}>{size}</Text>
                {fontSize === size && <Text style={{ color: '#4f46e5', fontWeight: '800' }}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setFontPickerOpen(false)} style={styles.pickerCancel}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={fontFamilyPickerOpen} transparent animationType="fade" onRequestClose={() => setFontFamilyPickerOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <GlassCard style={styles.pickerCard} tint={0.85}>
            <Text style={styles.pickerTitle}>Font family</Text>
            {familyOptions.map((family, i) => (
              <TouchableOpacity
                key={family}
                style={[styles.row, i < familyOptions.length - 1 && styles.rowBorder, { width: '100%' }]}
                onPress={() => handleSelectFontFamily(family)}
              >
                <Text style={[styles.rowLabel, { flex: 1 }]}>{family}</Text>
                {fontFamily === family && <Text style={{ color: '#4f46e5', fontWeight: '800' }}>✓</Text>}
              </TouchableOpacity>
            ))}
            <Text style={styles.helpA}>Custom fonts only render on Android for now — iOS shows the system font.</Text>
            <TouchableOpacity onPress={() => setFontFamilyPickerOpen(false)} style={styles.pickerCancel}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <GlassCard style={[styles.pickerCard, { alignItems: 'stretch', maxHeight: '75%' }]} tint={0.9}>
            <Text style={styles.pickerTitle}>Help center</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <Text style={styles.helpQ}>How do I add a friend?</Text>
              <Text style={styles.helpA}>Tap the + button on the main screen, then "Add Friend", and search by username.</Text>
              <Text style={styles.helpQ}>How do I start a group?</Text>
              <Text style={styles.helpA}>Tap the + button and choose "Create Group", then pick members.</Text>
              <Text style={styles.helpQ}>Something's not working — what do I do?</Text>
              <Text style={styles.helpA}>Reach out to us directly for now — in-app support requests are coming soon.</Text>
            </ScrollView>
            <TouchableOpacity onPress={() => setHelpOpen(false)} style={styles.pickerCancel}>
              <Text style={styles.pickerCancelText}>Close</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={termsOpen} transparent animationType="fade" onRequestClose={() => setTermsOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <GlassCard style={[styles.pickerCard, { alignItems: 'stretch', maxHeight: '75%' }]} tint={0.9}>
            <Text style={styles.pickerTitle}>Terms & Privacy Policy</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <Text style={styles.helpA}>
                Placeholder text — replace this with your actual Terms of Service and Privacy Policy before shipping to real users.
                {'\n\n'}B24 stores your messages, profile info, and status updates to provide the service. We don't sell your data to third parties.
              </Text>
            </ScrollView>
            <TouchableOpacity onPress={() => setTermsOpen(false)} style={styles.pickerCancel}>
              <Text style={styles.pickerCancelText}>Close</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={blockedOpen} transparent animationType="slide" onRequestClose={() => setBlockedOpen(false)}>
        <Pressable style={styles.blockedBackdrop} onPress={() => setBlockedOpen(false)}>
          <GlassCard style={styles.blockedSheet} tint={0.55} blurAmount={24}>
            <View style={styles.blockedHeader}>
              <Text style={styles.pickerTitle}>Blocked contacts</Text>
              <TouchableOpacity onPress={() => setBlockedOpen(false)}>
                <X size={20} color="#6b6b7a" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {blockedLoading ? (
                <Text style={styles.helpA}>Loading...</Text>
              ) : blockedUsers.length === 0 ? (
                <Text style={styles.helpA}>You haven't blocked anyone.</Text>
              ) : (
                blockedUsers.map((u, i) => (
                  <View key={u.id} style={[styles.row, i < blockedUsers.length - 1 && styles.rowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{u.username}</Text>
                      <Text style={styles.rowSub}>{u.handle}</Text>
                    </View>
                    <TouchableOpacity onPress={() => unblockUser(u)} style={styles.unblockBtn}>
                      <Text style={styles.unblockBtnText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </GlassCard>
        </Pressable>
      </Modal>

      <Modal visible={updateSheetOpen} transparent animationType="slide" onRequestClose={() => setUpdateSheetOpen(false)}>
        <Pressable style={styles.blockedBackdrop} onPress={() => setUpdateSheetOpen(false)}>
          <GlassCard style={styles.blockedSheet} tint={0.55} blurAmount={24}>
            <View style={styles.blockedHeader}>
              <Text style={styles.pickerTitle}>App Updates</Text>
              <TouchableOpacity onPress={() => setUpdateSheetOpen(false)}>
                <X size={20} color="#6b6b7a" />
              </TouchableOpacity>
            </View>

            <Text style={styles.rowSub}>Current version: {CURRENT_APP_VERSION}</Text>

            {updateStage === 'idle' && (
              <TouchableOpacity style={styles.updateBtn} onPress={handleCheckForUpdates}>
                <Text style={styles.updateBtnText}>Check for updates</Text>
              </TouchableOpacity>
            )}

            {updateStage === 'checking' && (
              <View style={styles.updateStatusRow}>
                <ActivityIndicator size="small" color="#4f46e5" />
                <Text style={styles.helpA}>Checking for updates...</Text>
              </View>
            )}

            {updateStage === 'uptodate' && (
              <Text style={[styles.helpA, { marginTop: 12 }]}>You're on the latest version.</Text>
            )}

            {updateStage === 'available' && (
              <>
                <Text style={[styles.helpA, { marginTop: 12 }]}>
                  Version {updateInfo?.version} is available{updateInfo?.notes ? `: ${updateInfo.notes}` : '.'}
                </Text>
                <TouchableOpacity style={styles.updateBtn} onPress={handleDownloadAndInstall}>
                  <Text style={styles.updateBtnText}>Update</Text>
                </TouchableOpacity>
              </>
            )}

            {updateStage === 'downloading' && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.helpA}>Downloading update... {Math.round(downloadProgress * 100)}%</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
                </View>
              </View>
            )}

            {updateStage === 'error' && (
              <Text style={[styles.helpA, { marginTop: 12, color: '#ef4444' }]}>
                Couldn't check for updates. Check your connection and try again.
              </Text>
            )}
          </GlassCard>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Row({ label, sub, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {sub && <Text style={styles.rowSub}>{sub}</Text>}
    </View>
  );
}

function NavRow({ label, sub, onPress, last }) {
  return (
    <TouchableOpacity style={[styles.row, last && styles.rowLast]} onPress={onPress}>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      {sub && <Text style={styles.rowSub}>{sub}</Text>}
      <ChevronRight size={16} color="#9ca3af" style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

function ToggleRow({ label, value, onChange, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassWrap: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtnWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  title: { fontSize: 16, fontWeight: '700' },
  profileCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  profileInner: { padding: 22, alignItems: 'center', gap: 6, borderRadius: 20, marginBottom: 0 },
  avatarCameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#4338ca', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 76, height: 76, borderRadius: 38 },
  verifiedBadge: {
    position: 'absolute', bottom: -1, right: -1, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff',
  },
  avatarFallback: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 28, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  name: { fontSize: 16.5, fontWeight: '800' },
  username: { fontSize: 12, color: '#6b6b7a' },
  bio: { fontSize: 12.5, color: '#6b6b7a', textAlign: 'center' },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a', textTransform: 'uppercase', marginBottom: 6, marginLeft: 4, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#0f0f1a' },
  rowSub: { fontSize: 12, color: '#9ca3af', marginLeft: 'auto' },
  dangerText: { color: '#ef4444', fontWeight: '600' },
  bannerModal: { flex: 1, alignItems: 'flex-end' },
  bannerCloseBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', margin: 16, marginTop: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pickerCard: { width: '100%', maxWidth: 320, padding: 20, borderRadius: 24, alignItems: 'center' },
  pickerTitle: { fontSize: 15, fontWeight: '800', color: '#0f0f1a', marginBottom: 16 },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  pickerSwatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'transparent' },
  pickerSwatchActive: { borderColor: '#0f0f1a' },
  pickerCancel: { marginTop: 18 },
  pickerCancelText: { color: '#6b6b7a', fontWeight: '700', fontSize: 13.5 },
  helpQ: { fontSize: 13.5, fontWeight: '700', color: '#0f0f1a', marginTop: 12 },
  helpA: { fontSize: 12.5, color: '#6b6b7a', marginTop: 4, lineHeight: 18 },
  blockedBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  blockedSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30 },
  blockedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  unblockBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(15,15,26,0.08)' },
  unblockBtnText: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },
  updateBtn: { marginTop: 16, backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  updateBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13.5 },
  updateStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(15,15,26,0.08)', overflow: 'hidden', marginTop: 8 },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: '#4f46e5' },
});
