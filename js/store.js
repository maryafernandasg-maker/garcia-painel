"use strict";
/* =====================================================================
   PERSISTÊNCIA — Supabase (PostgreSQL + login)
   Tabela única "docs": cada registro é um documento (coleção + id + dados em JSON),
   sempre ligado ao usuário logado. As regras de segurança do banco (RLS) só deixam
   a dona ler e gravar os próprios registros.
   A interface é a mesma usada pelo resto do sistema (put, patch, remove, find…).
   ===================================================================== */
const Store = (() => {
  const cfg = window.GARCIA_CONFIG || {};
  let sb = null, user = null;
  const listeners = new Set();
  const state = { status: "connecting", error: null, clientes: null, cd: null, user: null };
  const emit = () => listeners.forEach(fn => fn(state));
  const ERR = {
    auth: "Sua sessão expirou. Entre de novo.",
    network: "Sem conexão com o banco. Confira a internet e tente de novo.",
    quota: "O banco atingiu um limite do plano gratuito. Exporte um backup e fale com o suporte do painel.",
    generic: "Não foi possível concluir. Tente de novo em instantes.",
  };
  const message = e => {
    const m = String((e && (e.message || e.error_description)) || "");
    if (e && e.code === "PGRST301" || /jwt|token|auth/i.test(m)) return ERR.auth;
    if (/fetch|network|failed to/i.test(m)) return ERR.network;
    if (/quota|limit|exceed/i.test(m)) return ERR.quota;
    return ERR.generic;
  };
  const ok = r => { if (r.error) throw r.error; return r.data; };
  const toDoc = row => ({ id: row.id, ...row.data });

  /* ---------- consultas acompanhadas (recarregadas depois de cada gravação) ---------- */
  const watches = {}; // key -> {col, field, value, apply}
  const pending = new Set(); let timer = null;
  async function run(w) {
    let q = sb.from("docs").select("id,data").eq("collection", w.col);
    if (w.field) q = q.eq(`data->>${w.field}`, String(w.value));
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const page = ok(await q.range(from, from + 999));
      rows.push(...page.map(toDoc));
      if (page.length < 1000) break;
    }
    w.apply(rows);
  }
  function refresh(col) {
    pending.add(col);
    clearTimeout(timer);
    return new Promise(res => {
      timer = setTimeout(async () => {
        const cols = new Set(pending); pending.clear();
        try { await Promise.all(Object.values(watches).filter(w => cols.has(w.col)).map(run)); state.error = null; }
        catch (e) { state.error = message(e); }
        emit(); res();
      }, 30);
    });
  }
  function watch(key, col, field, value, apply) {
    if (!col) { delete watches[key]; return; }
    watches[key] = { col, field, value, apply };
    run(watches[key]).then(emit).catch(e => { state.error = message(e); emit(); });
  }
  const cur = { cliente: undefined };

  async function init() {
    if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseKey) { state.status = "config"; emit(); return; }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
    sb.auth.onAuthStateChange((ev, session) => {
      if (ev === "SIGNED_OUT") { user = null; state.user = null; state.status = "login"; state.clientes = null; state.cd = null; cur.cliente = undefined; emit(); }
    });
    const { data } = await sb.auth.getSession();
    if (!data.session) { state.status = "login"; emit(); return; }
    await entrou(data.session.user);
  }
  async function entrou(u) {
    user = u; state.user = { id: u.id, email: u.email };
    state.status = "ready"; emit();
    watch("clientes", "clientes", null, null, rows => { state.clientes = rows; });
    for (const c of ["tarefas", "financeiro", "recorrencias", "relatorios"]) watch("ag:" + c, c, null, null, rows => { (state.ag ||= {})[c] = rows; });
  }
  /** Mescla como o "update" do sistema anterior: objetos aninhados são mesclados; o resto é substituído. */
  function merge(base, patch) {
    const out = { ...(base || {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) out[k] = merge(out[k], v);
      else out[k] = v;
    }
    return out;
  }
  const now = () => new Date().toISOString();
  const strip = d => { const x = { ...d }; delete x.id; return x; };

  return {
    state, init, message,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get ready() { return state.status === "ready" && !!sb && !!user; },
    async login(email, senha) {
      const r = await sb.auth.signInWithPassword({ email, password: senha });
      if (r.error) throw r.error;
      await entrou(r.data.user);
    },
    async logout() { await sb.auth.signOut(); },
    /** Acompanha todos os dados de tráfego do cliente selecionado. */
    watchCliente(id) {
      if (!sb || id === cur.cliente) return;
      cur.cliente = id;
      state.cd = id ? Object.fromEntries(Domain.DEPENDENTES.map(c => [c, null])) : null;
      const cd = state.cd;
      for (const c of Domain.DEPENDENTES) watch("cd:" + c, id ? c : null, "clienteId", id, rows => { if (state.cd === cd) cd[c] = rows; });
    },
    async put(col, id, data) {
      const t = now();
      ok(await sb.from("docs").upsert({ owner: user.id, collection: col, id, data: strip({ ...data, criadoEm: data.criadoEm || t, atualizadoEm: t }), updated_at: t }, { onConflict: "owner,collection,id" }));
      await refresh(col);
    },
    async patch(col, id, data) {
      const atual = ok(await sb.from("docs").select("data").eq("collection", col).eq("id", id).maybeSingle());
      if (!atual) throw { message: "Registro não encontrado" };
      const t = now();
      ok(await sb.from("docs").update({ data: strip(merge(atual.data, { ...data, atualizadoEm: t })), updated_at: t }).eq("collection", col).eq("id", id));
      await refresh(col);
    },
    async remove(col, id) { ok(await sb.from("docs").delete().eq("collection", col).eq("id", id)); await refresh(col); },
    async get(col, id) { const r = ok(await sb.from("docs").select("id,data").eq("collection", col).eq("id", id).maybeSingle()); return r ? toDoc(r) : null; },
    async find(col, field, value) {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const page = ok(await sb.from("docs").select("id,data").eq("collection", col).eq(`data->>${field}`, String(value)).range(from, from + 999));
        rows.push(...page.map(toDoc)); if (page.length < 1000) break;
      }
      return rows;
    },
    async ensureRelatorio(id, data) {
      if (await this.get("relatorios", id)) return false;
      await this.put("relatorios", id, data); return true;
    },
    async removeAll(list) { for (const [col, id] of list) ok(await sb.from("docs").delete().eq("collection", col).eq("id", id)); await Promise.all([...new Set(list.map(x => x[0]))].map(refresh)); },
    async dependentes(clienteId) {
      const out = {};
      for (const c of Domain.DEPENDENTES) { const d = await this.find(c, "clienteId", clienteId); if (d.length) out[c] = d.length; }
      for (const c of ["financeiro", "recorrencias", "tarefas"]) { const d = await this.find(c, "clienteId", clienteId); if (d.length) out[c] = d.length; }
      return out;
    },
    async dumpAll() {
      const out = {};
      const cols = [...Domain.COLLECTIONS, "tarefas", "financeiro", "recorrencias"];
      for (const c of cols) {
        out[c] = [];
        for (let from = 0; ; from += 1000) {
          const page = ok(await sb.from("docs").select("id,data").eq("collection", c).range(from, from + 999));
          out[c].push(...page.map(toDoc)); if (page.length < 1000) break;
        }
      }
      return out;
    },
  };
})();

/** Downloads: arquivo gerado no navegador */
const Downloads = {
  async save(filename, data) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/.test(filename) ? "application/json" : /\.csv$/.test(filename) ? "text/csv;charset=utf-8" : "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { status: "saved" };
  },
};

const Prefs = {
  get(k) { try { return localStorage.getItem("gm." + k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem("gm." + k) : localStorage.setItem("gm." + k, v); } catch {} },
};
