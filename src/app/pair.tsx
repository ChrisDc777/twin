import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PALETTES } from '@/domain/palettes';
import { isSupabaseConfigured } from '@/lib/supabase';
import { newId } from '@/lib/ids';
import { setPendingInvite } from '@/lib/pending-invite';
import { getMyPublicKey } from '@/lib/crypto';
import { ensureAnonymousAuth } from '@/services/auth';
import { acceptInvite, createInvite, previewInvite } from '@/services/connection';
import { registerPushToken } from '@/services/push';
import { syncFromCloud } from '@/store/sync';
import { useTwin } from '@/store/twin';

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

  return token ? (
    <AcceptInvite token={token} paletteAccent={p.accent} paletteBg={p.bg} paletteText={p.text} paletteMuted={p.textMuted} />
  ) : (
    <CreateInvite />
  );
}

function CreateInvite() {
  const router = useRouter();
  const self = useTwin((s) => s.self);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const displayName = self?.displayName ?? null;
  const palette = self?.palette;

  useEffect(() => {
    if (!palette) return;
    let cancelled = false;
    async function gen() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setToken(newId());
        return;
      }
      setBusy(true);
      try {
        await ensureAnonymousAuth();
        const invite = await createInvite(displayName, palette!, getMyPublicKey());
        if (!cancelled) setToken(invite.token);
      } catch (e) {
        console.warn('[twin] createInvite failed', e);
        if (!cancelled) setToken(newId());
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void gen();
    return () => {
      cancelled = true;
    };
  }, [displayName, palette]);

  if (!self) return null;
  const p = PALETTES[self.palette];

  const url = token
    ? `twin://pair?token=${token}&from=${encodeURIComponent(self.displayName ?? 'someone')}`
    : '';
  const code = token ? `${token.slice(0, 4)}-${token.slice(4, 8)}`.toUpperCase() : '— — — —';

  return (
    <LinearGradient colors={p.bg} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.body}>
          <ThemedText type="subtitle" style={{ color: p.text }}>
            Invite your person
          </ThemedText>
          <ThemedText
            style={{
              color: p.textMuted,
              marginTop: 8,
              maxWidth: 320,
              textAlign: 'center',
            }}
          >
            One link. They install Twin, tap it, and you're connected.
          </ThemedText>

          <View style={[styles.tokenBox, { borderColor: p.textMuted }]}>
            {busy ? (
              <ActivityIndicator color={p.accent} />
            ) : (
              <ThemedText type="code" style={{ color: p.accent, fontSize: 22, letterSpacing: 4 }}>
                {code}
              </ThemedText>
            )}
          </View>

          <Pressable
            style={[styles.cta, { borderColor: p.accent, opacity: token ? 1 : 0.4 }]}
            disabled={!token}
            onPress={() => Share.share({ message: `Be my Twin: ${url}` })}
          >
            <ThemedText style={{ color: p.accent }}>Share link</ThemedText>
          </Pressable>

          <Pressable style={styles.close} onPress={() => router.back()}>
            <ThemedText style={{ color: p.textMuted }}>Not now</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

type AcceptInviteProps = {
  token: string;
  paletteAccent: `#${string}`;
  paletteBg: [`#${string}`, `#${string}`];
  paletteText: `#${string}`;
  paletteMuted: `#${string}`;
};

function AcceptInvite({
  token,
  paletteAccent,
  paletteBg,
  paletteText,
  paletteMuted,
}: AcceptInviteProps) {
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
        const inv = await previewInvite(token);
        if (cancelled) return;
        if (!inv) {
          setError('This invite link is no longer valid.');
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
  }, [token]);

  const accept = async () => {
    setState('loading');
    try {
      await acceptInvite(token);
      await syncFromCloud();
      // No auto-redirect: the accepted view asks the one-time pulse
      // question, then routes home.
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
    <LinearGradient colors={paletteBg} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.body}>
          {state === 'loading' ? (
            <ActivityIndicator color={paletteAccent} />
          ) : null}

          {state === 'preview' && preview ? (
            <>
              <ThemedText type="subtitle" style={{ color: paletteText, textAlign: 'center' }}>
                {preview.displayName ?? 'Someone'} wants to be your Twin.
              </ThemedText>
              <ThemedText
                style={{
                  color: paletteMuted,
                  marginTop: 8,
                  maxWidth: 320,
                  textAlign: 'center',
                }}
              >
                Twin is a small shared widget between two people. Quiet by design.
              </ThemedText>
              <Pressable
                style={[styles.cta, { borderColor: paletteAccent, marginTop: 32 }]}
                onPress={accept}
              >
                <ThemedText style={{ color: paletteAccent }}>Accept</ThemedText>
              </Pressable>
            </>
          ) : null}

          {state === 'accepted' ? (
            <>
              <ThemedText type="subtitle" style={{ color: paletteText, textAlign: 'center' }}>
                Connected.
              </ThemedText>
              <ThemedText
                style={{
                  color: paletteMuted,
                  marginTop: 8,
                  maxWidth: 300,
                  textAlign: 'center',
                }}
              >
                Want a soft tap when {preview?.displayName ?? 'they'} reaches? No banners, no
                sounds — just a quiet pulse.
              </ThemedText>
              <Pressable
                style={[styles.cta, { borderColor: paletteAccent, marginTop: 16, opacity: pulseBusy ? 0.5 : 1 }]}
                disabled={pulseBusy}
                onPress={() => answerPulsePrompt(true)}
              >
                <ThemedText style={{ color: paletteAccent }}>Allow</ThemedText>
              </Pressable>
              <Pressable disabled={pulseBusy} onPress={() => answerPulsePrompt(false)}>
                <ThemedText style={{ color: paletteMuted }}>Not now</ThemedText>
              </Pressable>
            </>
          ) : null}

          {state === 'error' ? (
            <ThemedText style={{ color: paletteMuted, textAlign: 'center' }}>
              {error}
            </ThemedText>
          ) : null}

          <Pressable style={styles.close} onPress={() => router.back()}>
            <ThemedText style={{ color: paletteMuted }}>Close</ThemedText>
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
  cta: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  close: { marginTop: 8, padding: 12 },
});
