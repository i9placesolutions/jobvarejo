/**
 * Introspeccao do access token da Canva Connect API.
 *
 * Uso:
 *   CANVA_ACCESS_TOKEN=... CANVA_CLIENT_ID=... CANVA_CLIENT_SECRET=... node scripts/canva-introspect-token.js
 */

const token = String(process.env.CANVA_ACCESS_TOKEN || process.env.NUXT_CANVA_ACCESS_TOKEN || '').trim();
const clientId = String(process.env.CANVA_CLIENT_ID || '').trim();
const clientSecret = String(process.env.CANVA_CLIENT_SECRET || '').trim();

if (!token) {
  console.error('Falta CANVA_ACCESS_TOKEN no ambiente.');
  process.exit(1);
}

if (!clientId || !clientSecret) {
  console.error('Faltam CANVA_CLIENT_ID e/ou CANVA_CLIENT_SECRET no ambiente.');
  process.exit(1);
}

const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

const response = await fetch('https://api.canva.com/rest/v1/oauth/introspect', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({ token }).toString(),
});

const bodyText = await response.text();

try {
  const data = JSON.parse(bodyText);
  console.log(JSON.stringify(data, null, 2));
} catch {
  console.log(bodyText);
}

if (!response.ok) {
  process.exit(1);
}
