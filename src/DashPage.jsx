import React from 'react';
import { fmtNum, fmtDate } from './utils';
import { Prog } from './CustomComponents';
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, PieChart, Pie, Cell } from 'recharts';

const WEATHER_CITY = "Kodaikanal";

const DashPage = ({ td, dayNum, workers, attendance, schedule, plants, customers, defects, weather, weatherLoading }) => {
  const active = workers.filter(w => w.active);
  const todayPresent = active.filter(w => attendance[`${td}_${w.id}`] === "present").length;
  const todaySched = schedule.find(s => s.date === td) || null;
  const totalBoxes = customers.reduce((a, c) => a + c.orders.reduce((b, o) => b + (o.boxes || 0), 0), 0);
  const totalRev = totalBoxes * 120;
  const issueCount = plants.filter(p => p.defect).length;
  const redFruits = plants.reduce((a, p) => a + (p.redFruits || 0), 0);
  const newDef = defects.filter(d => !d.seen).length;

  // Real yield data from your plants (in grams, converted to kg)
  const totalYieldGrams = plants.reduce((sum, p) => sum + (p.yieldGrams || 0), 0);
  const totalYieldKg = Math.round(totalYieldGrams / 1000);
  const yieldData = [{ w: "Total", kg: totalYieldKg }];

  const pieData = [
    { name: "Healthy", value: plants.filter(p => !p.defect).length, fill: "var(--primary)" },
    { name: "Issues", value: issueCount, fill: "#ea4335" },
    { name: "Flowering", value: plants.filter(p => p.flowers > 3).length, fill: "#fbbc04" },
  ];
  const custByBoxes = [...customers].sort((a, b) => b.orders.reduce((x, o) => x + o.boxes, 0) - a.orders.reduce((x, o) => x + o.boxes, 0));

  return (
    <div>
      {newDef > 0 && <div className="alert a-err mb16">🚨 <strong>{newDef} புதிய field report</strong> வந்துள்ளது. Worker Reports பார்க்கவும்.</div>}

      <div className="stat-grid mb20">
        <div className="stat-card sc-primary"><div className="stat-ico">👷</div><div className="stat-num">{active.length}</div><div className="stat-lbl">Active Workers</div><div className="stat-sub">இன்று: {todayPresent} present</div></div>
        <div className="stat-card sc-secondary"><div className="stat-ico">🌱</div><div className="stat-num">10,000</div><div className="stat-lbl">Total Plants</div><div className="stat-sub">Day {dayNum} · {issueCount} issues</div></div>
        <div className="stat-card sc-warning"><div className="stat-ico">🍓</div><div className="stat-num">{redFruits}</div><div className="stat-lbl">Ready to Harvest</div><div className="stat-sub">Sample: {plants.length} plants</div></div>
        <div className="stat-card sc-success"><div className="stat-ico">📦</div><div className="stat-num">{totalBoxes}</div><div className="stat-lbl">Total Boxes Sold</div><div className="stat-sub">₹{fmtNum(totalRev)} revenue</div></div>
      </div>

      <div className="g2 mb20">
        <div className="card">
          <div className="card-title">📈 Total Yield (kg)</div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={yieldData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs><linearGradient id="yg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
              <XAxis dataKey="w" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="kg" name="Yield (kg)" stroke="var(--primary)" fill="url(#yg)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-title">🌿 Plant Health – {plants.length} Sample</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ResponsiveContainer width={150} height={150}>
              <PieChart>
                <Pie data={pieData} cx={70} cy={70} innerRadius={42} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {pieData.map(h => (
                <div key={h.name} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{h.name}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{h.value}</span>
                  </div>
                  <Prog pct={plants.length ? h.value / plants.length * 100 : 0} color={h.fill} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="g3 mb20">
        <div className="card">
          <div className="card-title">📋 இன்றைய அட்டவணை</div>
          {todaySched ? (
            <div>
              {[["💧 சொட்டு நீர்", todaySched.drip], ["🌿 தெளிப்பு", todaySched.spray === "ஏதுமில்லை" ? "—" : todaySched.spray], ["🌾 களப்பணி", todaySched.field]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 9 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: "7px 10px", borderRadius: 6, background: todaySched.done ? "var(--primary-pale)" : "var(--warning-pale)", fontSize: 12, fontWeight: 700, color: todaySched.done ? "var(--primary)" : "#92400e" }}>
                {todaySched.done ? "✅ முடிந்தது" : "⏳ நிலுவை"}
              </div>
            </div>
          ) : <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>இன்றைய அட்டவணை இல்லை</div>}
        </div>

        <div className="card">
          <div className="card-title">👷 இன்றைய Workers</div>
          <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
            {[["Present", todayPresent, "var(--primary)"], ["Absent", active.length - todayPresent, "#ea4335"], ["Total", active.length, "var(--muted)"]].map(([l, v, c]) => (
              <div key={l} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{l}</div>
              </div>
            ))}
          </div>
          <Prog pct={active.length ? todayPresent / active.length * 100 : 0} color="var(--primary)" />
          <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "right", marginTop: 3, marginBottom: 8 }}>{active.length ? Math.round(todayPresent / active.length * 100) : 0}% attendance</div>
          {active.slice(0, 3).map(w => (
            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 8px", background: "var(--bg-light)", borderRadius: 6 }}>
              <div className={`wk-av ${w.gender === "male" ? "wk-m" : "wk-f"}`} style={{ width: 28, height: 28, fontSize: 12 }}>{(w.name || "?")[0]}</div>
              <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{w.name}</span>
              <span className={`badge ${attendance[`${td}_${w.id}`] === "present" ? "bg-primary" : "bg-red"}`}>{attendance[`${td}_${w.id}`] === "present" ? "✓" : "✗"}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">🛒 Top Customers</div>
          {custByBoxes.slice(0, 4).map(c => {
            const total = c.orders.reduce((a, o) => a + (o.boxes || 0), 0);
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>{c.type === "premium" ? "⭐" : "📦"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <Prog pct={custByBoxes[0] ? total / custByBoxes[0].orders.reduce((a, o) => a + o.boxes, 0) * 100 : 0} color={c.type === "premium" ? "var(--warning)" : "var(--primary)"} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dark)", flex: "0 0 auto" }}>{total}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--primary-pale)", borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Total Revenue</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)" }}>₹{fmtNum(totalRev)}</div>
          </div>
        </div>
      </div>

      {weather && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">🌤️ Weather – {WEATHER_CITY}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={weather.icon} alt="weather" style={{ width: "48px", height: "48px" }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-dark)" }}>{Math.round(weather.temp)}°C</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Feels like {Math.round(weather.feels_like)}°C</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div><div style={{ fontSize: 11, color: "var(--muted)" }}>Humidity</div><div style={{ fontSize: 14, fontWeight: 600 }}>{weather.humidity}%</div></div>
              <div><div style={{ fontSize: 11, color: "var(--muted)" }}>Wind</div><div style={{ fontSize: 14, fontWeight: 600 }}>{weather.wind} m/s</div></div>
              <div><div style={{ fontSize: 11, color: "var(--muted)" }}>Condition</div><div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{weather.description}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashPage;
