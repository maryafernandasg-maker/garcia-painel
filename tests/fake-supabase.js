// Supabase de mentira para testes de navegador: guarda os registros no localStorage e simula o RLS (só o dono vê).
(function () {
  const K = "fakeSupaRows", S = "fakeSupaSession";
  const load = () => JSON.parse(localStorage.getItem(K) || "[]");
  const save = rows => localStorage.setItem(K, JSON.stringify(rows));
  const sess = () => JSON.parse(localStorage.getItem(S) || "null");
  const cbs = [];
  window.__fakeCalls = 0;
  function builder(table) {
    const b = { filters: [], op: "select" };
    const me = () => sess() && sess().user.id;
    const match = r => r.owner === me() && b.filters.every(([c, v]) => {
      if (c === "collection" || c === "id") return r[c] === v;
      const m = /^data->>(.+)$/.exec(c); const x = r.data[m[1]];
      return x != null && String(x) === v;
    });
    Object.assign(b, {
      select() { return b; }, eq(c, v) { b.filters.push([c, v]); return b; }, range(a, z) { b.rng = [a, z]; return b; },
      maybeSingle() { b.single = true; return b; },
      upsert(row) { b.op = "upsert"; b.row = row; return b; }, update(o) { b.op = "update"; b.obj = o; return b; }, delete() { b.op = "delete"; return b; },
      then(res, rej) {
        window.__fakeCalls++;
        try {
          if (!me()) return res({ data: null, error: { message: "JWT expired" } });
          let rows = load();
          if (b.op === "select") {
            let out = rows.filter(match).map(r => ({ id: r.id, data: JSON.parse(JSON.stringify(r.data)) }));
            if (b.rng) out = out.slice(b.rng[0], b.rng[1] + 1);
            return res({ data: b.single ? out[0] || null : out, error: null });
          }
          if (b.op === "upsert") {
            if (b.row.owner !== me()) return res({ data: null, error: { message: "new row violates row-level security policy" } });
            rows = rows.filter(r => !(r.owner === b.row.owner && r.collection === b.row.collection && r.id === b.row.id));
            rows.push(JSON.parse(JSON.stringify(b.row))); save(rows); return res({ data: null, error: null });
          }
          if (b.op === "update") { rows.forEach(r => { if (match(r)) Object.assign(r, JSON.parse(JSON.stringify(b.obj))); }); save(rows); return res({ data: null, error: null }); }
          if (b.op === "delete") { save(rows.filter(r => !match(r))); return res({ data: null, error: null }); }
        } catch (e) { (rej || res)(e); }
      },
    });
    return b;
  }
  window.supabase = {
    createClient() {
      return {
        from: builder,
        auth: {
          async getSession() { return { data: { session: sess() } }; },
          async signInWithPassword({ email, password }) {
            if (email === "marya@teste.com" && password === "senha123") { const s = { user: { id: "u1", email } }; localStorage.setItem(S, JSON.stringify(s)); return { data: s, error: null }; }
            return { data: {}, error: { message: "Invalid login credentials" } };
          },
          async signOut() { localStorage.removeItem(S); cbs.forEach(cb => cb("SIGNED_OUT", null)); return { error: null }; },
          onAuthStateChange(cb) { cbs.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
        },
      };
    },
  };
})();
