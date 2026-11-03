import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadConsent } from '@/lesson/consent';
import { newLessonId, saveCustomLesson, type CustomLesson } from '@/lesson/custom';
import { TOPIC_MAX, validTopic, type LessonPlan } from '@/lesson/plan';
import { wavFile } from '@/voice/player';
import { Paths } from 'expo-file-system';
import { Backdrop, Bubble, Card, Column, HomeButton } from '@/ui/kit';
import { C, F } from '@/ui/theme';

type Stage = 'ask' | 'planning' | 'review' | 'voicing' | 'error';
const EXAMPLES = ['S words about animals', 'Food words', 'Sh words about the sea', 'Words about vehicles', 'Z words at the zoo'];

type ClipIn = { text: string; audio: string; visemes: CustomLesson['clips'][string]['visemes']; seconds: number };

/**
 * Create a lesson (grown-up flow): type the kind of words to work on, Meta AI
 * writes a plan, the grown-up checks it, and only on "Make the voice" does
 * Leda speak its lines. The finished lesson is saved on this phone and can
 * be played at once — no app rebuild.
 */
export default function Create() {
  const [topic, setTopic] = useState('');
  const [stage, setStage] = useState<Stage>('ask');
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [error, setError] = useState('');

  const makePlan = async (t: string) => {
    const what = t.trim();
    if (!validTopic(what)) return;
    setTopic(what); setStage('planning'); setError('');
    try {
      const r = await fetch('/api/lesson-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: what }),
      });
      const b = await r.json();
      if (!r.ok || !b.plan) throw new Error(b.error || 'no plan');
      setPlan(b.plan as LessonPlan); setStage('review');
    } catch (e) {
      setError((e as Error).message === 'no plan' ? 'Mibo could not dream up that lesson. Try different words.' : (e as Error).message);
      setStage('error');
    }
  };

  const accept = async () => {
    if (!plan) return;
    setStage('voicing'); setError('');
    try {
      const r = await fetch('/api/lesson-voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }),
      });
      const b = await r.json();
      if (!r.ok || !b.clips) throw new Error(b.error || 'voice failed');
      const id = newLessonId();
      const clips: CustomLesson['clips'] = {};
      for (const [cid, c] of Object.entries(b.clips as Record<string, ClipIn>)) {
        const src = wavFile(c.audio, `lesson-${id}-${cid}`, Platform.OS === 'web' ? undefined : Paths.document) as { uri: string };
        clips[cid] = { uri: src.uri, text: c.text, visemes: c.visemes, seconds: c.seconds };
      }
      saveCustomLesson({ id, createdAt: Date.now(), plan: (b.plan as LessonPlan) ?? plan, clips });
      const hear = loadConsent()?.hear ?? true;
      router.replace({ pathname: '/lesson', params: { custom: id, listen: hear ? '1' : '0' } });
    } catch (e) {
      setError((e as Error).message); setStage('review');
    }
  };

  return (
    <Backdrop>
      <SafeAreaView style={styles.root}>
        <Column max={640}>
          <HomeButton style={styles.homeBtn} onPress={() => router.dismissTo('/')} />
          <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.hi}>Make a new lesson ✨</Text>
              <Text style={styles.sub}>For the grown-up: tell Mibo what words to work on. Mibo (Meta AI) writes a plan for you to check. Nothing is made until you say yes.</Text>

              {(stage === 'ask' || stage === 'error' || stage === 'planning') && (
                <Card style={styles.card}>
                  <Text style={styles.h2}>What words shall we practise?</Text>
                  <TextInput
                    style={styles.input} value={topic} onChangeText={setTopic} maxLength={TOPIC_MAX}
                    placeholder="e.g. S words about animals" placeholderTextColor={C.soft}
                    autoCapitalize="sentences" returnKeyType="done" onSubmitEditing={() => makePlan(topic)}
                  />
                  <View style={styles.chips}>
                    {EXAMPLES.map(x => (
                      <Pressable key={x} onPress={() => makePlan(x)} accessibilityRole="button">
                        <View style={styles.chip}><Text style={styles.chipText}>{x}</Text></View>
                      </Pressable>
                    ))}
                  </View>
                  {stage === 'error' && <Text style={styles.err}>{error}</Text>}
                  <View style={styles.row}>
                    <Bubble label={stage === 'planning' ? 'Mibo is thinking…' : 'Make my lesson plan'} bg={C.mint} deep={C.mintDeep}
                      disabled={!validTopic(topic) || stage === 'planning'} onPress={() => makePlan(topic)} />
                  </View>
                  {stage === 'planning' && <ActivityIndicator color={C.lavenderDeep} />}
                  <Text style={styles.note}>Mibo is a practice buddy, not a speech therapist. Made lessons are AI-written — please check the words before playing.</Text>
                </Card>
              )}

              {(stage === 'review' || stage === 'voicing') && plan && (
                <Card style={styles.card}>
                  <Text style={styles.planEmoji}>{plan.emoji}</Text>
                  <Text style={styles.h2}>{plan.title}</Text>
                  <Text style={styles.planSub}>{plan.subtitle}</Text>
                  <Text style={styles.line}>“{plan.introLine}”</Text>
                  <View style={styles.words}>
                    {plan.words.map(w => (
                      <View key={w.word} style={styles.word}>
                        <Text style={styles.wordEmoji}>{w.emoji}</Text>
                        <Text style={styles.wordText}>{w.word}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.line}>Game: “{plan.pick.askLine}”</Text>
                  <Text style={styles.line}>“{plan.byeLine}”</Text>
                  {!!error && <Text style={styles.err}>{error}</Text>}
                  <View style={styles.row}>
                    <Bubble label={stage === 'voicing' ? "Making Mibo's voice…" : 'Yes — make the voice'} bg={C.mint} deep={C.mintDeep}
                      disabled={stage === 'voicing'} onPress={accept} />
                  </View>
                  {stage === 'voicing' && <ActivityIndicator color={C.lavenderDeep} />}
                  <View style={styles.row}>
                    <Bubble small label="Try different words" bg={C.peach} deep={C.peachDeep} disabled={stage === 'voicing'}
                      onPress={() => { setStage('ask'); setPlan(null); }} />
                  </View>
                  <View style={styles.row}>
                    <Bubble small label="Re-roll this plan" bg={C.lavender} deep={C.lavenderDeep} disabled={stage === 'voicing'}
                      onPress={() => makePlan(topic)} />
                  </View>
                </Card>
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
  body: { padding: 16, paddingTop: 56, gap: 14 },
  hi: { fontFamily: F.bold, fontSize: 32, color: C.ink, textAlign: 'center' },
  sub: { fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.soft, textAlign: 'center' },
  card: { gap: 10 },
  h2: { fontFamily: F.bold, fontSize: 21, color: C.ink },
  input: {
    fontFamily: F.semi, fontSize: 20, color: C.ink, backgroundColor: C.lavender, borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: C.sky, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontFamily: F.semi, fontSize: 14, color: C.ink },
  note: { fontFamily: F.medium, fontSize: 12.5, lineHeight: 17, color: C.soft },
  err: { fontFamily: F.semi, fontSize: 14, color: C.peachDeep },
  row: { flexDirection: 'row' },
  planEmoji: { fontSize: 44, textAlign: 'center' },
  planSub: { fontFamily: F.semi, fontSize: 16, color: C.soft, textAlign: 'center' },
  line: { fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.ink, textAlign: 'center' },
  words: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginVertical: 4 },
  word: { alignItems: 'center', backgroundColor: C.paper, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  wordEmoji: { fontSize: 28 },
  wordText: { fontFamily: F.bold, fontSize: 16, color: C.ink },
});
