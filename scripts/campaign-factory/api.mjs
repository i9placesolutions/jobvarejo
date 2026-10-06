// Cliente mínimo da API Magnific (acervo de stock; sem endpoints de IA).
export const H = { 'x-magnific-api-key': process.env.MAGNIFIC_API_KEY, Accept: 'application/json', 'Accept-Language': 'pt-BR' };
export async function api(path, params = {}) {
  const u = new URL(`https://api.magnific.com${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: H });
  const t = await r.text();
  if (!r.ok) throw Error(`${r.status} ${path}: ${t.slice(0, 300)}`);
  return JSON.parse(t);
}
