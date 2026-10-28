import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LESSON_1 } from '@/lesson/content';
import { useLesson } from '@/lesson/useLesson';
import { getMibo, listenCaptions } from '@/puppet/mibo';
import { MiboStage } from '@/puppet/MiboStage';
import { Backdrop, Bubble, Card, Pill } from '@/ui/kit';
import { C, F, SOUND } from '@/ui/theme';

// Steps before the tongue-sound intro belong to /s/, the rest to /th/: the dots take that sound's colour.
const TH_FROM = LESSON_1.findIndex(s => s.kind === 'line' && s.clip === 'th_intro');
const stepSound = (i: number) => (i >= TH_FROM ? SOUND.th : SOUND.s);
const STICKERS = ['🦄', '🐙', '🦕', '🐝', '🌈', '🚀', '🐸', '🦁'];

/**
 * The lesson: Mibo fills the stage for the child, a speech bubble shows what
 * Mibo says, and the grown-up's buttons only appear when it's the child's turn.
 */
export default function Lesson() {
  const puppet = useMemo(() => new (getMibo().Puppet)(), []);
  const { ui, start, stop, answer, total } = useLesson(puppet);
  const [caption, setCaption] = useState('');

  useEffect(() => {
    listenCaptions(puppet, text => setCaption(prev => (prev === text ? prev : text)));
    const t = setTimeout(start, 600);
    return () => { clearTimeout(t); listenCaptions(puppet, null); };
  }, [puppet, start]);

  const listening = ui.phase === 'listening';
  const sound = ui.ex ? SOUND[ui.ex.sound] : stepSound(ui.step);
  const bubble = ui.phase === 'loading' ? 'Getting my voice ready…'
    : listening ? 'Your turn!' : ui.phase === 'thinking' ? caption || '…' : caption;

  return (
    <Backdrop>
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Pressable onPress={() => { stop(); router.back(); }} hitSlop={12} style={styles.close} accessibilityLabel="Close lesson">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
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
              <Bubble label="Finish" bg={C.lavender} deep={C.lavenderDeep} onPress={() => router.back()} />
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
              {listening ? (
                <>
                  <Text style={styles.parentLabel}>Grown-up: how did that sound?</Text>
                  <View style={styles.row}>
                    <Bubble label="Got it ✓" bg={C.mint} deep={C.mintDeep} onPress={() => answer('got')} />
                    <Bubble label="Still tricky" bg={C.peach} deep={C.peachDeep} onPress={() => answer('tricky')} />
                  </View>
                  <Pressable onPress={() => answer('skip')} hitSlop={8}>
                    <Text style={styles.skip}>Skip this one</Text>
                  </Pressable>
                </>
              ) : ui.phase === 'idle' ? (
                <View style={styles.row}><Bubble label="Start" bg={C.mint} deep={C.mintDeep} onPress={start} /></View>
              ) : (
                <Text style={styles.parentHint}>
                  {ui.phase === 'thinking' ? 'Mibo is thinking…' : ui.phase === 'loading' ? 'One moment…' : 'Watch and listen together 👀'}
                  {ui.live === 'fallback' ? '  (offline line)' : ''}
                </Text>
              )}
            </Card>
          </>
        )}
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
  parent: { minHeight: 140, gap: 12, justifyContent: 'center' },
  parentLabel: { fontFamily: F.semi, fontSize: 15, color: C.lavenderDeep, textAlign: 'center' },
  parentHint: { fontFamily: F.medium, fontSize: 15, color: C.soft, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  skip: { fontFamily: F.medium, fontSize: 14, color: C.soft, textAlign: 'center', textDecorationLine: 'underline' },
  done: { alignItems: 'center', gap: 8 },
  doneRow: { alignSelf: 'stretch' },
  sticker: { fontSize: 72 },
  doneTitle: { fontFamily: F.bold, fontSize: 26, color: C.ink },
  doneSub: { fontFamily: F.medium, fontSize: 16, color: C.soft, marginBottom: 6 },
});
