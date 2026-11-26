// Supabase over plain fetch: Auth (GoTrue) for passwords, PostgREST for tables.
// The service role key bypasses RLS: it is read only on the server and never sent to the browser.

const url = () => process.env.SUPABASE_URL;
const publishable = () => process.env.SUPABASE_PUBLISHABLE_KEY;
const service = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

async function call(path, { key, bearer, method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(`${url()}${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${bearer || key}`, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    const e = new Error(data?.msg || data?.message || data?.error_description || data?.error || `Supabase ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return data;
}

export const isConfigured = () => Boolean(url() && publishable() && service());

export const auth = {
  // Throws with status 400 on wrong email/password.
  signIn: (email, password) => call('/auth/v1/token?grant_type=password', { key: publishable(), method: 'POST', body: { email, password } }),
  adminCreateUser: (email, password) => call('/auth/v1/admin/users', { key: service(), method: 'POST', body: { email, password, email_confirm: true } }),
  adminUpdateUser: (id, attrs) => call(`/auth/v1/admin/users/${id}`, { key: service(), method: 'PUT', body: attrs }),
  adminListUsers: () => call('/auth/v1/admin/users?per_page=1000', { key: service() }),
};

const eq = (v) => `eq.${encodeURIComponent(v)}`;
const rep = { Prefer: 'return=representation' };
export const db = {
  one: async (table, col, val) => (await call(`/rest/v1/${table}?${col}=${eq(val)}&limit=1`, { key: service() }))[0] ?? null,
  // query: raw PostgREST query string, e.g. "psychologist_id=eq.<id>&order=created_at.desc"
  list: (table, query) => call(`/rest/v1/${table}?${query}`, { key: service() }),
  insert: async (table, row) => (await call(`/rest/v1/${table}`, { key: service(), method: 'POST', body: row, headers: rep }))[0],
  // Single UPDATE … WHERE <query>: returns the rows that matched (empty when none did).
  update: (table, query, patch) => call(`/rest/v1/${table}?${query}`, { key: service(), method: 'PATCH', body: patch, headers: rep }),
  upsert: (table, row) => call(`/rest/v1/${table}`, { key: service(), method: 'POST', body: row, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } }),
  rpc: (fn, args) => call(`/rest/v1/rpc/${fn}`, { key: service(), method: 'POST', body: args }),
  remove: (table, col, val) => call(`/rest/v1/${table}?${col}=${eq(val)}`, { key: service(), method: 'DELETE' }),
};
