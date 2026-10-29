import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, DashPathEffect, DiscretePathEffect, Path, Skia } from '@shopify/react-native-skia';
import { useMemo, type ReactNode } from 'react';
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

/**
 * Keeps a screen to a readable, thumb-friendly width on iPad: centred, at
 * most `max` points wide, full width on phones.
 */
export function Column({ children, max = 640, style }: { children: ReactNode; max?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.column, { maxWidth: max }, style]}>{children}</View>;
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

/** A white chalk arrow: several rough passes, like chalk dragged over a board. */
function ChalkArrow({ dir }: { dir: 'back' | 'fwd' }) {
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    const m = (x: number) => (dir === 'fwd' ? x : 44 - x);
    b.moveTo(m(7), 22).lineTo(m(36), 21.5);                    // shaft, a touch off level like a hand-drawn line
    b.moveTo(m(25), 10).lineTo(m(37), 21.5).lineTo(m(24.5), 33); // head
    return b.build();
  }, [dir]);
  return (
    <Canvas style={styles.chalk} pointerEvents="none">
      <Path path={path} style="stroke" strokeWidth={7} strokeCap="round" strokeJoin="round" color="white" opacity={0.35}>
        <DiscretePathEffect length={4} deviation={1.6} seed={1} />
      </Path>
      <Path path={path} style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" color="white" opacity={0.75}>
        <DashPathEffect intervals={[9, 2.2, 5, 1.6]} />
      </Path>
      <Path path={path} style="stroke" strokeWidth={2.6} strokeCap="round" strokeJoin="round" color="white" opacity={0.9}>
        <DiscretePathEffect length={3} deviation={0.9} seed={7} />
      </Path>
    </Canvas>
  );
}

/** Squircle candy button with a chalk arrow, for the grown-up's ◀ ▶. */
export function Arrow({ dir, onPress, bg, deep }: { dir: 'back' | 'fwd'; onPress: () => void; bg: string; deep: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={dir === 'fwd' ? 'Next' : 'Back'} hitSlop={8}>
      {({ pressed }) => (
        <View style={[styles.arrowEdge, { backgroundColor: deep }]}>
          <View style={[styles.arrowFace, { backgroundColor: bg, transform: [{ translateY: pressed ? 0 : -5 }] }]}>
            <ChalkArrow dir={dir} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Round "home" button, top-left on every screen past home. */
export function HomeButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Home" style={[styles.home, style]}>
      <Text style={styles.homeIcon}>🏠</Text>
    </Pressable>
  );
}

export function Pill({ children, bg = C.white, style }: { children: ReactNode; bg?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.pill, { backgroundColor: bg }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { flex: 1, width: '100%', alignSelf: 'center' },
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
  arrowEdge: { width: 96, height: 70, borderRadius: 26, borderCurve: 'continuous', paddingTop: 5 },
  arrowFace: { width: 96, height: 65, borderRadius: 26, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  chalk: { width: 44, height: 44 },
  home: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white,
    shadowColor: '#6b5a8e', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  homeIcon: { fontSize: 20 },
  pill: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: '#6b5a8e', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
});
