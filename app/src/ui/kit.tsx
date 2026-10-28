import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { C, F } from './theme';

/** Soft sky-to-cream wash behind every screen. */
export function Backdrop({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={[C.sky, C.paper, '#fff1e6']} locations={[0, 0.45, 1]} style={styles.fill}>
      {children}
    </LinearGradient>
  );
}

export function Card({ children, style, tint = C.card }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  return <View style={[styles.card, { backgroundColor: tint }, style]}>{children}</View>;
}

/** A chunky candy button: pastel face, deeper edge underneath that sinks when pressed. */
export function Bubble({ label, onPress, bg, deep, disabled, style, textStyle, small }: {
  label: string; onPress: () => void; bg: string; deep: string; disabled?: boolean;
  style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>; small?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.btnWrap, style]}>
      {({ pressed }) => (
        <View style={[styles.btnEdge, { backgroundColor: deep, opacity: disabled ? 0.35 : 1 }]}>
          <View style={[styles.btn, small && styles.btnSmall, { backgroundColor: bg, transform: [{ translateY: pressed ? 0 : -5 }] }]}>
            <Text style={[styles.btnText, small && styles.btnTextSmall, { color: deep }, textStyle]}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function Pill({ children, bg = C.white, style }: { children: ReactNode; bg?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.pill, { backgroundColor: bg }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  card: {
    borderRadius: 28, padding: 18,
    shadowColor: '#6b5a8e', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  btnWrap: { flex: 1 },
  btnEdge: { borderRadius: 22, paddingTop: 5 },
  btn: { borderRadius: 22, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 11 },
  btnText: { fontFamily: F.bold, fontSize: 20 },
  btnTextSmall: { fontSize: 16 },
  pill: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: '#6b5a8e', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
});
