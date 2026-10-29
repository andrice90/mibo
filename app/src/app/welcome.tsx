import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bundled, preloadClips } from '@/lesson/clips';
import { forgetLearnedName, forgetName, learnedNames, makeNameLines, nameClip, pickLearnedName, restoreName, savedName, validName } from '@/lesson/name';
import { clearProgress, loadProgress, saveProgress } from '@/lesson/progress';
import { getMibo } from '@/puppet/mibo';
import { MiboStage } from '@/puppet/MiboStage';
import { Backdrop, Bubble, Card, Column, HomeButton } from '@/ui/kit';
import { C, F } from '@/ui/theme';
import { playClip, stopAudio, type Clip } from '@/voice/player';

const POINTS: [string, string, string][] = [
  ['👀', C.sky, 'Stay with your child. ◀ ▶ redo or skip any step.'],
  ['🌱', C.mint, 'A practice buddy, not a speech therapist. No diagnosis.'],
  ['✨', C.butter, "Mibo's replies are written by AI."],
  ['🔒', C.rose, 'Listening happens on this phone only. Voices are never kept or sent.'],
];

type Stage = 'ask' | 'making' | 'intro' | 'ready';
const CHIP = [C.mint, C.lavender, C.butter, C.peach, C.sky, C.rose];

/**
 * Before a lesson. The grown-up picks or types the child's name (or skips),
 * silently; then Mibo says hello by name and sends the child to fetch a grown-up,
 * then the grown-up's checklist (docs/06 §1) and the start button appear.
 * Resuming (?resume=1) skips the name: the saved one and its clips are used.
 */
