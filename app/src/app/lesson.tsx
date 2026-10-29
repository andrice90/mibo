import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LESSON_1 } from '@/lesson/content';
import { clearProgress, loadProgress, saveProgress } from '@/lesson/progress';
import { useLesson } from '@/lesson/useLesson';
import { getMibo, listenCaptions } from '@/puppet/mibo';
import { MiboStage } from '@/puppet/MiboStage';
import { Arrow, Backdrop, Bubble, Card, Column, HomeButton, Pill } from '@/ui/kit';
import { C, F, SOUND } from '@/ui/theme';

// Steps before the tongue-sound intro belong to /s/, the rest to /th/: the dots take that sound's colour.
const TH_FROM = LESSON_1.findIndex(s => s.kind === 'line' && s.clip === 'th_intro');
const stepSound = (i: number) => (i >= TH_FROM ? SOUND.th : SOUND.s);
const STICKERS = ['🦄', '🐙', '🦕', '🐝', '🌈', '🚀', '🐸', '🦁'];

/**
 * The lesson: Mibo fills the stage for the child and a speech bubble shows
 * what he says. The grown-up's ◀ ▶ arrows stay on screen the whole time, as
 * the fallback for when Mibo's listening gets it wrong.
 */
export default function Lesson() {
  const puppet = useMemo(() => new (getMibo().Puppet)(), []);
  const params = useLocalSearchParams<{ listen?: string; lesson?: string; from?: string }>();
  const lessonId = params.lesson ?? 's-th';
  const from = Math.max(0, Math.min(LESSON_1.length - 1, Number(params.from) || 0));
  const { ui, start, resume, stop, nav, total } = useLesson(puppet, {
    listen: params.listen !== '0', from, stars: from ? loadProgress(lessonId)?.stars ?? 0 : 0,
    // remember the place on this phone, so the home screen can offer "continue"
    onProgress: (step, stars) => saveProgress(lessonId, { step, stars }),
    onDone: () => clearProgress(lessonId),
  });
  const [caption, setCaption] = useState('');

  useEffect(() => {
    listenCaptions(puppet, text => setCaption(prev => (prev === text ? prev : text)));
    const t = setTimeout(resume, 600);
    return () => { clearTimeout(t); listenCaptions(puppet, null); };
  }, [puppet, resume]);

  const listening = ui.phase === 'listening';
  const sound = ui.ex ? SOUND[ui.ex.sound] : stepSound(ui.step);
  const bubble = ui.phase === 'loading' ? 'Getting my voice ready…'
    : listening ? 'Your turn!' : ui.phase === 'thinking' ? caption || '…' : caption;

  return (
    <Backdrop>
      <SafeAreaView style={styles.root}>
        <Column max={680}>
        <View style={styles.top}>
          <HomeButton onPress={() => { stop(); router.dismissTo('/'); }} />
          <Pill style={styles.dots}>
            {Array.from({ length: total }, (_, i) => {
              const c = stepSound(i);
              return <View key={i} style={[styles.dot, { backgroundColor: i <= ui.step ? c.deep : c.bg }, i === ui.step && styles.dotNow]} />;
            })}
          </Pill>
          <Pill bg={C.butter}><Text style={styles.stars}>⭐ {ui.stars}</Text></Pill>
        </View>

        <View style={styles.stage}>
          <MiboStage puppet={puppet} />
          {ui.ex && (
            <View style={[styles.word, { backgroundColor: sound.bg, borderColor: sound.deep }]} pointerEvents="none">
              <Text style={styles.emoji}>{ui.ex.emoji}</Text>
              <Text style={[styles.wordText, { color: sound.deep }]}>{ui.ex.target}</Text>
            </View>
          )}
        </View>

        {ui.phase === 'done' ? (
          <Card style={styles.done}>
            <Text style={styles.sticker}>{STICKERS[ui.stars % STICKERS.length]}</Text>
            <Text style={styles.doneTitle}>You earned a sticker!</Text>
            <Text style={styles.doneSub}>
              {ui.stars ? `${'⭐'.repeat(ui.stars)}  ${ui.stars} star${ui.stars === 1 ? '' : 's'} today` : 'Lovely practising today!'}
            </Text>
            <View style={[styles.row, styles.doneRow]}>
              <Bubble label="Play again" bg={C.mint} deep={C.mintDeep} onPress={start} />
              <Bubble label="Finish" bg={C.lavender} deep={C.lavenderDeep} onPress={() => router.dismissTo('/')} />
            </View>
          </Card>
        ) : (
          <>
            <View style={styles.bubbleWrap}>
              <View style={styles.tail} />
              <View style={styles.bubble}>
                {ui.phase === 'loading' && <ActivityIndicator color={C.lavenderDeep} />}
                <Text style={styles.caption} numberOfLines={4} adjustsFontSizeToFit>{bubble}</Text>
              </View>
            </View>

            <Card tint={listening ? C.lavender : C.card} style={styles.parent}>
              <View style={styles.navRow}>
                <Arrow dir="back" bg={C.peachDeep} deep="#c45f3c" onPress={() => nav('back')} />
                <View style={styles.status}>
                  {listening && ui.mic && (
                    <View style={styles.meter}>
                      {[0.15, 0.35, 0.55, 0.75, 0.9].map((th, i) => (
                        <View key={i} style={[styles.bar, { height: 12 + i * 7 }, ui.level > th && styles.barOn]} />
                      ))}
                    </View>
                  )}
                </View>
                <Arrow dir="fwd" bg={C.mintDeep} deep="#1f7d5a" onPress={() => nav('fwd')} />
              </View>
            </Card>
          </>
        )}
        </Column>
      </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 14, paddingBottom: 8 },
  top: { flexDirection: 'row', alignItems: 'center', paddingTop: 4, gap: 10 },
  close: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white,
    shadowColor: '#6b5a8e', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  closeText: { fontSize: 16, color: C.soft, fontFamily: F.bold },
  dots: { flex: 1, justifyContent: 'center', gap: 4, paddingHorizontal: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotNow: { width: 16 },
  stars: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  stage: { flex: 1, marginVertical: 12 },
  word: {
    position: 'absolute', top: 12, right: 12, borderRadius: 24, borderWidth: 2.5, paddingVertical: 8, paddingHorizontal: 16,
    alignItems: 'center', transform: [{ rotate: '4deg' }],
  },
  emoji: { fontSize: 46 },
  wordText: { fontFamily: F.bold, fontSize: 20 },
  bubbleWrap: { alignItems: 'center', marginBottom: 12 },
  tail: { width: 22, height: 22, backgroundColor: C.white, transform: [{ rotate: '45deg' }], marginBottom: -12 },
  bubble: {
    alignSelf: 'stretch', minHeight: 72, backgroundColor: C.white, borderRadius: 26, paddingHorizontal: 20, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: '#6b5a8e', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  caption: { fontFamily: F.semi, fontSize: 22, lineHeight: 28, color: C.ink, textAlign: 'center' },
  parent: { paddingVertical: 12, paddingHorizontal: 12 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  status: { flex: 1, alignItems: 'center', gap: 6 },
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 44 },
  bar: { width: 10, borderRadius: 5, backgroundColor: C.white },
  barOn: { backgroundColor: C.lavenderDeep },
  row: { flexDirection: 'row', gap: 12 },
  done: { alignItems: 'center', gap: 8 },
  doneRow: { alignSelf: 'stretch' },
  sticker: { fontSize: 72 },
  doneTitle: { fontFamily: F.bold, fontSize: 26, color: C.ink },
  doneSub: { fontFamily: F.medium, fontSize: 16, color: C.soft, marginBottom: 6 },
});
