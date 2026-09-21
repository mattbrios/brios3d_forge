// Smoke test contra uma API já rodando (ex.: docker compose). Sai com 1 na primeira falha.
const baseUrl = process.env.SMOKE_URL ?? 'http://localhost:3001';

const cases = [
  { name: 'GET /health', path: '/health', status: 200, body: { status: 'ok' } },
  { name: 'GET /nada', path: '/nada', status: 404, errorOnly: true },
  {
    name: 'POST /health with malformed JSON',
    path: '/health',
    init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{x' },
    status: 400,
    errorOnly: true,
  },
];

let failed = false;
for (const { name, path, init, status, body, errorOnly } of cases) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const json = await response.json().catch(() => null);
  const keys = json && typeof json === 'object' ? Object.keys(json) : [];
  const ok =
    response.status === status &&
    (body === undefined || JSON.stringify(json) === JSON.stringify(body)) &&
    (!errorOnly ||
      (keys.length === 1 && keys[0] === 'error' && typeof json.error === 'string' && json.error.length > 0));
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} -> ${response.status} ${JSON.stringify(json)}`);
  failed ||= !ok;
}
process.exit(failed ? 1 : 0);
