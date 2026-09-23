import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const getToken = () => {
  const raw = String(window.location.hash || "").replace(/^#/, "");
  try { return new URLSearchParams(raw).get("token") || ""; } catch { return ""; }
};
const token = getToken();
const headers = { "Content-Type": "application/json", "x-panel-token": token };

async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Server xatosi");
  return data;
}

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("uz-UZ", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tashkent",
    }).format(new Date(value));
  } catch { return String(value); }
}
function statusLabel(status) {
  return ({ scheduled: "Rejalashtirilgan", running: "Jarayonda", finished: "Tugagan", closed: "Yopilgan" })[status] || status || "Noma'lum";
}
function statusTone(status) {
  return ({ scheduled: "blue", running: "green", finished: "gray", closed: "red" })[status] || "gray";
}
function humanSetting(key) {
  const labels = {
    bot_messages_enabled: "Bot xabarlarini yoqish",
    user_messages_enabled: "Foydalanuvchi xabarlarini qabul qilish",
    duplicate_protection_enabled: "Takroriy qatnashuvni himoyalash",
    cleanup_group_messages: "Keraksiz guruh xabarlarini tozalash",
    auto_start_enabled: "Avtomatik boshlash",
    auto_finish_enabled: "Avtomatik yakunlash",
    reminders_enabled: "Eslatmalar",
    reminder_15m: "15 daqiqa oldin eslatma",
    reminder_5m: "5 daqiqa oldin eslatma",
    reminder_2m: "2 daqiqa oldin eslatma",
    winner_announcement_enabled: "G‘olib e'lonini yuborish",
    winner_image_enabled: "G‘olib rasmi",
    winner_qr_enabled: "G‘olib QR kodi",
    winner_signature_enabled: "G‘olib imzosi",
    winner_stamp_enabled: "G‘olib muhri",
    participant_realtime_enabled: "Participant realtime",
    viewer_realtime_enabled: "Viewer realtime",
    audit_logging_enabled: "Audit log",
    panel_single_message: "Panelda ixcham xabarlar",
    search_enabled: "Qidiruv",
    statistics_enabled: "Statistika",
    bot_messages_delay_minutes: "Bot xabari kechikishi (daqiqa)",
    user_messages_delay_minutes: "Foydalanuvchi xabari kechikishi (daqiqa)",
    admin_session_timeout_minutes: "Admin sessiyasi (daqiqa)",
    token_expiry_days: "Token amal qilish muddati (kun)",
  };
  return labels[key] || key.replaceAll("_", " ");
}

