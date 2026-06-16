import { callGemini } from './gemini';
import React, { useState, useEffect, useRef } from 'react';
import * as Recharts from 'recharts';
import './styles.css';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "./firebase";
import CryptoJS from 'crypto-js';

import Modal, { Prog, Confirm, AiDots, Ring } from './CustomComponents';
import { today, fmtDate, fmtNum } from './utils';

import FieldsPage from './FieldsPage';
import CropPage from './CropPage';
import WorkersPage from './WorkersPage';
import AttPage from './AttPage';
import SchedPage from './SchedPage';
import FertPage from './FertPage';
import ReportsPage from './ReportsPage';
import CustPage from './CustPage';
import AdminPage from './AdminPage';
import BillPage from './BillPage';
import DashPage from './DashPage';
import ProductManagementPage from './pages/ProductManagementPage';
import WeeklyPlannerPage from './pages/WeeklyPlannerPage';
import QRManagementPage from './pages/QRManagementPage';

import SyncStatusIndicator from './components/SyncStatusIndicator';
import { startSync, stopSync } from './services/syncEngine';

/* ═══════════════════════════════════════════════════
   CONSTANTS & HELPERS
══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   SEED DATA
══════════════════════════════════════════════════ */
const SEED_WORKERS = [
  { id: 1, name: "Murugan", gender: "male", phone: "9876543210", salary: 500, role: "Field Worker", joined: "2026-01-10", active: true },
  { id: 2, name: "Selvi", gender: "female", phone: "9876543211", salary: 450, role: "Harvester", joined: "2026-01-12", active: true },
  { id: 3, name: "Rajan", gender: "male", phone: "9876543212", salary: 500, role: "Irrigation", joined: "2026-02-01", active: true },
  { id: 4, name: "Meena", gender: "female", phone: "9876543213", salary: 450, role: "Harvester", joined: "2026-02-05", active: true },
  { id: 5, name: "Pandi", gender: "male", phone: "9876543214", salary: 550, role: "Supervisor", joined: "2026-01-05", active: true },
];
const SEED_SCHEDULE = [
  { id: 1, date: "2026-06-10", drip: "12:61:00 MAP (1.5-2 kg)", spray: "ஏதுமில்லை", field: "அறுவடை", note: "பாஸ்பரஸ் குறைபாடு தீர்வு", type: "harvest", done: false },
  { id: 2, date: "2026-06-11", drip: "கட்டுப்படுத்தப்பட்ட பாசனம்", spray: "Boron 20% (100g/100L)", field: "கண்காணிப்பு", note: "சர்க்கரை அளவு கூட்ட", type: "monitor", done: false },
  { id: 3, date: "2026-06-12", drip: "SOP 0:00:50 (1.5-2 kg)", spray: "ஏதுமில்லை", field: "அறுவடை", note: "Brix & எடை கூட்ட", type: "harvest", done: false },
  { id: 4, date: "2026-06-13", drip: "கட்டுப்படுத்தப்பட்ட பாசனம்", spray: "ONDA (200ml) + COLORE (250g)", field: "QR பதிவு & இலை கத்தரிப்பு", note: "அடர் சிவப்பு நிறம் & நறுமணம்", type: "spray", done: false },
  { id: 5, date: "2026-06-14", drip: "Ascophyllum nodosum", spray: "ஏதுமில்லை", field: "ஓய்வு / கண்காணிப்பு", note: "வேர் செயல்பாடு மேம்பட", type: "rest", done: false },
  { id: 6, date: "2026-06-15", drip: "கட்டுப்படுத்தப்பட்ட பாசனம்", spray: "Spintor/Tracer (35ml/100L)", field: "அறுவடை", note: "பூச்சி கட்டுப்பாடு", type: "harvest", done: false },
  { id: 7, date: "2026-06-16", drip: "SOP 0:00:50 (1.5-2 kg)", spray: "NIXI Calcium (150ml/100L)", field: "கண்காணிப்பு", note: "பழத்தோல் கெட்டிப்படுத்த", type: "monitor", done: false },
  { id: 8, date: "2026-06-17", drip: "12:61:00 MAP (1.5-2 kg)", spray: "ஏதுமில்லை", field: "அறுவடை", note: "2ஆம் தவணை மீட்பு", type: "harvest", done: false },
  { id: 9, date: "2026-06-18", drip: "கட்டுப்படுத்தப்பட்ட பாசனம்", spray: "Boron 20% (100g/100L)", field: "கண்காணிப்பு", note: "சீரான வடிவம் & சர்க்கரை", type: "monitor", done: false },
  { id: 10, date: "2026-06-19", drip: "Minsol 13:00:45 (1.5 kg)", spray: "ஏதுமில்லை", field: "அறுவடை", note: "இலை தழை அமைப்பு பராமரிக்க", type: "harvest", done: false },
];
const SEED_CUSTOMERS = [
  { id: 1, name: "Priya Stores", phone: "9876501111", location: "Kodaikanal", type: "premium", since: "2026-03-01", orders: [{ id: 101, date: "2026-05-10", boxes: 50 }, { id: 102, date: "2026-05-20", boxes: 80 }, { id: 103, date: "2026-06-01", boxes: 100 }] },
  { id: 2, name: "Kumar Fruits", phone: "9876502222", location: "Madurai", type: "regular", since: "2026-04-10", orders: [{ id: 104, date: "2026-05-15", boxes: 20 }, { id: 105, date: "2026-06-01", boxes: 25 }] },
  { id: 3, name: "Anbu Supermarket", phone: "9876503333", location: "Coimbatore", type: "premium", since: "2026-02-15", orders: [{ id: 106, date: "2026-04-20", boxes: 120 }, { id: 107, date: "2026-05-25", boxes: 150 }, { id: 108, date: "2026-06-05", boxes: 200 }] },
  { id: 4, name: "Devi Hotel", phone: "9876504444", location: "Dindigul", type: "regular", since: "2026-05-01", orders: [{ id: 109, date: "2026-06-02", boxes: 15 }] },
];
const genSeeds = (n) => Array.from({ length: n }, (_, i) => ({
  id: i + 1,
  flowers: Math.floor(Math.random() * 8),
  greenFruits: Math.floor(Math.random() * 6),
  redFruits: Math.floor(Math.random() * 4),
  defect: Math.random() < 0.18 ? ["slug damage", "leaf curl", "grey mould", "aphids", "caterpillar"][Math.floor(Math.random() * 5)] : "",
  yieldGrams: Math.floor(Math.random() * 280 + 60),
  notes: ""
}));

