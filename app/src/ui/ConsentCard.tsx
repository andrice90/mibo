import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { loadConsent } from '@/lesson/consent';
import { Bubble, Card } from './kit';
import { C, F } from './theme';

const POINTS: [string, string, string][] = [
  ['👀', C.sky, 'Stay with your child. ◀ ▶ redo or skip any step.'],
  ['🌱', C.mint, 'A practice buddy, not a speech therapist. No diagnosis.'],
  ['✨', C.butter, "Mibo's replies are written by AI."],
  ['🔒', C.rose, 'Listening happens on this phone only. Voices are never kept or sent.'],
];

/**
 * The grown-up's consent card: supervision points, the "I'm a grown-up"
 * tick, and the listen switch. Shown once — at first app start (home
 * screen) or, if a lesson is somehow reached first, before that lesson.
 * `onDone` gets the listen choice; the caller saves it (lesson/consent.ts).
 */
export function ConsentCard({ buttonLabel, onDone }: { buttonLabel: string; onDone: (hear: boolean) => void }) {
  const [ok, setOk] = useState(false);
  const [hear, setHear] = useState(() => loadConsent()?.hear ?? true);
  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.h2}>For the grown-up 👋</Text>
        {POINTS.map(([icon, bg, text]) => (
          <View key={icon} style={styles.point}>
            <View style={[styles.chip, { backgroundColor: bg }]}><Text style={styles.chipIcon}>{icon}</Text></View>
            <Text style={styles.pointText}>{text}</Text>
          </View>
        ))}
        <Pressable style={styles.check} onPress={() => setOk(v => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: ok }}>
          <View style={[styles.box, ok && styles.boxOn]}>{ok && <Text style={styles.tick}>✓</Text>}</View>
          <Text style={styles.checkText}>{"I'm a grown-up and I'll stay with my child."}</Text>
        </Pressable>
        <Pressable style={[styles.check, styles.micRow]} onPress={() => setHear(v => !v)} accessibilityRole="switch" accessibilityState={{ checked: hear }}>
          <View style={[styles.box, styles.micBox, hear && styles.micOn]}>{hear && <Text style={styles.tick}>✓</Text>}</View>
          <Text style={styles.checkText}>{'🎤 Let Mibo listen (on this phone only)'}</Text>
        </Pressable>
      </Card>
      <View style={styles.row}>
        <Bubble label={buttonLabel} bg={C.peach} deep={C.peachDeep} disabled={!ok} onPress={() => onDone(hear)} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  h2: { fontFamily: F.bold, fontSize: 20, color: C.ink, marginBottom: 2 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chipIcon: { fontSize: 15 },
  pointText: { flex: 1, fontFamily: F.medium, fontSize: 14, lineHeight: 18, color: C.ink },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, backgroundColor: C.lavender, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 11 },
  box: { width: 26, height: 26, borderRadius: 9, borderWidth: 2.5, borderColor: C.lavenderDeep, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.lavenderDeep },
  tick: { color: C.white, fontSize: 18, fontFamily: F.bold },
  checkText: { flex: 1, fontFamily: F.semi, fontSize: 14, color: C.ink },
  row: { flexDirection: 'row' },
  micRow: { backgroundColor: C.mint, marginTop: 0 },
  micBox: { borderColor: C.mintDeep },
  micOn: { backgroundColor: C.mintDeep },
});
