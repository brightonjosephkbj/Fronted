import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

export default function AnimatedPressable({ children, style, onPress, scaleTo = 0.94, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 6 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }).start();
  }

  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
