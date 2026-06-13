import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PALETTES, type Palette } from '@/domain/palettes';
import { isSupabaseConfigured } from '@/lib/supabase';
import { newId } from '@/lib/ids';
import { setPendingInvite } from '@/lib/pending-invite';
import { getMyPublicKey } from '@/lib/crypto';
import { ensureAnonymousAuth } from '@/services/auth';
import {
  acceptInvite,
  acceptInviteByCode,
  createInvite,
  previewInvite,
  previewInviteByCode,
} from '@/services/connection';
import { registerPushToken } from '@/services/push';
import { syncFromCloud } from '@/store/sync';
import { useTwin } from '@/store/twin';

type InviteSource = { token: string } | { code: string };

export default function Pair() {
  const router = useRouter();
  const self = useTwin((s) => s.self);
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : undefined;

  // If an invitee opens the link before completing onboarding, stash the
  // token and bounce them through onboarding. After onboarding finishes,
  // we replay the accept-invite route with the saved token.
  useEffect(() => {
    if (token && !self) {
      setPendingInvite(token);
      router.replace('/onboarding');
    }
  }, [token, self, router]);

  if (!self) return null;
  const p = PALETTES[self.palette];

  if (token) return <AcceptInvite source={{ token }} palette={p} />;
  return <PairHome palette={p} />;
}

// Default screen: create an invite, with a path to enter a code instead.
function PairHome({ palette: p }: { palette: Palette }) {
  const [mode, setMode] = useState<'create' | 'enter'>('create');
  if (mode === 'enter') return <EnterCode palette={p} onBack={() => setMode('create')} />;
  return <CreateInvite palette={p} onEnterCode={() => setMode('enter')} />;
}

