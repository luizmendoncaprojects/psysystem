// KiWave API client. In dev, CRA proxies /api to the API server (package.json "proxy").
async function req(path, { method = 'GET', body } = {}) {
  let r;
  try {
    r = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Servidor fora do ar. Rode “npm run api” e tente de novo.'), { status: 0 });
  }
  // Without the dev proxy, /api falls through to index.html: treat non-JSON as "API offline".
  if (!(r.headers?.get?.('content-type') ?? 'application/json').includes('application/json')) {
    throw Object.assign(new Error('Servidor fora do ar. Rode “npm run api” e tente de novo.'), { status: 0 });
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || (r.status === 504 || r.status === 502 ? 'Servidor fora do ar. Rode “npm run api” e tente de novo.' : `Algo deu errado (erro ${r.status}).`)), { status: r.status });
  return data;
}

export const api = {
  login: (role, email, password) => req('/auth/login', { method: 'POST', body: { role, email, password } }),
  me: (role) => req(`/auth/me?role=${role}`),
  logout: (role) => req('/auth/logout', { method: 'POST', body: { role } }),
  signup: (data) => req('/auth/signup', { method: 'POST', body: data }),
  linkPreview: (code) => req(`/link/preview?code=${encodeURIComponent(code)}`),
  link: (code) => req('/link', { method: 'POST', body: { code } }),
  patients: {
    list: () => req('/patients'),
    create: () => req('/patients', { method: 'POST', body: {} }),
    newCode: (id) => req('/patients/code', { method: 'POST', body: { id } }),
  },
  documents: {
    sign: (doc) => req('/documents/sign', { method: 'POST', body: doc }),
    list: () => req('/documents'),
    pdfUrl: (id, role) => `/api/documents/pdf?id=${encodeURIComponent(id)}&role=${role}`,
  },
  requests: {
    create: (kind, why) => req('/requests', { method: 'POST', body: { kind, why } }),
    list: () => req('/requests'),
    done: (id) => req('/requests/done', { method: 'POST', body: { id } }),
  },
  certificate: {
    get: () => req('/certificate'),
    upload: (fileName, pfx, password) => req('/certificate', { method: 'POST', body: { fileName, pfx, password } }),
    reveal: (password) => req('/certificate/reveal', { method: 'POST', body: { password } }),
    remove: () => req('/certificate/remove', { method: 'POST', body: {} }),
  },
  google: {
    status: () => req('/google/status'),
    connect: () => req('/google/connect'),
    events: (timeMin, timeMax) => req(`/google/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`),
    create: (ev) => req('/google/events', { method: 'POST', body: ev }),
    disconnect: () => req('/google/disconnect', { method: 'POST', body: {} }),
  },
};
