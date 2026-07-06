import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { BlurView } from '@react-native-community/blur';
import { Mic, MicOff, Smile, Video, VideoOff, Pause, Play, Phone, PhoneOff } from 'lucide-react-native';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
} from 'react-native-webrtc';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

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
  const { token } = useAuth();

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

  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(0.85)).current;
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const callIdRef = useRef(route.params?.call_id || null);
  const otherIdRef = useRef(isIncoming ? route.params?.caller_id : route.params?.callee_id);
  const endedRef = useRef(false);

  function createPeerConnection() {
    const pc = new RTCPeerConnection(ICE_SERVERS);

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
    if (!socket || isIncoming) return;
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

  return (
    <View style={styles.screen}>
      <View style={{ alignItems: 'center', paddingTop: 40 }}>
        <View style={styles.glassPill}>
          <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={20} />
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
              <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={25} />
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
          <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={20} />
          {REACTIONS.map(e => (
            <TouchableOpacity key={e} onPress={() => setReactionOpen(false)}>
              <Text style={styles.reactionEmoji}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.controlsWrap}>
        <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={25} />
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
});
