import { callGemini } from './gemini';
import React, { useState, useEffect, useRef } from 'react';
import './styles.css';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "./firebase";

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

import SyncStatusIndicator from '../components/SyncStatusIndicator';
import { startSync, stopSync } from './services/syncEngine';

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

const AUTH = {
  getUsers: () => {
    try {
      const v = localStorage.getItem("auth_users");
      if (v) return JSON.parse(v);
    } catch {}
    const defaultAdmin = {
      id: 1,
      username: "superadmin",
      password: "admin123",
      role: "superadmin",
      name: "Super Admin",
      createdAt: today()
    };
    localStorage.setItem("auth_users", JSON.stringify([defaultAdmin]));
    return [defaultAdmin];
  },
  setUsers: (u) => {
    try { localStorage.setItem("auth_users", JSON.stringify(u)); } catch {}
  },
  getSession: () => {
    try {
      const v = localStorage.getItem("auth_session");
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },
  setSession: (s) => {
    try { localStorage.setItem("auth_session", JSON.stringify(s)); } catch {}
  },
  logout: () => {
    try { localStorage.removeItem("auth_session"); } catch {}
  }
};

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

  useEffect(() => {
    const session = AUTH.getSession();
    if (session) {
      setAuth(session);
    } else {
      setLoginModal(true);
    }
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

  const td = today();
  const newDefectCnt = defects.filter(d => !d.seen).length;
  const plantDate = new Date("2026-03-10");
  const dayNum = Math.max(1, Math.floor((Date.now() - plantDate.getTime()) / 86400000) + 1);

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
    { id: "qrmanagement", icon: "📱", label: "QR Management" },
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
    weekly: "📅 Weekly Planner",
    qrmanagement: "📱 QR Management"
  };

  const nav = (p) => { setPage(p); setSbOpen(false); };

  const handleLogin = () => {
    const users = AUTH.getUsers();
    const found = users.find(u => u.username === loginForm.username && u.password === loginForm.password);
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
      password: adminForm.password,
      role: adminForm.role,
      name: adminForm.name,
      createdAt: today()
    };
    const updatedUsers = [...users, newUser];
    AUTH.setUsers(updatedUsers);
    setAdminUsers(updatedUsers);
    setAdminModal(false);
    setAdminForm({ username: "", password: "", name: "", role: "admin" });
    setAdminErr("");
  };

  const deleteAdmin = (id) => {
    if (id === auth?.id) {
      alert("You cannot delete yourself!");
      return;
    }
    const users = AUTH.getUsers();
    const updatedUsers = users.filter(u => u.id !== id);
    AUTH.setUsers(updatedUsers);
    setAdminUsers(updatedUsers);
  };

  useEffect(() => {
    if (auth) {
      setWeatherLoading(true);
      fetchWeather().then(d => { setWeather(d); setWeatherLoading(false); });
    }
  }, [auth]);

  const sharedProps = {
    td,
    dayNum,
    workers, setWorkers,
    attendance, setAttendance,
    schedule, setSchedule,
    plants, setPlants,
    customers, setCustomers,
    defects, setDefects,
    pestLog, setPestLog,
    bills, setBills,
    weather, weatherLoading,
    auth,
    adminUsers, setAdminUsers,
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