export default function Welcome() {
  const puppet = useMemo(() => new (getMibo().Puppet)(), []);
  const params = useLocalSearchParams<{ lesson?: string; resume?: string }>();
  const lessonId = params.lesson ?? 's-th';
  const resume = params.resume === '1' ? loadProgress(lessonId) : null;
  const [stage, setStage] = useState<Stage>(resume ? 'making' : 'ask');
  const [name, setName] = useState('');
  const [known, setKnown] = useState<string[]>(() => learnedNames());
  const [ok, setOk] = useState(false);
  const [hear, setHear] = useState(true);

  const intro = async (useName: boolean, restored = false) => {
    const say = (c: Clip) => playClip(puppet, c).catch(() => {});
    stopAudio();
    setStage('making');
    puppet.setMood('thinking');
    const named = restored ? !!savedName() : useName && await makeNameLines(name);
    // remember the name and its clips with this lesson's progress, on this phone only
    const sn = savedName();
    if (named && sn) saveProgress(lessonId, { name: sn.name, nameLines: sn.lines });
    setStage('intro');
    puppet.setMood('happy');
    const hi = named ? nameClip('hi') : null;
    if (hi) { puppet.act('wave'); await say(hi); await say(bundled('welcomeRest')); }
    else await say(bundled('welcome'));
    puppet.setMood('neutral');
    setStage('ready');
  };

  useEffect(() => {
    let live = true;
    (async () => {
      await preloadClips(['welcome', 'welcomeRest']);
      if (!live) return;
      if (resume) {
        // picking up where they left off: the saved name (if any), no questions
        restoreName(resume.name, resume.nameLines);
        intro(false, true);
      } else {
        clearProgress(lessonId);   // starting over: forget the old place and name
        forgetName();
        // the name step is the grown-up's: Mibo just waves and stays quiet until it is done
        puppet.setMood('happy');
        puppet.act('wave');
      }
      preloadClips();   // the rest of the lesson's voice, while the grown-up types
    })();
    return () => { live = false; stopAudio(); puppet.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puppet]);


  return (
    <Backdrop>
      <SafeAreaView style={styles.root}>
        <Column max={640}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <HomeButton style={styles.homeBtn} onPress={() => { stopAudio(); puppet.stop(); router.dismissTo('/'); }} />
          {stage !== 'ready' && (
            <View style={styles.hero}>
              <Text style={styles.hi}>{"Hi, I'm Mibo!"}</Text>
              <Text style={styles.sub}>{"Let's practise the S and TH sounds together"}</Text>
            </View>
          )}
          {/* the checklist must fit a standard iPhone without scrolling, so Mibo steps back for it */}
          <View style={stage === 'ready' ? styles.stageSmall : styles.stage}>
            <MiboStage puppet={puppet} />
          </View>
          <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {stage === 'ask' && (
              <Card style={styles.card}>
                <Text style={styles.h2}>{known.length ? "Who's playing? 😊" : "What's your name? 😊"}</Text>
                {known.length > 0 && (
                  <View style={styles.chips}>
                    {known.map((n, i) => (
                      <View key={n} style={[styles.chip2, { backgroundColor: CHIP[i % CHIP.length] }]}>
                        <Pressable onPress={() => { if (pickLearnedName(n)) intro(false, true); }} hitSlop={6}
                          accessibilityRole="button" accessibilityLabel={`Play as ${n}`}>
                          <Text style={styles.chipName}>{n}</Text>
                        </Pressable>
                        <Pressable onPress={() => { forgetLearnedName(n); setKnown(learnedNames()); }} hitSlop={8}
                          accessibilityRole="button" accessibilityLabel={`Forget ${n}`}>
                          <Text style={styles.chipX}>×</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <TextInput
                  style={styles.input} value={name} onChangeText={setName} placeholder={known.length ? 'Add a new name' : "Your child's first name"}
                  placeholderTextColor={C.soft} autoCapitalize="words" autoCorrect={false} maxLength={20}
                  returnKeyType="done" onSubmitEditing={() => { if (validName(name)) intro(true); }}
                />
                <Text style={styles.note}>
                  {"Grown-up: type the first name so Mibo can say it. It is sent once to our voice service to make Mibo's lines, kept on this phone, and never sent to the AI that writes his replies."}
                </Text>
                <View style={styles.row}>
                  <Bubble label="Say hi!" bg={C.mint} deep={C.mintDeep} disabled={!validName(name)} onPress={() => intro(true)} />
                </View>
                <Pressable onPress={() => intro(false)} hitSlop={8}><Text style={styles.skip}>Skip</Text></Pressable>
              </Card>
            )}
            {(stage === 'making' || stage === 'intro') && (
              <Card style={[styles.card, styles.center]}>
                {stage === 'making' && <ActivityIndicator color={C.lavenderDeep} />}
                <Text style={styles.listen}>{stage === 'making' ? 'Mibo is learning your name…' : '👂 Listen to Mibo!'}</Text>
              </Card>
            )}
            {stage === 'ready' && (
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
                  <Bubble
                    label="Let's play!" bg={C.peach} deep={C.peachDeep} disabled={!ok}
                    onPress={() => {
                      stopAudio(); puppet.stop();
                      router.replace({ pathname: '/lesson', params: { listen: hear ? '1' : '0', lesson: lessonId, from: String(resume?.step ?? 0) } });
                    }}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        </Column>
      </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  homeBtn: { position: 'absolute', top: 8, left: 14, zIndex: 2 },
  hero: { alignItems: 'center', paddingTop: 12, paddingHorizontal: 60 },
  hi: { fontFamily: F.bold, fontSize: 34, color: C.ink },
  sub: { fontFamily: F.medium, fontSize: 17, color: C.soft, textAlign: 'center', marginTop: 2 },
  stage: { flex: 1, minHeight: 200, marginHorizontal: 16, marginVertical: 12 },
  stageSmall: { flex: 1, minHeight: 120, maxHeight: 220, marginHorizontal: 16, marginTop: 8, marginBottom: 10 },
  sheet: { flexGrow: 0 },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 10, gap: 12 },
  card: { gap: 8 },
  center: { alignItems: 'center', paddingVertical: 22 },
  h2: { fontFamily: F.bold, fontSize: 20, color: C.ink, marginBottom: 2 },
  input: {
    fontFamily: F.semi, fontSize: 22, color: C.ink, backgroundColor: C.lavender, borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  note: { fontFamily: F.medium, fontSize: 12.5, lineHeight: 17, color: C.soft },
  skip: { fontFamily: F.medium, fontSize: 14, color: C.soft, textAlign: 'center', textDecorationLine: 'underline' },
  listen: { fontFamily: F.bold, fontSize: 20, color: C.lavenderDeep },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip2: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 10, paddingLeft: 18, paddingRight: 12 },
  chipName: { fontFamily: F.bold, fontSize: 20, color: C.ink },
  chipX: { fontFamily: F.bold, fontSize: 18, color: C.soft },
  micRow: { backgroundColor: C.mint, marginTop: 0 },
  micBox: { borderColor: C.mintDeep },
  micOn: { backgroundColor: C.mintDeep },
});
