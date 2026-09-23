import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const getToken = () => {
  const raw = String(window.location.hash || "").replace(/^#/, "");
  try {
    return new URLSearchParams(raw).get("token") || "";
  } catch {
    return "";
  }
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
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Tashkent",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function App() {
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (gid) => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const [dashboard, settingData] = await Promise.all([
        api("/api/admin-dashboard" + (gid ? "?gid=" + encodeURIComponent(gid) : "")),
        api("/api/settings"),
      ]);
      setData(dashboard);
      setSettings(settingData.settings || {});
      if (gid) setSelected(gid);
      else if (!selected && dashboard.giveaways?.[0]) setSelected(dashboard.giveaways[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const current = useMemo(
    () => data?.giveaways?.find((g) => Number(g.id) === Number(selected)) || null,
    [data, selected]
  );

  async function action(action, giveawayId) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin-dashboard", {
        method: "POST",
        body: JSON.stringify({ action, giveaway_id: giveawayId }),
      });
      await load(giveawayId);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateSetting(key, value) {
    setSettings((old) => ({ ...old, [key]: value }));
    try {
      const result = await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({ [key]: value }),
      });
      setSettings(result.settings || {});
    } catch (e) {
      setError(e.message);
      await load(selected);
    }
  }

  async function cleanup() {
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({ action: "cleanup_now" }),
      });
      alert("Tozalash: " + JSON.stringify(result.cleanup));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <Gate text="Kirish ruxsati kerak." />;
  }

  const tabs = [
    ["dashboard", "Umumiy"],
    ["giveaways", "Giveawaylar"],
    ["create", "Yaratish"],
    ["settings", "Sozlamalar"],
  ];

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <div className="brand">RAMZ ESTET</div>
          <div className="muted">Web Admin · React</div>
        </div>
        <button className="ghost" onClick={() => load(selected)} disabled={busy}>
          {busy ? "Yuklanmoqda..." : "↻ Yangilash"}
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <nav className="tabs">
        {tabs.map(([key, label]) => (
          <button key={key} className={tab === key ? "tab active" : "tab"} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === "dashboard" && (
          <Dashboard data={data} onSelect={(id) => { setSelected(id); setTab("giveaways"); load(id); }} />
        )}

        {tab === "giveaways" && (
          <Giveaways
            data={data}
            selected={selected}
            current={current}
            onSelect={(id) => { setSelected(id); load(id); }}
            onAction={action}
          />
        )}

        {tab === "create" && (
          <CreateGiveaway
            onCreated={async (id) => {
              await load(id);
              setSelected(id);
              setTab("giveaways");
            }}
          />
        )}

        {tab === "settings" && (
          <Settings settings={settings} onChange={updateSetting} onCleanup={cleanup} />
        )}
      </main>
    </div>
  );
}

function Gate({ text }) {
  return <div className="gate"><div className="gate-card"><b>RAMZ ESTET</b><span>{text}</span></div></div>;
}