/* ═══════════════════════════════════════════════════
   AUTH CONTEXT & LOGIN (SECURE WITH CRYPTO-JS)
══════════════════════════════════════════════════ */
const AUTH = {
  getUsers: () => {
    try {
      const v = localStorage.getItem("auth_users");
      return v != null ? JSON.parse(v) : [
        { 
          id: 1, 
          username: "superadmin", 
          password: CryptoJS.SHA256("admin123").toString(CryptoJS.enc.Hex), 
          role: "superadmin", 
          name: "Super Admin", 
          createdAt: "2026-01-01" 
        }
      ];
    } catch { return []; }
  },
  setUsers: (u) => {
    const hashedUsers = u.map(user => ({
      ...user,
      password: CryptoJS.SHA256(user.password).toString(CryptoJS.enc.Hex)
    }));
    try { localStorage.setItem("auth_users", JSON.stringify(hashedUsers)); } catch { }
  },
  getSession: () => {
    try {
      const v = localStorage.getItem("auth_session");
      return v != null ? JSON.parse(v) : null;
    } catch { return null; }
  },
  setSession: (s) => {
    try { localStorage.setItem("auth_session", JSON.stringify(s)); } catch { }
  },
  logout: () => {
    try { localStorage.removeItem("auth_session"); } catch { }
  }
};

/* ═══════════════════════════════════════════════════
   WEATHER
══════════════════════════════════════════════════ */
const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || "YOUR_OPENWEATHER_API_KEY";
const WEATHER_CITY = "Kodaikanal";

const fetchWeather = async () => {
  try {
    const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${WEATHER_CITY}&appid=${WEATHER_API_KEY}&units=metric`);
    const d = await r.json();
    if (d.cod === 200) {
      return {
        temp: d.main.temp,
        humidity: d.main.humidity,
        description: d.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png`,
        wind: d.wind.speed,
        feels_like: d.main.feels_like
      };
    }
    return null;
  } catch { return null; }
};

