// supabase/functions/notify_partner/index.ts
//
// POST { partnerId: string, kind: 'pulse' }
// Verifies the caller is connected to partnerId, then dispatches an Expo
// push notification to all of partnerId's registered devices.
//
// We use the Expo push service (https://exp.host/--/api/v2/push/send) so
// we don't need to wire FCM/APNs credentials directly. Tokens are Expo
// push tokens like `ExponentPushToken[xxxx]`.

// @ts-expect-error — Deno runtime imports
import { createClient } from 'jsr:@supabase/supabase-js@2';

// @ts-expect-error — Deno global
declare const Deno: { env: { get(k: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = { partnerId: string; kind: 'pulse' };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return new Response('misconfigured', { status: 500, headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response('unauthorized', { status: 401, headers: corsHeaders });
  }
  const me = userData.user.id;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('bad json', { status: 400, headers: corsHeaders });
  }
  const { partnerId, kind } = body;
  if (!partnerId || kind !== 'pulse') {
    return new Response('bad request', { status: 400, headers: corsHeaders });
  }

  // Verify the caller and partner share a connection.
  const admin = createClient(url, serviceKey);
  const { data: conn, error: connErr } = await admin
    .from('connections')
    .select('user_a, user_b')
    .or(
      `and(user_a.eq.${me},user_b.eq.${partnerId}),and(user_a.eq.${partnerId},user_b.eq.${me})`,
    )
    .maybeSingle();
  if (connErr || !conn) {
    return new Response('not connected', { status: 403, headers: corsHeaders });
  }

  const { data: tokens } = await admin
    .from('device_tokens')
    .select('token, platform')
    .eq('user_id', partnerId);

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const messages = tokens.map((t: { token: string }) => ({
    to: t.token,
    title: 'Twin',
    body: 'A nudge from your person',
    sound: null, // calm by default
    data: { kind },
    priority: 'normal',
    channelId: 'pulses',
  }));

  const expoResp = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const expoJson = await expoResp.json().catch(() => ({}));
  return new Response(JSON.stringify({ sent: messages.length, expoJson }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