function Dashboard({ data, onSelect }) {
  const stats = data?.stats || {};
  return (
    <section>
      <h1>Umumiy</h1>
      <div className="stats">
        <Stat label="Jami" value={stats.total ?? "—"} />
        <Stat label="Rejalashtirilgan" value={stats.scheduled ?? "—"} />
        <Stat label="Jarayonda" value={stats.running ?? "—"} />
        <Stat label="Tugagan" value={stats.finished ?? "—"} />
      </div>
      <div className="panel">
        <h2>Oxirgi giveawaylar</h2>
        {(data?.giveaways || []).slice(0, 8).map((g) => (
          <button className="row" key={g.id} onClick={() => onSelect(g.id)}>
            <span><b>{g.title}</b><small>{fmtDate(g.start_at)}</small></span>
            <span className="right"><b>{g.participant_count}</b><small>{g.status}</small></span>
          </button>
        ))}
        {!data?.giveaways?.length && <Empty />}
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;
}

function Giveaways({ data, selected, current, onSelect, onAction }) {
  return (
    <section>
      <h1>Giveawaylar</h1>
      <div className="layout">
        <div className="panel list">
          {(data?.giveaways || []).map((g) => (
            <button className={Number(selected) === Number(g.id) ? "row selected" : "row"} key={g.id} onClick={() => onSelect(g.id)}>
              <span><b>{g.title}</b><small>#{g.id} · {g.status}</small></span>
              <span className="right"><b>{g.participant_count}</b><small>qatnashchi</small></span>
            </button>
          ))}
          {!data?.giveaways?.length && <Empty />}
        </div>
        <div className="panel detail">
          {current ? (
            <>
              <div className="detail-head">
                <div><h2>{current.title}</h2><p>{current.description || "Tavsif yo‘q"}</p></div>
                <span className="badge">{current.status}</span>
              </div>
              <div className="mini-stats">
                <Stat label="Qatnashchi" value={current.participant_count} />
                <Stat label="G‘olib" value={current.winner_count} />
                <Stat label="Kuzatuvchi" value={current.viewer_count} />
                <Stat label="Raund" value={current.total_rounds} />
              </div>
              <p className="muted">Boshlanishi: {fmtDate(current.start_at)}</p>
              <div className="actions">
                <button className="primary" disabled={current.status !== "scheduled"} onClick={() => onAction("start", current.id)}>▶ Boshlash</button>
                <button className="danger" disabled={current.status !== "scheduled"} onClick={() => onAction("close", current.id)}>Yopish</button>
              </div>
              <Participants detail={data?.detail} />
            </>
          ) : <Empty text="Giveaway tanlang." />}
        </div>
      </div>
    </section>
  );
}

function Participants({ detail }) {
  return (
    <div className="panel inner">
      <h3>Qatnashchilar ({detail?.participants?.length || 0})</h3>
      <div className="participants">
        {(detail?.participants || []).map((p) => (
          <div className="participant" key={String(p.user_id)}>
            <span>{p.username ? "@" + p.username : (p.first_name || p.user_id)}</span>
            <small>{fmtDate(p.joined_at)}</small>
          </div>
        ))}
        {!detail?.participants?.length && <Empty text="Hozircha qatnashchi yo‘q." />}
      </div>
    </div>
  );
}

function CreateGiveaway({ onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", total_rounds: 1, start_at: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function set(key, value) { setForm((old) => ({ ...old, [key]: value })); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/admin-dashboard", {
        method: "POST",
        body: JSON.stringify({ action: "create", ...form, total_rounds: Number(form.total_rounds) }),
      });
      await onCreated(result.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Giveaway yaratish</h1>
      <form className="panel form" onSubmit={submit}>
        {error && <div className="error">{error}</div>}
        <label>Nomi<input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={160} required /></label>
        <label>Tavsif<textarea value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={3000} rows={5} /></label>
        <label>G‘oliblar soni<input type="number" min="1" max="100" value={form.total_rounds} onChange={(e) => set("total_rounds", e.target.value)} required /></label>
        <label>Toshkent vaqti<input type="datetime-local" value={form.start_at} onChange={(e) => set("start_at", e.target.value)} required /></label>
        <button className="primary" disabled={busy}>{busy ? "Yaratilmoqda..." : "Giveaway yaratish"}</button>
      </form>
    </section>
  );
}

const groups = [
  ["Bot va chat", ["bot_messages_enabled", "user_messages_enabled", "duplicate_protection_enabled", "cleanup_group_messages"]],
  ["Avtomatlashtirish", ["auto_start_enabled", "auto_finish_enabled", "reminders_enabled", "reminder_15m", "reminder_5m", "reminder_2m"]],
  ["G‘olib", ["winner_announcement_enabled", "winner_image_enabled", "winner_qr_enabled", "winner_signature_enabled", "winner_stamp_enabled"]],
  ["Realtime va himoya", ["participant_realtime_enabled", "viewer_realtime_enabled", "audit_logging_enabled"]],
  ["Admin UX", ["panel_single_message", "search_enabled", "statistics_enabled"]],
];

function Settings({ settings, onChange, onCleanup }) {
  if (!settings) return <section><h1>Sozlamalar</h1><Empty text="Yuklanmoqda..." /></section>;
  return (
    <section>
      <h1>Admin sozlamalari</h1>
      {groups.map(([title, keys]) => (
        <div className="panel settings" key={title}>
          <h2>{title}</h2>
          {keys.map((key) => (
            <label className="toggle-row" key={key}>
              <span>{key.replaceAll("_", " ")}</span>
              <input type="checkbox" checked={Boolean(settings[key])} onChange={(e) => onChange(key, e.target.checked)} />
            </label>
          ))}
        </div>
      ))}
      <div className="panel">
        <h2>Texnik xizmat</h2>
        <p className="muted">Navbatdagi Telegram xabarlarini tozalash.</p>
        <button className="danger" onClick={onCleanup}>Cleanup now</button>
      </div>
    </section>
  );
}

function Empty({ text = "Ma’lumot yo‘q." }) {
  return <div className="empty">{text}</div>;
}

createRoot(document.getElementById("root")).render(<App />);
