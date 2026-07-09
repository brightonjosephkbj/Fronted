import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { navigate } from '../navigation/navigationRef';

const SocketContext = createContext(null);
const MESSENGER_API = 'https://Brighton233j-Messenger-back-database.hf.space';

export function SocketProvider({ children }) {
  const { token, user, updateUserPoints } = useAuth();
  const { showBanner, triggerLevelUp } = useNotifications();
  const socketRef = useRef(null);
  const [socketInstance, setSocketInstance] = useState(null);
  const prevLevelRef = useRef(user?.level);

  useEffect(() => {
    if (!token) return;

    const socket = io(MESSENGER_API, { query: { token }, transports: ['websocket'] });
    socketRef.current = socket;
    setSocketInstance(socket); // ref alone doesn't re-render consumers — this does

    // 1:1 message from any chat you're not currently viewing
    socket.on('new_message', (data) => {
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

    // incoming voice/video call — jump straight to the Call screen
    socket.on('incoming_call', (data) => {
      navigate('Call', {
        contact: { id: data.caller_id, name: data.caller_username, color: '#9333ea' },
        call_id: data.call_id,
        caller_id: data.caller_id,
        call_type: data.call_type,
        offer: data.offer,
        incoming: true,
      });
    });

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
      socket.disconnect();
      setSocketInstance(null);
    };
  }, [token, user?.id]);

  return (
    <SocketContext.Provider value={{ socket: socketInstance }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