/* ═══════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════ */
const App = () => {
  const [auth, setAuth] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [sbOpen, setSbOpen] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [schedule, setSchedule] = useState([]);
  const [plants, setPlants] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [defects, setDefects] = useState([]);
  const [pestLog, setPestLog] = useState([]);
  const [bills, setBills] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState(() => AUTH.getUsers());
  const [loginModal, setLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginErr, setLoginErr] = useState("");
  const [adminModal, setAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ username: "", password: "", name: "", role: "admin" });
  const [adminErr, setAdminErr] = useState("");

  useEffect(() => {
    if (auth) {
      startSync();
      return () => stopSync();
    }
  }, [auth]);

  const seedData = async () => {
    try {
      const workersSnap = await getDocs(collection(db, "workers"));
      if (workersSnap.empty) {
        const batch = writeBatch(db);
        SEED_WORKERS.forEach(w => batch.set(doc(db, "workers", w.id.toString()), w));
        SEED_SCHEDULE.forEach(s => batch.set(doc(db, "schedule", s.id.toString()), s));
        SEED_CUSTOMERS.forEach(c => batch.set(doc(db, "customers", c.id.toString()), c));
        batch.set(doc(db, "plants", "master"), { items: genSeeds(50) });
        await batch.commit();
        console.log("🌱 Seed data added to Firestore!");
      }
    } catch (e) { console.error("Seed error:", e); }
  };

  useEffect(() => {
    const session = AUTH.getSession();
    if (session) setAuth(session);
    else setLoginModal(true);
    seedData();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "workers"), (snap) => {
      setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "attendance"), (snap) => {
      const data = {};
      snap.docs.forEach(d => {
        const { date, workerId, status } = d.data();
        data[`${date}_${workerId}`] = status;
      });
      setAttendance(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "schedule"), (snap) => {
      setSchedule(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "plants", "master"), (snap) => {
      if (snap.exists()) {
        setPlants(snap.data().items || []);
      } else {
        setPlants(genSeeds(50));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "customers"), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data(), orders: d.data().orders || [] })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "defects"), (snap) => {
      setDefects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pestlog"), (snap) => {
      setPestLog(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bills"), (snap) => {
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (auth) {
      setWeatherLoading(true);
      fetchWeather().then(d => { setWeather(d);
        setWeatherLoading(false); });
    }
  }, [auth]);

  const handleLogin = () => {
    const users = AUTH.getUsers();
    const hashedInput = CryptoJS.SHA256(loginForm.password).toString(CryptoJS.enc.Hex);
    const found = users.find(u => u.username === loginForm.username && u.password === hashedInput);
    if (found) {
      const session = { id: found.id, username: found.username, role: found.role, name: found.name };
      AUTH.setSession(session);
      setAuth(session);
      setLoginModal(false);
      setLoginErr("");
      setLoginForm({ username: "", password: "" });
    } else {
      setLoginErr("❌ Invalid username or password");
    }
  };

  const handleLogout = () => {
    AUTH.logout();
    setAuth(null);
    setLoginModal(true);
  };

  const createAdmin = () => {
    if (!adminForm.username || !adminForm.password || !adminForm.name) {
      setAdminErr("All fields required");
      return;
    }
    const users = AUTH.getUsers();
    if (users.find(u => u.username === adminForm.username)) {
      setAdminErr("Username already exists");
      return;
    }
    const newUser = {
      id: Date.now(),
      username: adminForm.username,
      password: CryptoJS.SHA256(adminForm.password).toString(CryptoJS.enc.Hex),
      role: adminForm.role,
      name: adminForm.name,
      createdAt: today()
    };
    setAdminUsers([...users, newUser]);
    setAdminModal(false);
    setAdminForm({ username: "", password: "", name: "", role: "admin" });
    setAdminErr("");
  };

  const deleteAdmin = (id) => {
    if (id === auth?.id) { alert("You cannot delete yourself!"); return; }
    const users = AUTH.getUsers();
    setAdminUsers(users.filter(u => u.id !== id));
  };

  const td = today();
  const plantDate = new Date("2026-03-10");
  const dayNum = Math.max(1, Math.floor((Date.now() - plantDate.getTime()) / 86400000) + 1);
  const newDefectCnt = defects.filter(d => !d.seen).length;

  const NAV = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { sec: "பண்ணை மேலாண்மை" },
    { id: "workers", icon: "👷", label: "Workers" },
    { id: "attendance", icon: "📅", label: "Attendance" },
    { id: "schedule", icon: "📋", label: "Daily Schedule" },
    { id: "fertiliser", icon: "🧪", label: "Fertiliser & Pest" },
    { sec: "கண்காணிப்பு" },
    { id: "fields", icon: "🌾", label: "Fields & Crops" },
    { id: "crop", icon: "🌱", label: "Crop Monitoring" },
    { id: "reports", icon: "🚨", label: "Worker Reports", badge: newDefectCnt },
    { sec: "வணிகம்" },
    { id: "customers", icon: "🛒", label: "Customers" },
    { sec: "நிர்வாகம்" },
    { id: "products", icon: "🧪", label: "Products" },
    { id: "weekly", icon: "📅", label: "Weekly Planner" },
    { id: "admins", icon: "👤", label: "Admin Management" },
    { id: "bills", icon: "📄", label: "Bill Management" },
  ];

  const TITLES = {
    dashboard: "📊 Overview Dashboard",
    workers: "👷 Worker Management",
    attendance: "📅 Attendance Tracking",
    schedule: "📋 Daily Schedule",
    fertiliser: "🧪 Fertiliser & Pest Management",
    crop: "🌱 Crop Monitoring",
    reports: "🚨 Worker Field Reports",
    customers: "🛒 Customer Management",
    admins: "👤 Admin Management",
    bills: "📄 Bill Management",
    fields: "🌾 Field & Row Management",
    products: "🧪 Product Management",
    weekly: "📅 Weekly Planner"
  };

  const nav = (p) => { setPage(p);
    setSbOpen(false); };

  const sharedProps = {
    td,
    dayNum,
    workers,
    setWorkers,
    attendance,
    setAttendance,
    schedule,
    setSchedule,
    plants,
    setPlants,
    customers,
    setCustomers,
    defects,
    setDefects,
    pestLog,
    setPestLog,
    bills,
    setBills,
    weather,
    weatherLoading,
    auth,
    adminUsers,
    setAdminUsers,
    createAdmin,
    deleteAdmin,
    handleLogout,
    isSuperAdmin: auth?.role === "superadmin"
  };

  if (!auth) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ fontSize: "48px" }}>🍓</div>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "22px", fontWeight: 800, color: "var(--primary)", marginTop: "8px" }}>Kodai Strawberry</div>
            <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>Admin Dashboard</div>
          </div>
          {loginErr && <div className="alert a-err" style={{ marginBottom: "16px" }}>{loginErr}</div>}
          <div className="fg"><label>Username</label><input value={loginForm.username} onChange={e => setLoginForm(p => ({ ...p, username: e.target.value }))} placeholder="Enter username" /></div>
          <div className="fg"><label>Password</label><input type="password" value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} placeholder="Enter password" onKeyDown={e => e.key === "Enter" && handleLogin()} /></div>
          <button className="btn btn-primary" style={{ width: "100%", padding: "12px", fontSize: "15px" }} onClick={handleLogin}>🔐 Sign In</button>
          <div style={{ fontSize: "11px", color: "var(--muted)", textAlign: "center", marginTop: "14px" }}>Default: superadmin / admin123</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", width: "100%", minHeight: "100vh" }}>
      <button className="ham" onClick={() => setSbOpen(o => !o)}>☰</button>
      <div className={`sb-overlay${sbOpen ? " show" : ""}`} onClick={() => setSbOpen(false)} />
      <aside className={`sb${sbOpen ? " open" : ""}`}>
        <div className="sb-brand">
          <div className="sb-logo">🍓</div>
          <div className="sb-name">Kodai Strawberry</div>
          <div className="sb-sub">Admin Dashboard</div>
        </div>
        <nav className="sb-nav">
          {NAV.map((item, i) =>
            item.sec ? <div key={i} className="sb-sec">{item.sec}</div> : (
              <div key={item.id} className={`sb-item${page === item.id ? " active" : ""}`} onClick={() => nav(item.id)}>
                <span className="sb-icon">{item.icon}</span>
                <span className="flex1">{item.label}</span>
                {item.badge > 0 && <span className="sb-badge">{item.badge}</span>}
              </div>
            )
          )}
        </nav>
        <div className="sb-foot">
          <div className="sb-admin">
            <div className="sb-av">{auth.name?.[0] || "A"}</div>
            <div>
              <div className="sb-aname">{auth.name} ({auth.role})</div>
              <div className="sb-arole" style={{ cursor: "pointer" }} onClick={handleLogout}>🚪 Logout</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="topbar-title">{TITLES[page] || page}</div>
          <div className="topbar-right">
            <SyncStatusIndicator />
            {weather && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted)" }}>
                <img src={weather.icon} alt="weather" style={{ width: "24px", height: "24px" }} />
                <span>{Math.round(weather.temp)}°C</span>
                <span style={{ fontSize: "10px" }}>{weather.description}</span>
              </div>
            )}
            <span className="topbar-day">Day {dayNum} · {td}</span>
            {newDefectCnt > 0 && <span className="notif-pill" onClick={() => nav("reports")} style={{ cursor: "pointer" }}>🚨 {newDefectCnt} Report</span>}
          </div>
        </div>
        <div className="page">
          {page === "dashboard" && <DashPage {...sharedProps} />}
          {page === "workers" && <WorkersPage {...sharedProps} />}
          {page === "attendance" && <AttPage {...sharedProps} />}
          {page === "schedule" && <SchedPage {...sharedProps} />}
          {page === "fertiliser" && <FertPage {...sharedProps} />}
          {page === "fields" && <FieldsPage {...sharedProps} />}
          {page === "crop" && <CropPage {...sharedProps} />}
          {page === "reports" && <ReportsPage {...sharedProps} />}
          {page === "customers" && <CustPage {...sharedProps} />}
          {page === "products" && <ProductManagementPage {...sharedProps} />}
          {page === "weekly" && <WeeklyPlannerPage {...sharedProps} />}
          {page === "admins" && <AdminPage {...sharedProps} />}
          {page === "bills" && <BillPage {...sharedProps} />}
          {page === "qrmanagement" && <QRManagementPage {...sharedProps} />}
        </div>
      </main>
    </div>
  );
};

export default App;
