// Generate VAPID keys
const crypto = require('crypto');

// Generate key pair
const keyPair = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' }
});

// Convert to base64url
function base64url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Extract public key from SPKI (skip ASN.1 structure)
const spki = keyPair.publicKey;
// SPKI structure: SEQUENCE (30) + length + OID + BIT STRING (03) + length + 0x00 + X (32 bytes) + Y (32 bytes)
const publicKeyBytes = spki.slice(-65); // Last 65 bytes are the uncompressed public key

const publicKey = base64url(publicKeyBytes);
const privateKey = base64url(keyPair.privateKey);

console.log('Public Key:', publicKey);
console.log('Private Key:', privateKey);
console.log('');
console.log('Set these in Supabase:');
console.log(`supabase secrets set VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`supabase secrets set VAPID_PRIVATE_KEY=${privateKey}`);
