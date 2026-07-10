
if (!__DEV__) {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    Alert.alert(
      isFatal ? 'Fatal Error' : 'Error',
      `${error.name}: ${error.message}\n\n${error.stack}`,
      [{ text: 'OK' }]
    );
    defaultHandler(error, isFatal);
  });
}

import React, { useEffect } from 'react';
import { Linking, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { slideFromRight, slideFromBottom, fadeTransition } from './src/navigation/screenOptions';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { SocketProvider } from './src/context/SocketContext';
import { FontPrefsProvider } from './src/context/FontPrefsContext';

import AuthScreen from './src/screens/AuthScreen';
import LockScreen from './src/screens/LockScreen';
import MainScreen from './src/screens/MainScreen';
import StatusScreen from './src/screens/StatusScreen';
import SearchScreen from './src/screens/SearchScreen';
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import ChatSettingsScreen from './src/screens/ChatSettingsScreen';
import GroupChatDetailScreen from './src/screens/GroupChatDetailScreen';
import GroupSettingsScreen from './src/screens/GroupSettingsScreen';
import CreateNewScreen from './src/screens/CreateNewScreen';
import CallScreen from './src/screens/CallScreen';
import RequestsScreen from './src/screens/RequestsScreen';
import AddFriendScreen from './src/screens/AddFriendScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SetPinScreen from './src/screens/SetPinScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { user, isLocked, apiRequest } = useAuth();

  useEffect(() => {
    if (!user || !apiRequest) return;

    function handleUrl(url) {
      if (!url) return;
      const match = url.match(/^b24meet:\/\/join\/(.+)$/);
      if (!match) return;
      const code = match[1];
      apiRequest(`/groups/join/${code}`, { method: 'POST' })
        .then(res => {
          navigationRef.current?.navigate('GroupChatDetail', {
            group: { id: res.group_id, name: res.name },
          });
        })
        .catch(() => {
          Alert.alert('Invite error', "This invite link is invalid or expired.");
        });
    }

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [user, apiRequest]);

  if (isLocked) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Lock" component={LockScreen} />
      </Stack.Navigator>
    );
  }

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainScreen} />
      <Stack.Screen name="Status" component={StatusScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={slideFromRight} />
      <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} options={slideFromBottom} />
      <Stack.Screen name="GroupChatDetail" component={GroupChatDetailScreen} options={slideFromRight} />
      <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} options={slideFromBottom} />
      <Stack.Screen name="CreateNew" component={CreateNewScreen} />
      <Stack.Screen name="Call" component={CallScreen} options={fadeTransition} />
      <Stack.Screen name="Requests" component={RequestsScreen} />
      <Stack.Screen name="AddFriend" component={AddFriendScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={slideFromBottom} />
      <Stack.Screen name="SetPin" component={SetPinScreen} options={slideFromBottom} />
      <Stack.Screen name="Points" component={PointsScreen} options={slideFromBottom} />
    </Stack.Navigator>
  );
}

import PointsScreen from './src/screens/PointsScreen';

export default function App() {
  return (
    <AuthProvider>
      <FontPrefsProvider>
      <NotificationProvider>
      <SocketProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
      </SocketProvider>
    </NotificationProvider>
      </FontPrefsProvider>
    </AuthProvider>
  );
}
