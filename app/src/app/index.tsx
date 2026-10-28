import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMibo } from '@/puppet/mibo';
import { MiboStage } from '@/puppet/MiboStage';
import { Backdrop, Bubble, Card } from '@/ui/kit';
import { C, F } from '@/ui/theme';

const POINTS: [string, string, string][] = [
  ['👀', C.sky, 'Stay with your child the whole time. You tap how each try sounded.'],
  ['🌱', C.mint, 'Mibo is a practice buddy, not a speech therapist, and gives no diagnosis.'],
  ['✨', C.butter, "Mibo's replies are written by AI."],
  ['🔒', C.rose, "Your child's voice is never recorded or sent anywhere: only your taps are."],
];

/** Grown-up screen shown before every session (docs/06 §1). */
export default function Welcome() {
  const puppet = useMemo(() => new (getMibo().Puppet)(), []);
  const [ok, setOk] = useState(false);

  return (
    <Backdrop>
      <SafeAreaView style={styles.root}>
        <View style={styles.hero}>
          <Text style={styles.hi}>{"Hi, I'm Mibo!"}</Text>
          <Text style={styles.sub}>{"Let's practise the S and TH sounds together"}</Text>
        </View>
        <View style={styles.stage}>
          <MiboStage puppet={puppet} />
        </View>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
          <Card tint={C.card} style={styles.card}>
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
          </Card>
          <View style={styles.go}>
            <Bubble
              label="Let's play!"
              bg={C.peach} deep={C.peachDeep}
              disabled={!ok}
              onPress={() => { puppet.act('wave'); router.push('/lesson'); }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { alignItems: 'center', paddingTop: 12, paddingHorizontal: 24 },
  hi: { fontFamily: F.bold, fontSize: 34, color: C.ink },
  sub: { fontFamily: F.medium, fontSize: 17, color: C.soft, textAlign: 'center', marginTop: 2 },
  stage: { flex: 1, minHeight: 200, marginHorizontal: 16, marginVertical: 12 },
  sheet: { flexGrow: 0 },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  card: { gap: 10 },
  h2: { fontFamily: F.bold, fontSize: 20, color: C.ink, marginBottom: 2 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chipIcon: { fontSize: 18 },
  pointText: { flex: 1, fontFamily: F.medium, fontSize: 15, lineHeight: 20, color: C.ink },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, backgroundColor: C.lavender, borderRadius: 18, padding: 12 },
  box: { width: 30, height: 30, borderRadius: 10, borderWidth: 2.5, borderColor: C.lavenderDeep, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.lavenderDeep },
  tick: { color: C.white, fontSize: 18, fontFamily: F.bold },
  checkText: { flex: 1, fontFamily: F.semi, fontSize: 15, color: C.ink },
  go: { flexDirection: 'row' },
});