function CreateInvite({ palette: p, onEnterCode }: { palette: Palette; onEnterCode: () => void }) {
  const router = useRouter();
  const self = useTwin((s) => s.self);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const displayName = self?.displayName ?? null;
  const palette = self?.palette;

  useEffect(() => {
    if (!palette) return;
    let cancelled = false;
    async function gen() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setToken(newId());
          setCode('DEMO12');
        }
        return;
      }
      setBusy(true);
      try {
        await ensureAnonymousAuth();
        const invite = await createInvite(displayName, palette!, getMyPublicKey());
        if (!cancelled) {
          setToken(invite.token);
          setCode(invite.short_code);
        }
      } catch (e) {
        console.warn('[twin] createInvite failed', e);
        if (!cancelled) {
          setToken(newId());
          setCode(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void gen();
    return () => {
      cancelled = true;
    };
  }, [displayName, palette]);

  const url = token
    ? `twin://pair?token=${token}&from=${encodeURIComponent(self?.displayName ?? 'someone')}`
    : '';
  const shareMessage = code
    ? `Be my Twin — tap ${url} or enter code ${code} in the app.`
    : `Be my Twin: ${url}`;

  return (
    <LinearGradient colors={p.bg} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.body}>
          <ThemedText type="subtitle" style={{ color: p.text }} accessibilityRole="header">
            Invite your person
          </ThemedText>
          <ThemedText
            style={{ color: p.textMuted, marginTop: 8, maxWidth: 320, textAlign: 'center' }}
          >
            Share the link, or read them the code to type in.
          </ThemedText>

          <View
            style={[styles.tokenBox, { borderColor: p.textMuted }]}
            accessibilityLabel={code ? `Your invite code is ${code.split('').join(' ')}` : 'Generating invite code'}
          >
            {busy ? (
              <ActivityIndicator color={p.accent} />
            ) : (
              <ThemedText type="code" style={{ color: p.accent, fontSize: 28, letterSpacing: 6 }}>
                {code ?? '——————'}
              </ThemedText>
            )}
          </View>

          <Pressable
            style={[styles.cta, { borderColor: p.accent, opacity: token ? 1 : 0.4 }]}
            disabled={!token}
            accessibilityRole="button"
            accessibilityLabel="Share invite link"
            onPress={() => Share.share({ message: shareMessage })}
          >
            <ThemedText style={{ color: p.accent }}>Share link</ThemedText>
          </Pressable>

          <Pressable
            style={styles.subtle}
            accessibilityRole="button"
            onPress={onEnterCode}
          >
            <ThemedText style={{ color: p.textMuted }}>Have a code? Enter it</ThemedText>
          </Pressable>

          <Pressable
            style={styles.close}
            accessibilityRole="button"
            onPress={() => router.back()}
          >
            <ThemedText style={{ color: p.textMuted }}>Not now</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function EnterCode({ palette: p, onBack }: { palette: Palette; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return <AcceptInvite source={{ code }} palette={p} />;

  const ready = code.trim().length === 6;

  return (
    <LinearGradient colors={p.bg} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.body}>
          <ThemedText type="subtitle" style={{ color: p.text }} accessibilityRole="header">
            Enter their code
          </ThemedText>
          <ThemedText
            style={{ color: p.textMuted, marginTop: 8, maxWidth: 320, textAlign: 'center' }}
          >
            Six characters, from the person who invited you.
          </ThemedText>

          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6))}
            placeholder="ABC123"
            placeholderTextColor={p.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={6}
            accessibilityLabel="Invite code, six characters"
            style={[
              styles.codeInput,
              { color: p.text, borderColor: p.textMuted },
            ]}
            onSubmitEditing={() => ready && setSubmitted(true)}
          />

          <Pressable
            style={[styles.cta, { borderColor: p.accent, opacity: ready ? 1 : 0.4 }]}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Continue with this code"
            onPress={() => setSubmitted(true)}
          >
            <ThemedText style={{ color: p.accent }}>Continue</ThemedText>
          </Pressable>

          <Pressable style={styles.close} accessibilityRole="button" onPress={onBack}>
            <ThemedText style={{ color: p.textMuted }}>Back</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function AcceptInvite({ source, palette: p }: { source: InviteSource; palette: Palette }) {
  const router = useRouter();
  const setPushOptedIn = useTwin((s) => s.setPushOptedIn);
  const [state, setState] = useState<'loading' | 'preview' | 'accepted' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ displayName: string | null } | null>(null);
  const [pulseBusy, setPulseBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setError('Backend not configured.');
          setState('error');
        }
        return;
      }
      try {
        await ensureAnonymousAuth();
        const inv =
          'token' in source
            ? await previewInvite(source.token)
            : await previewInviteByCode(source.code);
        if (cancelled) return;
        if (!inv) {
          setError('That invite is no longer valid.');
          setState('error');
          return;
        }
        setPreview({ displayName: inv.display_name });
        setState('preview');
      } catch (e) {
        if (cancelled) return;
        setError((e as Error)?.message ?? 'Could not load invite.');
        setState('error');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = async () => {
    setState('loading');
    try {
      if ('token' in source) await acceptInvite(source.token);
      else await acceptInviteByCode(source.code);
      await syncFromCloud();
      setState('accepted');
    } catch (e) {
      setError((e as Error)?.message ?? 'Could not accept invite.');
      setState('error');
    }
  };

  const answerPulsePrompt = async (allow: boolean) => {
    if (pulseBusy) return;
    setPulseBusy(true);
    try {
      if (allow) {
        setPushOptedIn(true);
        const pushToken = await registerPushToken();
        if (!pushToken) setPushOptedIn(false);
      } else {
        setPushOptedIn(false);
      }
    } finally {
      router.replace('/');
    }
  };

  return (
    <LinearGradient colors={p.bg} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.body}>
          {state === 'loading' ? <ActivityIndicator color={p.accent} /> : null}

          {state === 'preview' && preview ? (
            <>
              <ThemedText
                type="subtitle"
                style={{ color: p.text, textAlign: 'center' }}
                accessibilityRole="header"
              >
                {preview.displayName ?? 'Someone'} wants to be your Twin.
              </ThemedText>
              <ThemedText
                style={{ color: p.textMuted, marginTop: 8, maxWidth: 320, textAlign: 'center' }}
              >
                Twin is a small shared widget between two people. Quiet by design.
              </ThemedText>
              <Pressable
                style={[styles.cta, { borderColor: p.accent, marginTop: 32 }]}
                accessibilityRole="button"
                accessibilityLabel="Accept invite"
                onPress={accept}
              >
                <ThemedText style={{ color: p.accent }}>Accept</ThemedText>
              </Pressable>
            </>
          ) : null}

          {state === 'accepted' ? (
            <>
              <ThemedText
                type="subtitle"
                style={{ color: p.text, textAlign: 'center' }}
                accessibilityRole="header"
              >
                Connected.
              </ThemedText>
              <ThemedText
                style={{ color: p.textMuted, marginTop: 8, maxWidth: 300, textAlign: 'center' }}
              >
                Want a soft tap when {preview?.displayName ?? 'they'} reaches? No banners, no
                sounds — just a quiet pulse.
              </ThemedText>
              <Pressable
                style={[
                  styles.cta,
                  { borderColor: p.accent, marginTop: 16, opacity: pulseBusy ? 0.5 : 1 },
                ]}
                disabled={pulseBusy}
                accessibilityRole="button"
                accessibilityLabel="Allow soft pulses"
                onPress={() => answerPulsePrompt(true)}
              >
                <ThemedText style={{ color: p.accent }}>Allow</ThemedText>
              </Pressable>
              <Pressable
                style={styles.subtle}
                disabled={pulseBusy}
                accessibilityRole="button"
                onPress={() => answerPulsePrompt(false)}
              >
                <ThemedText style={{ color: p.textMuted }}>Not now</ThemedText>
              </Pressable>
            </>
          ) : null}

          {state === 'error' ? (
            <ThemedText style={{ color: p.textMuted, textAlign: 'center' }}>{error}</ThemedText>
          ) : null}

          <Pressable style={styles.close} accessibilityRole="button" onPress={() => router.back()}>
            <ThemedText style={{ color: p.textMuted }}>Close</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  tokenBox: {
    marginTop: 24,
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInput: {
    marginTop: 16,
    fontSize: 32,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 12,
    minWidth: 240,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cta: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  subtle: { paddingVertical: 8, paddingHorizontal: 12 },
  close: { marginTop: 8, padding: 12, minHeight: 44, justifyContent: 'center' },
});
