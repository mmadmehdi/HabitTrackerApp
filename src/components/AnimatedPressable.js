// src/components/AnimatedPressable.js
import React, { useRef, useCallback, memo } from 'react';
import { TouchableOpacity, Animated } from 'react-native';
import { SPRING_CONFIG } from '../constants/theme';

export const AnimatedPressable = memo(function AnimatedPressable({
  children,
  style,
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  scaleTo = 0.96,
  hitSlop,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      ...SPRING_CONFIG,
    }).start();
  }, [scale, scaleTo]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      ...SPRING_CONFIG,
    }).start();
  }, [scale]);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
});
