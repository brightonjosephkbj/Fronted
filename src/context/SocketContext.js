import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAuth } from './AuthContext';
import { syncPendingMessages, saveLocalMessage, saveLocalGroupMessage } from '../db/localMessages';
import { useNotifications } from './NotificationContext';
import { navigate } from '../navigation/navigationRef';

const SocketContext = createContext(null);
const MESSENGER_API = 'https://Brighton233j-Messenger-back-database.hf.space';
const RING_VIBRATION_PATTERN = [0, 1000, 1000];
const KEEP_AWAKE_TAG = 'b24-incoming-call';

export function SocketProvider({ children }) {
  const { token, user, updateUserPoints, apiRequest } = useAuth();
  const { showBanner, triggerLevelUp } = useNotifications();
  const socketRef = useRef(null);
  const [socketInstance, setSocketInstance] = useState(null);
  const prevLevelRef = useRef(user?.level);
  const ringtonePlayerRef = useRef(null);
  const isRingingRef = useRef(false);

  async function playRingtone() {
    if (isRingingRef.current) return;
    isRingingRef.current = true;
    try {
      Vibration.vibrate(RING_VIBRATION_PATTERN, true);
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix' });
      const player = createAudioPlayer(require('../../assets/ringtone.mp3'));
      player.loop = true;
      player.volume = 1.0;
      player.play();
      ringtonePlayerRef.current = player;
    } catch (e) {
      console.warn('Ringtone playback failed', e);
    }
  }

  function stopRingtone() {
    isRingingRef.current = false;
    Vibration.cancel();
    deactivateKeepAwake(KEEP_AWAKE_TAG);
    if (ringtonePlayerRef.current) {
      try {
        ringtonePlayerRef.current.pause();
        if (typeof ringtonePlayerRef.current.remove === 'function') {
          ringtonePlayerRef.current.remove();
        } else if (typeof ringtonePlayerRef.current.release === 'function') {
          ringtonePlayerRef.current.release();
        }
      } catch (e) {
        // already released, ignore
      }
      ringtonePlayerRef.current = null;
    }
  }

  useEffect(() => {
    if (!token) return;

    const socket = io(MESSENGER_API, { query: { token }, transports: ['websocket'] });
    socketRef.current = socket;
    setSocketInstance(socket); // ref alone doesn't re-render consumers — this does

    // on every connect (app launch, reconnect after offline) pull anything the
    // server is still holding for us, save it locally, then let the server drop it
    socket.on('connect', () => {
      syncPendingMessages(apiRequest, user?.id);
    });

    // 1:1 message from any chat you're not currently viewing
    socket.on('new_message', (data) => {
      // local SQLite is the source of truth now - save every message that comes
      // through here (yours and theirs), then ack so the server can delete its copy
      saveLocalMessage({
        id: data.id,
        chatId: String(data.sender_id === user?.id ? data.recipient_id : data.sender_id),
        senderId: data.sender_id,
        recipientId: data.recipient_id,
        content: data.content,
        mediaType: data.media_type,
        mediaUrl: data.media_url,
        ts: Math.floor(Date.now() / 1000),
        fromMe: data.sender_id === user?.id,
      });
      if (data.id) {
        apiRequest('/messages/ack', { method: 'POST', body: JSON.stringify({ ids: [data.id] }) }).catch(() => {});
      }

      if (data.sender_id === user?.id) return; // don't notify on your own messages
      showBanner({
        type: 'message',
        chatId: String(data.sender_id),
        title: data.sender_name || data.sender_username || 'New message',
        subtitle: data.content,
        onPress: (navigation) => {
          navigation.navigate('ChatDetail', {
            chat: { id: String(data.sender_id), name: data.sender_name || data.sender_username, color: data.sender_color },
          });
        },
      });
    });

    // group message from any group you're not currently viewing
    socket.on('new_group_message', (data) => {
      saveLocalGroupMessage({
        id: data.id,
        groupId: data.group_id,
        senderId: data.sender_id,
        senderUsername: data.sender_username || data.sender_name,
        senderColor: data.sender_color,
        senderVerified: data.sender_verified,
        content: data.content,
        mediaType: data.media_type,
        mediaUrl: data.media_url,
        ts: Math.floor(Date.now() / 1000),
        fromMe: data.sender_id === user?.id,
      });
      if (data.id) {
        apiRequest('/groups/messages/ack', { method: 'POST', body: JSON.stringify({ ids: [data.id] }) }).catch(() => {});
      }

      if (data.sender_id === user?.id) return;
      showBanner({
        type: 'message',
        chatId: `group:${data.group_id}`,
        title: data.group_name || 'Group message',
        subtitle: `${data.sender_name || 'Someone'}: ${data.content}`,
        onPress: (navigation) => {
          navigation.navigate('GroupChatDetail', {
            chat: { id: String(data.group_id), name: data.group_name, color: data.group_color },
          });
        },
      });
    });

    // incoming voice/video call — ring, vibrate, and jump to the Call screen
    socket.on('incoming_call', (data) => {
      playRingtone();
      navigate('Call', {
        contact: { id: data.caller_id, name: data.caller_username, color: '#9333ea' },
        call_id: data.call_id,
        caller_id: data.caller_id,
        call_type: data.call_type,
        offer: data.offer,
        incoming: true,
      });
    });

    // caller hung up or the call was rejected/missed before we answered — stop ringing
    socket.on('call_ended', stopRingtone);
    socket.on('call_rejected', stopRingtone);

    // a friend coming online
    socket.on('friend_online', (data) => {
      showBanner({
        type: 'online',
        title: `${data.username || 'A friend'} is online`,
      });
    });

    // points/level changes pushed from the backend
    socket.on('points_updated', (data) => {
      if (typeof data.points === 'number') {
        updateUserPoints(data.points, data.level);
      }
    });

    return () => {
      socket.off('call_ended', stopRingtone);
      socket.off('call_rejected', stopRingtone);
      stopRingtone();
      socket.disconnect();
      setSocketInstance(null);
    };
  }, [token, user?.id]);

  return (
    <SocketContext.Provider value={{ socket: socketInstance, stopRingtone }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
