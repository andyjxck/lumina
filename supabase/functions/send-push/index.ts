import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Use real generated keys
const VAPID_KEYS = {
  publicKey: 'BNArJVazQlSp8JN2IOekE7eI4ADel_aCRMBKZ6-5iiCG3gZ2jG_ilCjn5erXJlzHXzO86Z7EoLEEIJW207vBNbQ',
  privateKey: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgBXHmMqlaBfB9mNJzwrEtfpwxtSWCZ6bQqnxaDkM9ktihRANCAATQKyVWs0JUqfCTdiDnpBO3iOAA3pf2gkTASmevuYoght4Gdoxv4pQo5-Xq1yZcx18zvOmexKCxBCCVttO7wTW0'
};
const VAPID_SUBJECT = 'mailto:admin@lumina-ac-trading.netlify.app';

serve(async (req) => {
  console.log('Push function called:', req.method, req.url);
  
  // Test endpoint - show notification directly
  if (req.url.includes('/test')) {
    const { data } = await req.json();
    return new Response(JSON.stringify({ 
      message: 'Test notification sent',
      data: data 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Headers': 'authorization, content-type' 
      } 
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  const { user_id, title, body, url } = await req.json();
  console.log('Push request data:', { user_id, title, body, url });
  
  if (!user_id || !title) {
    return new Response(JSON.stringify({ error: 'user_id and title required' }), { status: 400 });
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user_id);

  console.log(`Found ${subs?.length || 0} push subscriptions for user ${user_id}`);
  if (!subs || subs.length === 0) {
    console.log('No push subscriptions found - user needs to enable notifications');
    return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const payload = JSON.stringify({ title, body: body || '', url: url || '/', tag: 'lumina' });
  let sent = 0;

  for (const sub of subs) {
    try {
      // Create VAPID auth
      const audience = new URL(sub.endpoint).origin;
      const jwt = await createVapidJwt(audience);
      
      console.log('Sending to endpoint:', sub.endpoint);
      console.log('Subscription keys:', { 
        p256dh: sub.p256dh ? 'present' : 'missing',
        auth: sub.auth ? 'present' : 'missing'
      });
      console.log('VAPID header:', `vapid t=${jwt.substring(0, 20)}..., k=${VAPID_KEYS.publicKey.substring(0, 20)}...`);
      console.log('Payload:', payload);
      
      const response = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `vapid t=${jwt}, k=${VAPID_KEYS.publicKey}`,
          'Content-Type': 'application/json',
          'TTL': '86400',
        },
        body: payload,
      });

      console.log('Push response:', response.status);
      if (response.status !== 200 && response.status !== 201) {
        const errorText = await response.text();
        console.log('Push error response:', errorText);
      }
      
      if (response.status === 200 || response.status === 201) {
        sent++;
      } else if (response.status === 410 || response.status === 404) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    } catch (error) {
      console.error('Push send error:', error);
    }
  }

  return new Response(JSON.stringify({ sent }), { 
    status: 200, 
    headers: { 'Access-Control-Allow-Origin': '*' } 
  });
});

async function createVapidJwt(audience: string): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = { 
    aud: audience, 
    exp: Math.floor(Date.now() / 1000) + 43200, 
    sub: VAPID_SUBJECT 
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(String.fromCharCode(...encoder.encode(JSON.stringify(header))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payloadB64 = btoa(String.fromCharCode(...encoder.encode(JSON.stringify(payload))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const unsignedJwt = `${headerB64}.${payloadB64}`;
  
  console.log('JWT header:', header);
  console.log('JWT payload:', payload);
  console.log('Unsigned JWT length:', unsignedJwt.length);

  // Import and use the private key
  const privateKeyBase64 = VAPID_KEYS.privateKey.replace(/-/g, '+').replace(/_/g, '/');
  console.log('Private key length:', privateKeyBase64.length);
  console.log('Private key first 20 chars:', privateKeyBase64.substring(0, 20));
  const privateKeyBinary = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
  console.log('Private key binary length:', privateKeyBinary.length);
  
  // Try JWK format - convert PKCS#8 to JWK
  let privateKey;
  try {
    // Extract the actual 32-byte private key from PKCS#8
    // PKCS#8 structure: 0x30 0x81 0x88 0x02 0x01 0x00 0x30 0x13 ... 0x04 0x20 <32-byte-key>
    let keyStart = -1;
    for (let i = 0; i < privateKeyBinary.length - 32; i++) {
      if (privateKeyBinary[i] === 0x04 && privateKeyBinary[i + 1] === 0x20) {
        keyStart = i + 2;
        break;
      }
    }
    
    if (keyStart > 0) {
      const rawKeyBytes = privateKeyBinary.slice(keyStart, keyStart + 32);
      privateKey = await crypto.subtle.importKey(
        'raw',
        rawKeyBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );
      console.log('Private key extracted and imported as raw format');
    } else {
      throw new Error('Could not find private key in PKCS#8');
    }
  } catch (e) {
    console.log('Raw extraction failed, trying PKCS#8');
    privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBinary,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  }
  console.log('Private key imported successfully');

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsignedJwt)
  );

  // VAPID expects DER signature format
  const derBytes = new Uint8Array(signature);
  console.log('Signature format:', derBytes[0].toString(16), 'length:', derBytes.length);
  
  // Use DER signature directly (VAPID expects DER)
  const signatureB64 = btoa(String.fromCharCode(...derBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${unsignedJwt}.${signatureB64}`;
}
