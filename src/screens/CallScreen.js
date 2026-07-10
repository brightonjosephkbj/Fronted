import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, FlatList, Modal } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Mic, MicOff, Smile, Video, VideoOff, Pause, Play, Phone, PhoneOff, Plus, X, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react-native';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
} from 'react-native-webrtc';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

function statusText(state, seconds) {
  if (state === 'ringing') return 'Ringing...';
  if (state === 'unreachable') return 'Unreachable';
  if (state === 'offline') return 'Offline';
  if (state === 'connected') {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
  return '';
}

const REACTIONS = ['❤️', '😂', '👍', '😮', '👏', '🔥'];

export default function CallScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { socket } = useSocket();
  const { token, user, apiRequest } = useAuth();

  const contact = route.params?.contact || { name: 'Unknown', color: '#6366f1' };
  const isIncoming = !!route.params?.incoming;
  const callType = route.params?.call_type || 'voice';
  const incomingOffer = route.params?.offer || null;

  const [state, setState] = useState('ringing');
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // --- Call log / Add Call (used only when this screen is opened with no
  // contact — i.e. as a browsing screen rather than an active call) ---
  const isBrowsing = !route.params?.contact;
  const [callLog, setCallLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const friendNameById = friends.reduce((map, f) => { map[f.id] = f.username; return map; }, {});

  useEffect(() => {
    if (!isBrowsing) return;
    (async () => {
      setLogLoading(true);
      setFriendsLoading(true);
      try {
        const [historyData, friendsData] = await Promise.all([
          apiRequest('/calls/history'),
          apiRequest('/friends/list'),
        ]);
        setCallLog(Array.isArray(historyData?.calls) ? historyData.calls : []);
        setFriends(Array.isArray(friendsData?.friends) ? friendsData.friends : []);
      } catch (e) {
        setCallLog([]);
        setFriends([]);
      } finally {
        setLogLoading(false);
        setFriendsLoading(false);
      }
    })();
  }, [isBrowsing]);

  function openPicker() {
    setPickerOpen(true);
  }

  function startCall(friend, type) {
    setPickerOpen(false);
    const contact = { id: friend.id, name: friend.username, color: '#6366f1' };
    // push (not navigate) guarantees a fresh mount of this screen, which is
    // required — the outgoing-call effect below only reads route.params once,
    // at mount time.
    (navigation.push || navigation.navigate).call(navigation, 'Call', {
      contact,
      callee_id: friend.id,
      call_type: type,
    });
  }

  function redial(call) {
    const otherId = call.caller_id === user?.id ? call.callee_id : call.caller_id;
    const otherName = friendNameById[otherId] || 'Unknown';
    startCall({ id: otherId, username: otherName }, call.call_type || 'voice');
  }

  function formatDuration(totalSeconds) {
    if (!totalSeconds && totalSeconds !== 0) return '';
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(0.85)).current;
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const iceServersRef = useRef({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  const callIdRef = useRef(route.params?.call_id || null);
  const otherIdRef = useRef(isIncoming ? route.params?.caller_id : route.params?.callee_id);
  const endedRef = useRef(false);

  function createPeerConnection() {
    const pc = new RTCPeerConnection(iceServersRef.current);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice_candidate', {
          token,
          call_id: callIdRef.current,
          target_id: otherIdRef.current,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState) && !endedRef.current) {
        endedRef.current = true;
        setState('offline');
      }
    };

    return pc;
  }

  async function getLocalMedia() {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video' ? { facingMode: 'user' } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest('/webrtc/ice-servers');
        if (data?.iceServers?.length) {
          iceServersRef.current = { iceServers: data.iceServers };
        }
      } catch (err) {
        console.log('Failed to fetch ICE servers, falling back to STUN only:', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!socket || isIncoming || isBrowsing) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await getLocalMedia();
        const pc = createPeerConnection();
        pcRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (cancelled) return;

        socket.emit('call_offer', {
          token,
          callee_id: route.params?.callee_id,
          call_type: callType,
          offer: pc.localDescription,
        });
      } catch (err) {
        console.log('Failed to start call:', err);
        setState('unreachable');
      }
    })();

    return () => { cancelled = true; };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const onCallAnswered = async (data) => {
      callIdRef.current = data.call_id;
      try {
        if (pcRef.current && data.answer) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          for (const c of pendingCandidatesRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidatesRef.current = [];
        }
        setState('connected');
      } catch (err) {
        console.log('Failed to apply answer:', err);
      }
    };

    const onCallRejected = (data) => {
      endedRef.current = true;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      setState(data.status === 'missed' ? 'unreachable' : 'offline');
    };

    const onCallEnded = () => {
      endedRef.current = true;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      setState('offline');
    };

    const onIceCandidate = async (data) => {
      try {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          pendingCandidatesRef.current.push(data.candidate);
        }
      } catch (err) {
        console.log('Failed to add ICE candidate:', err);
      }
    };

    socket.on('call_answered', onCallAnswered);
    socket.on('call_rejected', onCallRejected);
    socket.on('call_ended', onCallEnded);
    socket.on('ice_candidate', onIceCandidate);

    return () => {
      socket.off('call_answered', onCallAnswered);
      socket.off('call_rejected', onCallRejected);
      socket.off('call_ended', onCallEnded);
      socket.off('ice_candidate', onIceCandidate);
    };
  }, [socket]);

  useEffect(() => {
    return () => {
      if (!endedRef.current && socket && callIdRef.current) {
        socket.emit('call_end', {
          token,
          call_id: callIdRef.current,
          other_id: otherIdRef.current,
        });
      }
    };
  }, [socket]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (state === 'connected') {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [state]);

  useEffect(() => {
    if (state !== 'ringing') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  const isDown = state === 'unreachable' || state === 'offline';

  async function handleAccept() {
    try {
      const stream = await getLocalMedia();
      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      if (incomingOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidatesRef.current = [];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call_answer', {
        token,
        call_id: callIdRef.current,
        caller_id: otherIdRef.current,
        answer: pc.localDescription,
      });
      setState('connected');
    } catch (err) {
      console.log('Failed to accept call:', err);
      setState('unreachable');
    }
  }

  function handleDecline() {
    endedRef.current = true;
    socket.emit('call_reject', {
      token,
      call_id: callIdRef.current,
      caller_id: otherIdRef.current,
      reason: 'declined',
    });
    navigation.goBack();
  }

  function handleEnd() {
    endedRef.current = true;
    socket.emit('call_end', {
      token,
      call_id: callIdRef.current,
      other_id: otherIdRef.current,
    });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    setState('offline');
  }

  function toggleMute() {
    setMuted(m => {
      const next = !m;
      localStream?.getAudioTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }

  function toggleVideo() {
    setVideoOff(v => {
      const next = !v;
      localStream?.getVideoTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }

  function toggleHold() {
    setOnHold(h => {
      const next = !h;
      localStream?.getTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }

  if (isBrowsing) {
    return (
      <View style={styles.screen}>
        <View style={styles.logHeaderRow}>
          <Text style={styles.logTitle}>Calls</Text>
          <TouchableOpacity style={styles.addCallBtn} onPress={openPicker}>
            <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={20} />
            <Plus size={20} color="#4338ca" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={callLog}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 14, paddingTop: 4 }}
          ListEmptyComponent={!logLoading && (
            <Text style={styles.logEmptyText}>No calls yet. Tap + to call a friend.</Text>
          )}
          renderItem={({ item }) => {
            const outgoing = item.caller_id === user?.id;
            const otherId = outgoing ? item.callee_id : item.caller_id;
            const otherName = friendNameById[otherId] || 'Unknown';
            const missed = item.status === 'missed' || item.status === 'declined';
            const DirIcon = missed ? PhoneMissed : (outgoing ? PhoneOutgoing : PhoneIncoming);
            return (
              <TouchableOpacity style={styles.logRow} onPress={() => redial(item)}>
                <View style={[styles.logAvatar, { backgroundColor: '#6366f1' }]}>
                  <Text style={styles.logAvatarText}>{otherName[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.logName}>{otherName}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <DirIcon size={12} color={missed ? '#ef4444' : '#9ca3af'} />
                    <Text style={[styles.logSubtext, missed && { color: '#ef4444' }]}>
                      {item.call_type === 'video' ? 'Video' : 'Voice'}
                      {item.duration ? ` · ${formatDuration(item.duration)}` : missed ? ' · Missed' : ''}
                    </Text>
                  </View>
                </View>
                {item.call_type === 'video' ? <Video size={18} color="#9ca3af" /> : <Phone size={18} color="#9ca3af" />}
              </TouchableOpacity>
            );
          }}
        />

        <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
          <View style={styles.pickerBackdrop}>
            <View style={styles.pickerCard}>
              <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={25} />
              <View style={styles.pickerHeaderRow}>
                <Text style={styles.pickerTitle}>Call a friend</Text>
                <TouchableOpacity onPress={() => setPickerOpen(false)}>
                  <X size={20} color="#4b5563" />
                </TouchableOpacity>
              </View>
              {friendsLoading ? (
                <Text style={styles.logEmptyText}>Loading...</Text>
              ) : friends.length === 0 ? (
                <Text style={styles.logEmptyText}>Add some friends first.</Text>
              ) : (
                <FlatList
                  data={friends}
                  keyExtractor={(item) => String(item.id)}
                  style={{ maxHeight: 340 }}
                  renderItem={({ item }) => (
                    <View style={styles.pickerRow}>
                      <View style={[styles.logAvatar, { backgroundColor: '#6366f1' }]}>
                        <Text style={styles.logAvatarText}>{item.username?.[0]?.toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.logName, { flex: 1, marginLeft: 12 }]}>{item.username}</Text>
                      <TouchableOpacity style={styles.pickerCallBtn} onPress={() => startCall(item, 'voice')}>
                        <Phone size={16} color="#4338ca" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.pickerCallBtn} onPress={() => startCall(item, 'video')}>
                        <Video size={16} color="#4338ca" />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={{ alignItems: 'center', paddingTop: 40 }}>
        <View style={styles.glassPill}>
          <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={20} />
          <Text style={styles.statusLabel}>
            {isDown ? 'CALL FAILED' : (callType === 'video' ? 'VIDEO CALL' : 'VOICE CALL')}
          </Text>
        </View>
        <Text style={styles.statusTime}>{statusText(state, seconds)}</Text>
      </View>

      <View style={styles.centerArea}>
        {callType === 'video' && remoteStream ? (
          <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
        ) : (
          <>
            {state === 'ringing' && (
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            )}
            <View style={styles.avatarGlassWrap}>
              <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={25} />
              <View style={[styles.avatar, { backgroundColor: isDown ? '#9ca3af' : contact.color }]}>
                <Text style={styles.avatarText}>{contact.name?.[0]}</Text>
              </View>
            </View>
          </>
        )}
        <Text style={styles.contactName}>{contact.name}</Text>
        {isDown && (
          <Text style={styles.downText}>
            {state === 'offline' ? "They're not online right now." : "Couldn't reach them."}
          </Text>
        )}
      </View>

      {callType === 'video' && localStream && !videoOff && (
        <View style={styles.localVideoWrap}>
          <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" mirror />
        </View>
      )}

      {reactionOpen && (
        <View style={styles.reactionCard}>
          <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={20} />
          {REACTIONS.map(e => (
            <TouchableOpacity key={e} onPress={() => setReactionOpen(false)}>
              <Text style={styles.reactionEmoji}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.controlsWrap}>
        <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={25} />
        {isDown ? (
          <View style={styles.controlsRow}>
            <ControlBtn label="Close" danger onPress={() => navigation.goBack()} icon={<PhoneOff size={18} color="white" />} />
          </View>
        ) : isIncoming && state === 'ringing' ? (
          <View style={styles.controlsRow}>
            <ControlBtn label="Decline" danger onPress={handleDecline} icon={<PhoneOff size={18} color="white" />} />
            <ControlBtn label="Accept" onPress={handleAccept} icon={<Phone size={18} color="#4338ca" />} />
          </View>
        ) : !isIncoming && state === 'ringing' ? (
          <View style={styles.controlsRow}>
            <ControlBtn label="Cancel" danger onPress={handleEnd} icon={<PhoneOff size={18} color="white" />} />
          </View>
        ) : (
          <View style={styles.controlsRow}>
            <ControlBtn label="Mute" active={muted} onPress={toggleMute} icon={muted ? <MicOff size={18} color="#4338ca" /> : <Mic size={18} color="#374151" />} />
            {callType === 'video' && (
              <ControlBtn label={videoOff ? 'Video On' : 'Video Off'} active={videoOff} onPress={toggleVideo} icon={videoOff ? <VideoOff size={18} color="#4338ca" /> : <Video size={18} color="#374151" />} />
            )}
            <ControlBtn label="React" active={reactionOpen} onPress={() => setReactionOpen(v => !v)} icon={<Smile size={18} color={reactionOpen ? '#4338ca' : '#374151'} />} />
            <ControlBtn label={onHold ? 'Resume' : 'Hold'} active={onHold} onPress={toggleHold} icon={onHold ? <Play size={18} color="#4338ca" /> : <Pause size={18} color="#374151" />} />
            <ControlBtn label="End" danger onPress={handleEnd} icon={<PhoneOff size={18} color="white" />} />
          </View>
        )}
      </View>
    </View>
  );
}

function ControlBtn({ label, icon, active, danger, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.controlBtnWrap}>
      <View style={[
        styles.controlBtn,
        danger && styles.controlBtnDanger,
        active && styles.controlBtnActive,
      ]}>
        {icon}
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassPill: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  statusLabel: { color: '#4338ca', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  statusTime: { color: '#1f2937', fontSize: 22, fontWeight: '700', marginTop: 10 },
  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 176, height: 176, borderRadius: 88, borderWidth: 2, borderColor: 'rgba(99,102,241,0.3)' },
  avatarGlassWrap: {
    width: 166, height: 166, borderRadius: 83, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
  avatar: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 54, fontWeight: '700' },
  contactName: { color: '#1f2937', fontSize: 20, fontWeight: '800', marginTop: 16 },
  downText: { color: '#6b7280', fontSize: 12.5, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  remoteVideo: { ...StyleSheet.absoluteFillObject },
  localVideoWrap: {
    position: 'absolute', top: 60, right: 20, width: 100, height: 150, borderRadius: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
  localVideo: { width: '100%', height: '100%' },
  reactionCard: {
    flexDirection: 'row', gap: 14, justifyContent: 'center', marginHorizontal: 40, marginBottom: 16,
    paddingVertical: 12, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  reactionEmoji: { fontSize: 22 },
  controlsWrap: {
    marginHorizontal: 20, marginBottom: 30, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  controlBtnWrap: { alignItems: 'center', gap: 6 },
  controlBtn: {
    width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  controlBtnActive: { backgroundColor: 'white' },
  controlBtnDanger: { backgroundColor: '#ef4444' },
  controlLabel: { color: '#4b5563', fontSize: 10.5, fontWeight: '600' },
  logHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 10 },
  logTitle: { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  addCallBtn: {
    width: 38, height: 38, borderRadius: 19, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
  logEmptyText: { textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 40 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  logAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  logAvatarText: { color: 'white', fontSize: 16, fontWeight: '700' },
  logName: { fontSize: 14.5, fontWeight: '700', color: '#1f2937' },
  logSubtext: { fontSize: 12, color: '#9ca3af' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pickerCard: { width: '100%', maxWidth: 340, borderRadius: 22, overflow: 'hidden', padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  pickerHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pickerTitle: { fontSize: 15, fontWeight: '800', color: '#1f2937' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  pickerCallBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(99,102,241,0.12)' },
});
