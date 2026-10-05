import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, type } from '../constants/theme';

const ACTION_W = 88;
const THRESHOLD = 56;

/**
 * Swipe left → Deal, swipe right → Blocked.
 */
export default function SwipeableStatusRow({ children, onDeal, onBlocked, disabled }) {
  const translateX = useRef(new Animated.Value(0)).current;

  const reset = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        !disabled && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        const clamped = Math.max(-ACTION_W, Math.min(ACTION_W, g.dx));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -ACTION_W,
            duration: 120,
            useNativeDriver: true,
          }).start(() => {
            onDeal?.();
            reset();
          });
        } else if (g.dx >= THRESHOLD) {
          Animated.timing(translateX, {
            toValue: ACTION_W,
            duration: 120,
            useNativeDriver: true,
          }).start(() => {
            onBlocked?.();
            reset();
          });
        } else {
          reset();
        }
      },
      onPanResponderTerminate: reset,
    })
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <View style={[styles.action, styles.blocked]}>
          <Text style={styles.actionText}>Blocked</Text>
        </View>
        <View style={[styles.action, styles.deal]}>
          <Text style={styles.actionText}>Deal</Text>
        </View>
      </View>
      <Animated.View
        style={[styles.foreground, { transform: [{ translateX }] }]}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  actions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  action: {
    width: ACTION_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blocked: { backgroundColor: colors.neutral },
  deal: { backgroundColor: colors.accent },
  actionText: { ...type.secondary, color: colors.onPrimary, fontWeight: '700' },
  foreground: {
    backgroundColor: colors.background,
  },
});