function App() {
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async (gid) => {
    if (!token) return;
    setBusy(true); setError("");
    try {
      const [dashboard, settingData, groupData] = await Promise.all([
        api("/api/admin-dashboard" + (gid ? "?gid=" + encodeURIComponent(gid) : "")),
        api("/api/settings"),
        api("/api/groups" + (gid ? "?gid=" + encodeURIComponent(gid) : "")),
      ]);
      setData(dashboard);
      setSettings(settingData.settings || {});
      setGroups(groupData.chats || []);
      const next = gid || selected || dashboard.giveaways?.[0]?.id;
      if (next) setSelected(next);
      setSelectedGroups((groupData.selected || []).filter(x => x.role === "post").map(x => Number(x.chat_id)));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }, [selected]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const current = useMemo(
    () => data?.giveaways?.find(g => Number(g.id) === Number(selected)) || null,
    [data, selected]
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.giveaways || [];
    return (data?.giveaways || []).filter(g =>
      String(g.title || "").toLowerCase().includes(q) ||
      String(g.id).includes(q) ||
      statusLabel(g.status).toLowerCase().includes(q)
    );
  }, [data, search]);

  async function action(actionName, giveawayId) {
    const question = actionName === "start"
      ? "Giveawayni boshlashni tasdiqlaysizmi?"
      : "Rejalashtirilgan giveawayni yopishni tasdiqlaysizmi?";
    if (!window.confirm(question)) return;
    setBusy(true); setError("");
    try {
      await api("/api/admin-dashboard", {
        method: "POST",
        body: JSON.stringify({ action: actionName, giveaway_id: giveawayId }),
      });
      setNotice(actionName === "start" ? "Giveaway boshlandi." : "Giveaway yopildi.");
      await load(giveawayId);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function assignGroups(giveawayId, chatIds) {
    setBusy(true); setError("");
    try {
      await api("/api/admin-dashboard", {
        method: "POST",
        body: JSON.stringify({ action: "assign_groups", giveaway_id: giveawayId, chat_ids: chatIds }),
      });
      setSelectedGroups(chatIds);
      setNotice("Giveaway guruhlari saqlandi.");
      await load(giveawayId);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function postToGroups(giveawayId) {
    if (!window.confirm("Giveaway tanlangan guruhlarga yuborilsinmi?")) return;
    setBusy(true); setError("");
    try {
      const result = await api("/api/groups", {
        method: "POST",
        body: JSON.stringify({ action: "post", giveaway_id: giveawayId }),
      });
      const ok = (result.results || []).filter(x => x.ok).length;
      const failed = (result.results || []).filter(x => !x.ok).length;
      setNotice("Guruhlarga yuborildi: " + ok + (failed ? " · xato: " + failed : ""));
      await load(giveawayId);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function updateSetting(key, value) {
    const previous = settings?.[key];
    setSettings(old => ({ ...old, [key]: value }));
    try {
      const result = await api("/api/settings", {
        method: "POST", body: JSON.stringify({ [key]: value }),
      });
      setSettings(result.settings || {});
      setNotice("Sozlama saqlandi.");
    } catch (e) {
      setSettings(old => ({ ...old, [key]: previous }));
      setError(e.message);
    }
  }

  async function cleanup() {
    if (!window.confirm("Cleanup ishga tushirilsinmi? Telegramdagi navbatdagi xabarlar o‘chiriladi.")) return;
    setBusy(true); setError("");
    try {
      const result = await api("/api/settings", {
        method: "POST", body: JSON.stringify({ action: "cleanup_now" }),
      });
      setNotice("Tozalandi: " + (result.cleanup?.deleted ?? 0) + ", xato: " + (result.cleanup?.failed ?? 0));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (!token) return <Gate text="Panel sessiyasi topilmadi yoki havola noto‘g‘ri." />;

  const nav = [
    ["dashboard", "⌂", "Boshqaruv"],
    ["giveaways", "◉", "Giveawaylar"],
    ["create", "+", "Yangi giveaway"],
    ["groups", "▦", "Guruhlar"],
    ["settings", "⚙", "Sozlamalar"],
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">R</div>
          <div><b>RAMZ ESTET</b><span>ADMIN PANEL</span></div>
        </div>
        <nav>
          {nav.map(([key, icon, label]) => (
            <button key={key} className={tab === key ? "nav-item active" : "nav-item"} onClick={() => setTab(key)}>
              <i>{icon}</i><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="secure"><span className="dot" /> Himoyalangan panel</div>
          <button className="logout" onClick={() => { window.location.hash = ""; window.location.reload(); }}>Sessiyani yopish</button>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <div>
            <div className="eyebrow">RAMZ ESTET / {nav.find(n => n[0] === tab)?.[2]}</div>
            <h1>{tab === "dashboard" ? "Boshqaruv markazi" : nav.find(n => n[0] === tab)?.[2]}</h1>
          </div>
          <div className="header-actions">
            <span className="live"><span className="dot" /> Online</span>
            <button className="refresh" onClick={() => load(selected)} disabled={busy}>↻ <span>Yangilash</span></button>
          </div>
        </header>

        {error && <div className="alert error"><b>⚠</b><span>{error}</span><button onClick={() => setError("")}>×</button></div>}
        {notice && <div className="alert success"><b>✓</b><span>{notice}</span></div>}

        <main className="content">
          {tab === "dashboard" && <Dashboard data={data} onSelect={(id) => { setSelected(id); setTab("giveaways"); load(id); }} />}
          {tab === "giveaways" && (
            <Giveaways data={data} items={filtered} search={search} setSearch={setSearch}
              selected={selected} current={current}
              onSelect={(id) => { setSelected(id); load(id); }}
              onAction={action}
              groups={groups}
              selectedGroups={selectedGroups}
              onAssignGroups={assignGroups}
              onPost={postToGroups} />
          )}
          {tab === "create" && <CreateGiveaway groups={groups} onCreated={async id => { await load(id); setSelected(id); setTab("giveaways"); setNotice("Giveaway muvaffaqiyatli yaratildi."); }} />}
          {tab === "groups" && <GroupManager groups={groups} onChanged={() => load(selected)} />}
          {tab === "settings" && <Settings settings={settings} onChange={updateSetting} onCleanup={cleanup} />}
        </main>
      </div>
    </div>
  );
}

function Gate({ text }) {
  return <div className="gate"><div className="gate-card"><div className="logo-mark">R</div><b>RAMZ ESTET</b><span>{text}</span></div></div>;
}

function Dashboard({ data, onSelect }) {
  const s = data?.stats || {};
  const cards = [
    ["Jami giveaway", s.total ?? "—", "Barcha yaratilinganlar", "purple"],
    ["Rejalashtirilgan", s.scheduled ?? "—", "Boshlanishni kutmoqda", "blue"],
    ["Jarayonda", s.running ?? "—", "Hozir ishlayapti", "green"],
    ["Tugagan", s.finished ?? "—", "Yakunlangan", "gray"],
  ];
  return (
    <>
      <div className="hero">
        <div><span className="hero-kicker">NAZORAT PANELI</span><h2>Barcha giveawaylar bir joyda.</h2><p>Holat, qatnashchilar, g‘oliblar va avtomatlashtirishni tez boshqaring.</p></div>
        <button className="hero-button" onClick={() => onSelect(data?.giveaways?.[0]?.id)} disabled={!data?.giveaways?.length}>Oxirgi giveaway →</button>
      </div>
      <div className="stat-grid">
        {cards.map(([label, value, hint, tone]) => <div className={`metric ${tone}`} key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>)}
      </div>
      <div className="section-head"><div><h2>So‘nggi giveawaylar</h2><p>Eng oxirgi 8 ta faoliyat</p></div></div>
      <div className="card table-card">
        {(data?.giveaways || []).slice(0, 8).map(g => (
          <button className="table-row" key={g.id} onClick={() => onSelect(g.id)}>
            <span className="title-cell"><span className="avatar">{String(g.title || "G").slice(0,1).toUpperCase()}</span><span><b>{g.title}</b><small>#{g.id} · {fmtDate(g.created_at)}</small></span></span>
            <span className={`status ${statusTone(g.status)}`}>{statusLabel(g.status)}</span>
            <span className="count"><b>{g.participant_count}</b><small>qatnashchi</small></span>
            <span className="arrow">→</span>
          </button>
        ))}
        {!data?.giveaways?.length && <Empty text="Hozircha giveaway yo‘q." />}
      </div>
    </>
  );
}

function Giveaways({ data, items, search, setSearch, selected, current, onSelect, onAction, groups, selectedGroups, onAssignGroups, onPost }) {
  return (
    <>
      <div className="toolbar">
        <div><h2>Barcha giveawaylar</h2><p>{data?.giveaways?.length || 0} ta giveaway</p></div>
        <div className="search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, ID yoki holat..." /></div>
      </div>
      <div className="giveaway-layout">
        <div className="card giveaway-list">
          {items.map(g => (
            <button key={g.id} onClick={() => onSelect(g.id)} className={Number(selected) === Number(g.id) ? "giveaway-item selected" : "giveaway-item"}>
              <span className="avatar">{String(g.title || "G").slice(0,1).toUpperCase()}</span>
              <span className="gi-main"><b>{g.title}</b><small>#{g.id} · {statusLabel(g.status)}</small></span>
              <span className="gi-count"><b>{g.participant_count}</b><small>qatnashchi</small></span>
            </button>
          ))}
          {!items.length && <Empty text="Qidiruv bo‘yicha giveaway topilmadi." />}
        </div>
        <GiveawayDetail current={current} detail={data?.detail} onAction={onAction} groups={groups} selectedGroups={selectedGroups} onAssignGroups={onAssignGroups} onPost={onPost} />
      </div>
    </>
  );
}

function GiveawayDetail({ current, detail, onAction, groups, selectedGroups, onAssignGroups, onPost }) {
  if (!current) return <div className="card detail-empty"><div className="empty-icon">◉</div><h3>Giveaway tanlang</h3><p>Chap tomondagi ro‘yxatdan giveawayni tanlang.</p></div>;
  return (
    <div className="detail">
      <div className="card detail-card">
        <div className="detail-top">
          <div><span className={"status " + statusTone(current.status)}>{statusLabel(current.status)}</span><h2>{current.title}</h2><p>{current.description || "Tavsif kiritilmagan."}</p></div>
          <div className="detail-id">ID #{current.id}</div>
        </div>
        <div className="detail-metrics">
          <Mini label="Qatnashchi" value={current.participant_count} />
          <Mini label="G‘olib" value={current.winner_count} />
          <Mini label="Hozirgi viewer" value={current.viewer_count} />
          <Mini label="Raund" value={current.total_rounds} />
        </div>
        <div className="info-grid">
          <Info label="Boshlanish" value={fmtDate(current.start_at)} />
          <Info label="Yaratilgan" value={fmtDate(current.created_at)} />
          <Info label="Boshlangan" value={fmtDate(current.started_at)} />
          <Info label="Yakunlangan" value={fmtDate(current.finished_at)} />
        </div>
        <div className="action-bar">
          <div><b>Amallar</b><small>Giveaway holatini boshqarish</small></div>
          <div className="action-buttons">
            <button className="btn primary" disabled={current.status !== "scheduled"} onClick={() => onAction("start", current.id)}>▶ Boshlash</button>
            <button className="btn danger" disabled={current.status !== "scheduled"} onClick={() => onAction("close", current.id)}>× Yopish</button>
          </div>
        </div>
      </div>

      <GroupPicker
        giveawayId={current.id}
        groups={groups}
        selectedGroups={selectedGroups}
        onSave={onAssignGroups}
        onPost={() => onPost(current.id)}
      />

      <div className="card detail-card">
        <div className="card-title"><div><h3>Qatnashchilar</h3><p>Ushbu giveawayga tegishli foydalanuvchilar</p></div><b className="pill">{detail?.participants?.length || 0}</b></div>
        <div className="scroll-list participants">
          {(detail?.participants || []).map(p => <div className="person" key={String(p.user_id)}><span className="avatar small">{String(p.first_name || p.username || "U").slice(0,1).toUpperCase()}</span><span><b>{p.username ? "@" + p.username : p.first_name || "Foydalanuvchi"}</b><small>ID: {p.user_id}</small></span><time>{fmtDate(p.joined_at)}</time></div>)}
          {!detail?.participants?.length && <Empty text="Hozircha qatnashchi yo‘q." />}
        </div>
      </div>
      <div className="card detail-card">
        <div className="card-title"><div><h3>G‘oliblar</h3><p>Raundlar bo‘yicha tanlangan g‘oliblar</p></div><b className="pill">{detail?.winners?.length || 0}</b></div>
        <div className="scroll-list winners">
          {(detail?.winners || []).map(w => <div className="person" key={String(w.round)}><span className="winner-badge">#{w.round}</span><span><b>{w.username ? "@" + w.username : w.first_name || w.user_id}</b><small>{w.winner_label || "G‘olib"} · ID {w.user_id}</small></span><time>{fmtDate(w.won_at)}</time></div>)}
          {!detail?.winners?.length && <Empty text="Hali g‘oliblar yo‘q." />}
        </div>
      </div>
    </div>
  );
}

function GroupPicker({ giveawayId, groups, selectedGroups, onSave, onPost }) {
  const [picked, setPicked] = useState(selectedGroups || []);
  useEffect(() => setPicked(selectedGroups || []), [selectedGroups]);
  const toggle = id => setPicked(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  return (
    <div className="card detail-card">
      <div className="card-title">
        <div><h3>Telegram guruhlari</h3><p>Giveaway postini qaysi guruhlarga yuborishni tanlang.</p></div>
        <b className="pill">{picked.length}</b>
      </div>
      <div className="group-check-list">
        {groups.map(g => (
          <label className="group-check" key={String(g.chat_id)}>
            <input type="checkbox" checked={picked.includes(Number(g.chat_id))} onChange={() => toggle(Number(g.chat_id))} />
            <span className="group-icon">▦</span>
            <span><b>{g.title}</b><small>{g.username ? "@" + g.username + " · " : ""}{g.chat_id}</small></span>
            <em>{g.bot_status === "administrator" || g.bot_status === "creator" ? "BOT ADMIN" : "Tekshirish kerak"}</em>
          </label>
        ))}
        {!groups.length && <Empty text="Hali guruh qo‘shilmagan. Avval “Guruhlar” bo‘limidan guruh qo‘shing." />}
      </div>
      <div className="action-bar">
        <div><b>Post boshqaruvi</b><small>Tanlangan guruhlarga giveaway postini yuborish mumkin.</small></div>
        <div className="action-buttons">
          <button className="btn" onClick={() => onSave(giveawayId, picked)}>💾 Saqlash</button>
          <button className="btn primary" disabled={!picked.length} onClick={onPost}>📣 Guruhlarga yuborish</button>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }) { return <div><span>{label}</span><b>{value ?? "—"}</b></div>; }
function Info({ label, value }) { return <div><span>{label}</span><b>{value}</b></div>; }

function CreateGiveaway({ onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", total_rounds: 1, start_at: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const set = (key, value) => setForm(old => ({ ...old, [key]: value }));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api("/api/admin-dashboard", { method: "POST", body: JSON.stringify({ action: "create", ...form, total_rounds: Number(form.total_rounds) }) });
      await onCreated(result.id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="create-page">
      <div className="form-intro"><span className="hero-kicker">YANGI KAMPANIYA</span><h2>Giveaway yarating</h2><p>Ma'lumotlarni kiriting. Yaratilgach giveaway rejalashtirilgan holatda turadi.</p></div>
      <form className="card form-card" onSubmit={submit}>
        {error && <div className="alert error"><b>⚠</b>{error}</div>}
        <Field label="Giveaway nomi" hint="Telegramda ko‘rinadigan nom"><input value={form.title} onChange={e => set("title", e.target.value)} maxLength={160} placeholder="Masalan: RAMZ ESTET — Yangi yil" required /></Field>
        <Field label="Tavsif" hint="Ixtiyoriy"><textarea value={form.description} onChange={e => set("description", e.target.value)} maxLength={3000} rows={5} placeholder="Giveaway haqida qisqa ma'lumot..." /></Field>
        <div className="form-grid">
          <Field label="G‘oliblar soni" hint="1–100"><input type="number" min="1" max="100" value={form.total_rounds} onChange={e => set("total_rounds", e.target.value)} required /></Field>
          <Field label="Boshlanish vaqti" hint="Toshkent vaqti"><input type="datetime-local" value={form.start_at} onChange={e => set("start_at", e.target.value)} required /></Field>
        </div>
        <div className="form-footer"><span>Keyin giveawaylar bo‘limidan boshqarishingiz mumkin.</span><button className="btn primary large" disabled={busy}>{busy ? "Yaratilmoqda..." : "✓ Giveaway yaratish"}</button></div>
      </form>
    </div>
  );
}
function Field({ label, hint, children }) { return <label className="field"><span><b>{label}</b><small>{hint}</small></span>{children}</label>; }

const boolGroups = [
  ["Bot va chat", ["bot_messages_enabled","user_messages_enabled","duplicate_protection_enabled","cleanup_group_messages"]],
  ["Avtomatlashtirish", ["auto_start_enabled","auto_finish_enabled","reminders_enabled","reminder_15m","reminder_5m","reminder_2m"]],
  ["G‘olib", ["winner_announcement_enabled","winner_image_enabled","winner_qr_enabled","winner_signature_enabled","winner_stamp_enabled"]],
  ["Realtime va audit", ["participant_realtime_enabled","viewer_realtime_enabled","audit_logging_enabled"]],
  ["Panel", ["panel_single_message","search_enabled","statistics_enabled"]],
];
const intKeys = ["bot_messages_delay_minutes","user_messages_delay_minutes","admin_session_timeout_minutes","token_expiry_days"];

function Settings({ settings, onChange, onCleanup }) {
  if (!settings) return <Empty text="Sozlamalar yuklanmoqda..." />;
  return (
    <>
      <div className="settings-head"><div><h2>Tizim sozlamalari</h2><p>Bot, avtomatlashtirish, g‘oliblar va panel xatti-harakatini boshqaring.</p></div><span className="settings-ok">✓ Saqlash avtomatik</span></div>
      <div className="settings-grid">
        <div>
          {boolGroups.map(([title, keys]) => <div className="card settings-card" key={title}><div className="card-title"><div><h3>{title}</h3><p>Kerakli funksiyalarni yoqing yoki o‘chiring.</p></div></div>{keys.map(key => <Toggle key={key} label={humanSetting(key)} checked={Boolean(settings[key])} onChange={v => onChange(key, v)} />)}</div>)}
        </div>
        <div>
          <div className="card settings-card"><div className="card-title"><div><h3>Vaqt va limitlar</h3><p>Avtomatlashtirish parametrlari.</p></div></div>{intKeys.map(key => <NumberSetting key={key} label={humanSetting(key)} value={settings[key] ?? ""} onChange={v => onChange(key, Number(v))} />)}</div>
          <div className="card maintenance"><span className="warning-icon">⚠</span><div><h3>Texnik xizmat</h3><p>Navbatda qolgan Telegram xabarlarini hozir tozalaydi.</p><button className="btn danger" onClick={onCleanup}>Cleanup now</button></div></div>
        </div>
      </div>
    </>
  );
}
function Toggle({ label, checked, onChange }) { return <label className="toggle"><span><b>{label}</b><small>{checked ? "Yoqilgan" : "O‘chirilgan"}</small></span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><i /></label>; }
function NumberSetting({ label, value, onChange }) { return <label className="number-setting"><span>{label}</span><input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} /></label>; }

function Empty({ text = "Ma'lumot yo‘q." }) { return <div className="empty"><div className="empty-icon">◌</div><span>{text}</span></div>; }

createRoot(document.getElementById("root")).render(<App />);
