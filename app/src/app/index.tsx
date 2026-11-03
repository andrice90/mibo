import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { hasConsent, loadConsent, saveConsent } from '@/lesson/consent';
import { deleteCustomLesson, listCustomLessons, type CustomLesson } from '@/lesson/custom';
import { LESSONS, type LessonInfo } from '@/lesson/lessons';
import { loadProgress, type Progress } from '@/lesson/progress';
import { getMibo } from '@/puppet/mibo';
import { MiboStage } from '@/puppet/MiboStage';
import { ConsentCard } from '@/ui/ConsentCard';
import { Backdrop, Bubble, Card, Column } from '@/ui/kit';
import { C, F } from '@/ui/theme';

/** Home: the lessons, and where each one was left off (saved on this phone only). */
export default function Home() {
  const puppet = useMemo(() => new (getMibo().Puppet)(), []);
  const [saved, setSaved] = useState<Record<string, Progress | null>>({});
  const [made, setMade] = useState<CustomLesson[]>([]);
  const [ask, setAsk] = useState<LessonInfo | null>(null);
  const [del, setDel] = useState<CustomLesson | null>(null);
  // the grown-up's consent is given once, at first app start; after that lessons just start
  const [consented, setConsented] = useState<boolean>(() => hasConsent());

  // re-read progress every time the screen comes back into view
  useFocusEffect(useCallback(() => {
    setSaved(Object.fromEntries(LESSONS.map(l => [l.id, loadProgress(l.id)])));
    setMade(listCustomLessons());
    setConsented(hasConsent());
  }, []));

  const open = (l: LessonInfo, resume: boolean) => {
    setAsk(null);
    router.push({ pathname: '/welcome', params: { lesson: l.id, resume: resume ? '1' : '0' } });
  };
  const pick = (l: LessonInfo) => {
    if (!l.ready) return;
    if ((saved[l.id]?.step ?? 0) > 0) setAsk(l); else open(l, false);
  };

  return (
    <Backdrop>
      <SafeAreaView style={styles.root}>
        <Column max={640}>
        <View style={styles.hero}>
          <View style={styles.mini}><MiboStage puppet={puppet} /></View>
          <View style={styles.heroText}>
            <Text style={styles.hi}>Mibo</Text>
            <Text style={styles.sub}>Pick a lesson to play</Text>
          </View>
        </View>
        {!consented ? (
          <View style={styles.gate}>
            <ConsentCard buttonLabel="Start playing" onDone={hear => { saveConsent(hear); setConsented(true); }} />
          </View>
        ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {LESSONS.map(l => {
            const p = saved[l.id];
            return (
              <Pressable key={l.id} onPress={() => pick(l)} disabled={!l.ready} accessibilityRole="button"
                accessibilityLabel={`${l.title}: ${l.subtitle}`}>
                {({ pressed }) => (
                  <View style={[styles.lesson, { backgroundColor: l.bg, borderColor: l.deep }, !l.ready && styles.locked,
                    pressed && styles.pressed]}>
                    <View style={[styles.badge, { backgroundColor: C.white }]}><Text style={styles.emoji}>{l.emoji}</Text></View>
                    <View style={styles.lessonText}>
                      <Text style={[styles.title, { color: l.deep }]}>{l.title}</Text>
                      <Text style={styles.subtitle}>{l.subtitle}</Text>
                      {l.ready && p && p.step > 0 && (
                        <Text style={styles.meta}>
                          {`Step ${p.step + 1} of ${l.steps}`}{p.stars ? `  ·  ⭐ ${p.stars}` : ''}{p.name ? `  ·  ${p.name}` : ''}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.go, { color: l.deep }]}>{l.ready ? (p && p.step > 0 ? 'Continue' : 'Play') : 'Soon'}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          {made.map(l => (
            <View key={l.id} style={[styles.lesson, { backgroundColor: '#ffc7d6', borderColor: '#c94f7c' }]}>
              <Pressable style={styles.madeMain} onPress={() =>
                router.push({ pathname: '/lesson', params: { custom: l.id, listen: loadConsent()?.hear === false ? '0' : '1' } })}
                accessibilityRole="button" accessibilityLabel={`${l.plan.title}: ${l.plan.subtitle}`}>
                <View style={[styles.badge, { backgroundColor: C.white }]}><Text style={styles.emoji}>{l.plan.emoji}</Text></View>
                <View style={styles.lessonText}>
                  <Text style={[styles.title, { color: '#c94f7c' }]}>{l.plan.title}</Text>
                  <Text style={styles.subtitle}>{l.plan.subtitle}</Text>
                  <Text style={styles.meta}>{l.plan.words.map(w => w.word).join(' · ')}</Text>
                </View>
                <Text style={[styles.go, { color: '#c94f7c' }]}>Play</Text>
              </Pressable>
              <Pressable onPress={() => setDel(l)} hitSlop={10}
                accessibilityRole="button" accessibilityLabel={`Delete ${l.plan.title}`}>
                <Text style={styles.del}>×</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => router.push({ pathname: '/create' })} accessibilityRole="button" accessibilityLabel="Make a new lesson">
            {({ pressed }) => (
              <View style={[styles.lesson, styles.create, pressed && styles.pressed]}>
                <View style={[styles.badge, { backgroundColor: C.white }]}><Text style={styles.emoji}>✨</Text></View>
                <View style={styles.lessonText}>
                  <Text style={[styles.title, { color: '#c94f7c' }]}>Make a new lesson</Text>
                  <Text style={styles.subtitle}>Grown-ups: choose the words, Mibo plans it</Text>
                </View>
                <Text style={[styles.go, { color: '#c94f7c' }]}>Make</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
        )}

        <Modal transparent visible={!!ask} animationType="fade" onRequestClose={() => setAsk(null)}>
          <Pressable style={styles.scrim} onPress={() => setAsk(null)}>
            {ask && (
              <Card style={styles.dialog}>
                <Text style={styles.dialogEmoji}>{ask.emoji}</Text>
                <Text style={styles.dialogTitle}>Pick up where you left off?</Text>
                <Text style={styles.dialogSub}>
                  {`${ask.title}, step ${(saved[ask.id]?.step ?? 0) + 1} of ${ask.steps}`}
                  {saved[ask.id]?.name ? ` with ${saved[ask.id]?.name}` : ''}
                </Text>
                <View style={styles.row}>
                  <Bubble label="Continue" bg={C.mint} deep={C.mintDeep} onPress={() => open(ask, true)} />
                </View>
                <View style={styles.row}>
                  <Bubble small label="Start over" bg={C.peach} deep={C.peachDeep} onPress={() => open(ask, false)} />
                </View>
              </Card>
            )}
          </Pressable>
        </Modal>

        <Modal transparent visible={!!del} animationType="fade" onRequestClose={() => setDel(null)}>
          <Pressable style={styles.scrim} onPress={() => setDel(null)}>
            {del && (
              <Card style={styles.dialog}>
                <Text style={styles.dialogEmoji}>{del.plan.emoji}</Text>
                <Text style={styles.dialogTitle}>Delete this lesson?</Text>
                <Text style={styles.dialogSub}>
                  {`“${del.plan.title}” and Mibo's voice for it will be removed from this phone.`}
                </Text>
                <View style={styles.row}>
                  <Bubble label="Delete lesson" bg={C.rose} deep="#c94f7c"
                    onPress={() => { deleteCustomLesson(del.id); setDel(null); setMade(listCustomLessons()); }} />
                </View>
                <View style={styles.row}>
                  <Bubble small label="Keep it" bg={C.mint} deep={C.mintDeep} onPress={() => setDel(null)} />
                </View>
              </Card>
            )}
          </Pressable>
        </Modal>
        </Column>
      </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  mini: { width: 130, height: 130 },
  heroText: { flex: 1 },
  hi: { fontFamily: F.bold, fontSize: 40, color: C.ink },
  sub: { fontFamily: F.medium, fontSize: 18, color: C.soft },
  list: { padding: 16, gap: 14 },
  gate: { padding: 16, gap: 12 },
  lesson: {
    flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 26, borderWidth: 2.5, padding: 14,
    shadowColor: '#6b5a8e', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  locked: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }] },
  badge: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 32 },
  lessonText: { flex: 1, gap: 2 },
  title: { fontFamily: F.bold, fontSize: 21 },
  subtitle: { fontFamily: F.medium, fontSize: 15, color: C.ink },
  meta: { fontFamily: F.semi, fontSize: 13, color: C.soft, marginTop: 2 },
  go: { fontFamily: F.bold, fontSize: 16 },
  create: { backgroundColor: '#ffeef4', borderColor: '#c94f7c', borderStyle: 'dashed' },
  madeMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  del: { fontFamily: F.bold, fontSize: 24, color: '#c94f7c', paddingHorizontal: 4 },
  scrim: { flex: 1, backgroundColor: 'rgba(59,51,85,0.35)', justifyContent: 'center', padding: 24 },
  dialog: { alignItems: 'center', gap: 10, width: '100%', maxWidth: 440, alignSelf: 'center' },
  dialogEmoji: { fontSize: 48 },
  dialogTitle: { fontFamily: F.bold, fontSize: 22, color: C.ink, textAlign: 'center' },
  dialogSub: { fontFamily: F.medium, fontSize: 15, color: C.soft, textAlign: 'center', marginBottom: 4 },
  row: { flexDirection: 'row', alignSelf: 'stretch' },
});
