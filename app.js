// School Management System - Fast Neon Cloud DB + Theme Studio
import { neon } from 'https://esm.sh/@neondatabase/serverless@0.9.0';

const $ = id => document.getElementById(id);

let serverToday = null;
const today = () => {
  if (serverToday) return serverToday;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUSES = ["Present", "Absent", "Late", "Leave"];
const DEFAULT_CLASSES = ["Nursery", "Prep", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
const DEFAULT_SECTIONS = ["A", "B", "C", "D"];

// DIRECT NEON POSTGRES CONNECTION
const NEON_CONN_STRING = "postgresql://neondb_owner:npg_Pp7ZIAD6lOdm@ep-rapid-darkness-bekuo4wo-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(NEON_CONN_STRING);

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function setBtnLoading(btn, isLoading, loadingText = "Saving...") {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${loadingText}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.origText) btn.innerHTML = btn.dataset.origText;
  }
}

// Show / Hide PIN & Password Toggle
document.addEventListener("click", e => {
  const btn = e.target.closest(".toggle-eye");
  if (!btn) return;
  const input = document.getElementById(btn.dataset.target);
  if (!input) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btn.innerHTML = isHidden
    ? `<i class="bi bi-eye-slash-fill text-warning"></i>`
    : `<i class="bi bi-eye-fill text-warning"></i>`;
});

/* ========================================================
   THEME & BACKGROUND STUDIO (BODY + LOGIN SEPARATE)
   ======================================================== */
const THEME_PRESETS = [
  { name: "Midnight Ocean", type: "solid", c1: "#0b1920", c2: "#154352", dir: "135deg" },
  { name: "Deep Emerald Mix", type: "gradient", c1: "#062c24", c2: "#0f6b58", dir: "135deg" },
  { name: "Royal Indigo Mix", type: "gradient", c1: "#0f172a", c2: "#312e81", dir: "135deg" },
  { name: "Sunset Plum Mix", type: "gradient", c1: "#1a1025", c2: "#6b215c", dir: "135deg" },
  { name: "Arctic Teal Mix", type: "gradient", c1: "#082f49", c2: "#0e7490", dir: "135deg" },
  { name: "Golden Dusk Mix", type: "gradient", c1: "#1c1917", c2: "#78350f", dir: "135deg" },
  { name: "Crimson Night Mix", type: "gradient", c1: "#1f0a10", c2: "#7f1d1d", dir: "135deg" },
  { name: "Forest Aurora Mix", type: "gradient", c1: "#052e16", c2: "#1d4ed8", dir: "135deg" },
  { name: "Charcoal Slate", type: "solid", c1: "#111827", c2: "#1f2937", dir: "135deg" },
  { name: "Velvet Purple", type: "solid", c1: "#1e1b4b", c2: "#312e81", dir: "135deg" }
];

const DEFAULT_THEME = {
  body: { type: "solid", c1: "#0b1920", c2: "#134e5e", dir: "135deg" },
  login: { type: "gradient", c1: "#154352", c2: "#0b1920", dir: "radial", image: null, overlay: 45 }
};

let currentTheme = structuredClone(DEFAULT_THEME);

function buildBgCss(cfg) {
  if (cfg.type === "image" && cfg.image) {
    const alpha = Math.min(0.85, Math.max(0, (cfg.overlay ?? 45) / 100));
    return `linear-gradient(rgba(0,0,0,${alpha}), rgba(0,0,0,${alpha})), url("${cfg.image}")`;
  }
  if (cfg.type === "gradient") {
    if (cfg.dir === "radial") {
      return `radial-gradient(circle at top, ${cfg.c1} 0%, ${cfg.c2} 80%)`;
    }
    return `linear-gradient(${cfg.dir || "135deg"}, ${cfg.c1} 0%, ${cfg.c2} 100%)`;
  }
  return cfg.c1 || "#0b1920";
}

function applyTheme(theme) {
  if (!theme) return;
  const bCss = buildBgCss(theme.body || DEFAULT_THEME.body);
  document.body.style.background = bCss;
  document.body.style.backgroundAttachment = "fixed";
  document.body.style.backgroundSize = "cover";

  const lCss = buildBgCss(theme.login || DEFAULT_THEME.login);
  const loginEl = $("loginView");
  if (loginEl) {
    loginEl.style.background = lCss;
    loginEl.style.backgroundSize = "cover";
    loginEl.style.backgroundPosition = "center";
  }

  const previewEl = $("loginPreviewBox");
  if (previewEl) {
    previewEl.style.background = lCss;
    previewEl.style.backgroundSize = "cover";
    previewEl.style.backgroundPosition = "center";
  }
}

function loadCachedTheme() {
  try {
    const saved = localStorage.getItem("sms_theme_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      currentTheme = {
        body: { ...DEFAULT_THEME.body, ...(parsed.body || {}) },
        login: { ...DEFAULT_THEME.login, ...(parsed.login || {}) }
      };
    }
  } catch (e) {
    currentTheme = structuredClone(DEFAULT_THEME);
  }
  applyTheme(currentTheme);
}

function syncThemeControls() {
  if (!$("bodyBgType")) return;
  // Body controls
  $("bodyBgType").value = currentTheme.body.type;
  $("bodyColor1").value = currentTheme.body.c1;
  $("bodyColor2").value = currentTheme.body.c2;
  $("bodyGradDir").value = currentTheme.body.dir || "135deg";
  const bIsGrad = currentTheme.body.type === "gradient";
  $("bodyColor2Wrap").classList.toggle("d-none", !bIsGrad);
  $("bodyDirWrap").classList.toggle("d-none", !bIsGrad);

  // Login controls
  $("loginBgType").value = currentTheme.login.type;
  $("loginColor1").value = currentTheme.login.c1;
  $("loginColor2").value = currentTheme.login.c2;
  $("loginGradDir").value = currentTheme.login.dir || "radial";
  $("loginOverlayRange").value = currentTheme.login.overlay ?? 45;
  $("overlayValText").textContent = `${currentTheme.login.overlay ?? 45}%`;

  const lType = currentTheme.login.type;
  document.querySelectorAll(".login-color-ctrl").forEach(el => el.classList.toggle("d-none", lType === "image"));
  document.querySelectorAll(".login-grad-ctrl").forEach(el => el.classList.toggle("d-none", lType !== "gradient"));
  $("loginImgCtrl").classList.toggle("d-none", lType !== "image");

  applyTheme(currentTheme);
}

function renderPresetSwatches() {
  const renderInto = (containerId, targetKey) => {
    const box = $(containerId);
    if (!box) return;
    box.innerHTML = THEME_PRESETS.map((p, idx) => {
      const bg = p.type === "gradient" ? `linear-gradient(${p.dir}, ${p.c1}, ${p.c2})` : p.c1;
      return `<button type="button" class="theme-swatch" data-target="${targetKey}" data-idx="${idx}" title="${esc(p.name)}" style="background:${bg};"></button>`;
    }).join("");
  };
  renderInto("bodyPresets", "body");
  renderInto("loginPresets", "login");
}

function compressImageToDataURL(file, maxWidth = 1280, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setupThemeStudioListeners() {
  renderPresetSwatches();

  ["bodyPresets", "loginPresets"].forEach(id => {
    $(id)?.addEventListener("click", e => {
      const btn = e.target.closest(".theme-swatch");
      if (!btn) return;
      const preset = THEME_PRESETS[Number(btn.dataset.idx)];
      const key = btn.dataset.target;
      if (!preset) return;
      if (key === "body") {
        currentTheme.body = { type: preset.type, c1: preset.c1, c2: preset.c2, dir: preset.dir };
      } else {
        currentTheme.login = { ...currentTheme.login, type: preset.type, c1: preset.c1, c2: preset.c2, dir: preset.dir };
      }
      syncThemeControls();
    });
  });

  // Body live change listeners
  ["bodyBgType", "bodyColor1", "bodyColor2", "bodyGradDir"].forEach(id => {
    $(id)?.addEventListener("input", () => {
      currentTheme.body.type = $("bodyBgType").value;
      currentTheme.body.c1 = $("bodyColor1").value;
      currentTheme.body.c2 = $("bodyColor2").value;
      currentTheme.body.dir = $("bodyGradDir").value;
      syncThemeControls();
    });
  });

  // Login live change listeners
  ["loginBgType", "loginColor1", "loginColor2", "loginGradDir", "loginOverlayRange"].forEach(id => {
    $(id)?.addEventListener("input", () => {
      currentTheme.login.type = $("loginBgType").value;
      currentTheme.login.c1 = $("loginColor1").value;
      currentTheme.login.c2 = $("loginColor2").value;
      currentTheme.login.dir = $("loginGradDir").value;
      currentTheme.login.overlay = parseInt($("loginOverlayRange").value, 10) || 45;
      syncThemeControls();
    });
  });

  // Login image upload
  $("loginBgFile")?.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast("Picture process ho rahi hai...", "info");
      const dataUrl = await compressImageToDataURL(file);
      currentTheme.login.image = dataUrl;
      currentTheme.login.type = "image";
      syncThemeControls();
      toast("Login picture preview ready! Save button dabayein.", "success");
    } catch (err) {
      toast("Picture load nahi hui: " + err.message, "danger");
    }
  });

  // Remove login picture
  $("removeLoginImgBtn")?.addEventListener("click", () => {
    currentTheme.login.image = null;
    currentTheme.login.type = "gradient";
    if ($("loginBgFile")) $("loginBgFile").value = "";
    syncThemeControls();
    toast("Login picture remove ho gayi.");
  });

  // Save Theme to localStorage + Neon DB
  $("saveThemeBtn")?.addEventListener("click", async () => {
    const btn = $("saveThemeBtn");
    setBtnLoading(btn, true, "Saving...");
    try {
      const jsonStr = JSON.stringify(currentTheme);
      localStorage.setItem("sms_theme_settings", jsonStr);
      if (schoolConfig.email) {
        await sql`UPDATE school_config SET theme_settings = ${jsonStr} WHERE email = ${schoolConfig.email};`;
      }
      applyTheme(currentTheme);
      toast("Theme & Background settings save ho gayin!", "success");
    } catch (err) {
      toast("Save error: " + err.message, "danger");
    } finally {
      setBtnLoading(btn, false);
    }
  });

  // Reset Theme
  $("resetThemeBtn")?.addEventListener("click", async () => {
    if (!confirm("Default theme wapis lana chahte hain?")) return;
    currentTheme = structuredClone(DEFAULT_THEME);
    if ($("loginBgFile")) $("loginBgFile").value = "";
    syncThemeControls();
    localStorage.setItem("sms_theme_settings", JSON.stringify(currentTheme));
    if (schoolConfig.email) {
      await sql`UPDATE school_config SET theme_settings = NULL WHERE email = ${schoolConfig.email};`.catch(console.error);
    }
    toast("Default theme restore ho gaya!");
  });
}

// Apply cached theme immediately on page load
loadCachedTheme();

let currentDeviceId = localStorage.getItem("sms_device_fingerprint");
if (!currentDeviceId) {
  currentDeviceId = "DEV_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  localStorage.setItem("sms_device_fingerprint", currentDeviceId);
}

let deviceLinkedEmail = localStorage.getItem("sms_linked_admin_email") || null;

// In-Memory Cloud State
let schoolConfig = { isConfigured: false, email: "", password: "", adminPin: "1234", securityQuestion: "", securityAnswer: "" };
let schoolGeo = { lat: null, lng: null, radius: 150 };
let students = [];
let teachers = [];
let attendanceCache = {};

let currentSession = null;
let currentLoginTab = "admin";
let currentViewStudent = null;
let pendingRecoveryConfig = null;

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function createSampleDoc(title, bformNo) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <rect width="800" height="500" fill="#0f3b46" rx="10"/>
    <rect x="25" y="25" width="750" height="450" fill="none" stroke="#f0b429" stroke-width="4" stroke-dasharray="8,6"/>
    <text x="400" y="110" fill="#f0b429" font-family="sans-serif" font-size="28" font-weight="bold" text-anchor="middle">GOVERNMENT OF PAKISTAN</text>
    <text x="400" y="160" fill="#ffffff" font-family="sans-serif" font-size="24" font-weight="bold" text-anchor="middle">NATIONAL REGISTRATION (B-FORM)</text>
    <line x1="100" y1="190" x2="700" y2="190" stroke="#17566a" stroke-width="3"/>
    <text x="400" y="255" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">Student: ${title}</text>
    <text x="400" y="305" fill="#a0b3bc" font-family="sans-serif" font-size="18" text-anchor="middle">B-Form / CRC: ${bformNo}</text>
    <rect x="300" y="350" width="200" height="45" rx="6" fill="#1f8a5b"/>
    <text x="400" y="380" fill="#ffffff" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">VERIFIED RECORD</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function fillSel(elOrId, vals, allLabel = "") {
  const sel = typeof elOrId === "string" ? $(elOrId) : elOrId;
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = (allLabel ? `<option value="">${allLabel}</option>` : "") + vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  if (vals.includes(cur) || (allLabel && cur === "")) sel.value = cur;
}

function fillStaticDropdowns() {
  document.querySelectorAll(".std-class-sel").forEach(s => fillSel(s, DEFAULT_CLASSES, "-- Select Class --"));
  document.querySelectorAll(".std-sec-sel").forEach(s => fillSel(s, DEFAULT_SECTIONS, "-- Select Section --"));
}

function fillFilterSelects() {
  fillSel("dashClass", DEFAULT_CLASSES, "All classes");
  fillSel("dashSection", DEFAULT_SECTIONS, "All sections");
  fillSel("saClass", DEFAULT_CLASSES);
  fillSel("saSection", DEFAULT_SECTIONS);
}

function toast(msg, type = "success") {
  const cont = $("toasts");
  if (!cont) return;
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${type} border-0 show`;
  el.innerHTML = `<div class="d-flex"><div class="toast-body fw-semibold">${esc(msg)}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  cont.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function getAge(dobString) {
  if (!dobString) return null;
  const birth = new Date(dobString);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  return years;
}

/* ========================================================
   ONE-TIME FAST TABLE INIT
   ======================================================== */
async function initNeonTablesOnce() {
  if (localStorage.getItem("sms_db_ready_v3") === "1") return;
  try {
    await Promise.all([
      sql`CREATE TABLE IF NOT EXISTS school_config (email VARCHAR(255) PRIMARY KEY, password_hash VARCHAR(255) NOT NULL, admin_pin VARCHAR(10) NOT NULL, security_question TEXT, security_answer TEXT, theme_settings TEXT);`,
      sql`CREATE TABLE IF NOT EXISTS school_geofence (id INT PRIMARY KEY, latitude NUMERIC, longitude NUMERIC, radius INT);`,
      sql`CREATE TABLE IF NOT EXISTS teachers (id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, staff_id VARCHAR(50) NOT NULL, department VARCHAR(100), assigned_class VARCHAR(50), assigned_section VARCHAR(50), pin VARCHAR(10), phone VARCHAR(50), email VARCHAR(100), status VARCHAR(50) DEFAULT 'Absent', check_in VARCHAR(20) DEFAULT '--:--', bound_device_id VARCHAR(255));`,
      sql`CREATE TABLE IF NOT EXISTS students (id UUID PRIMARY KEY, full_name VARCHAR(255) NOT NULL, father_name VARCHAR(255) NOT NULL, roll_number VARCHAR(50) NOT NULL, class VARCHAR(50), section VARCHAR(50), phone VARCHAR(50), dob DATE, b_form_number VARCHAR(100), has_b_form BOOLEAN DEFAULT FALSE, b_form_url TEXT, b_form_type VARCHAR(100), address TEXT);`,
      sql`CREATE TABLE IF NOT EXISTS attendance_logs (id SERIAL PRIMARY KEY, record_date DATE NOT NULL, person_type VARCHAR(20) NOT NULL, person_id VARCHAR(100) NOT NULL, status VARCHAR(20) NOT NULL, check_in_time VARCHAR(20));`
    ]);
    await sql`ALTER TABLE school_config ADD COLUMN IF NOT EXISTS theme_settings TEXT;`;
    localStorage.setItem("sms_db_ready_v3", "1");
  } catch (err) {
    console.warn("Table init notice:", err.message);
  }
}

async function loadAttendanceForDate(dateStr, forceRefresh = false) {
  if (!forceRefresh && attendanceCache[dateStr]) return attendanceCache[dateStr];
  try {
    const rows = await sql`
      SELECT person_type, person_id, status, check_in_time 
      FROM attendance_logs 
      WHERE record_date = ${dateStr} 
      ORDER BY id ASC;
    `;
    const map = { student: {}, teacher: {} };
    for (const r of rows) {
      if (r.person_type === "student") {
        map.student[String(r.person_id)] = r.status;
      } else if (r.person_type === "teacher") {
        map.teacher[String(r.person_id)] = { status: r.status, checkIn: r.check_in_time || "--:--" };
      }
    }
    attendanceCache[dateStr] = map;
    return map;
  } catch (err) {
    console.error("Attendance fetch error:", err);
    return { student: {}, teacher: {} };
  }
}

/* ========================================================
   FAST PARALLEL DATA LOAD FROM NEON DB
   ======================================================== */
async function loadDataFromNeon() {
  try {
    await initNeonTablesOnce();

    // Online Pakistan date from Neon server
    const dateRow = await sql`SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD') AS pk_date;`;
    if (dateRow && dateRow[0]?.pk_date) serverToday = dateRow[0].pk_date;
    const todayStr = today();

    const [configRows, geoRows, teachersRows, studentsRows, todayAtt] = await Promise.all([
      deviceLinkedEmail
        ? sql`SELECT * FROM school_config WHERE LOWER(email) = ${deviceLinkedEmail.toLowerCase()} LIMIT 1;`
        : Promise.resolve([]),
      sql`SELECT * FROM school_geofence LIMIT 1;`,
      sql`SELECT * FROM teachers ORDER BY staff_id;`,
      sql`SELECT * FROM students ORDER BY roll_number;`,
      loadAttendanceForDate(todayStr, true)
    ]);

    if (configRows && configRows.length > 0) {
      schoolConfig = {
        isConfigured: true,
        email: configRows[0].email,
        password: configRows[0].password_hash,
        adminPin: configRows[0].admin_pin,
        securityQuestion: configRows[0].security_question || "What is your secret code?",
        securityAnswer: configRows[0].security_answer || ""
      };
      if (configRows[0].theme_settings) {
        try {
          const parsed = JSON.parse(configRows[0].theme_settings);
          currentTheme = {
            body: { ...DEFAULT_THEME.body, ...(parsed.body || {}) },
            login: { ...DEFAULT_THEME.login, ...(parsed.login || {}) }
          };
          localStorage.setItem("sms_theme_settings", JSON.stringify(currentTheme));
          applyTheme(currentTheme);
        } catch (e) {}
      }
    } else {
      schoolConfig.isConfigured = false;
    }

    if (geoRows && geoRows.length > 0) {
      schoolGeo = {
        lat: parseFloat(geoRows[0].latitude),
        lng: parseFloat(geoRows[0].longitude),
        radius: parseInt(geoRows[0].radius, 10) || 150
      };
    }

    teachers = (teachersRows || []).map(r => {
      const todayRec = todayAtt.teacher[String(r.id)];
      return {
        id: String(r.id),
        name: r.name,
        staffId: r.staff_id,
        department: r.department || "General",
        assignedClass: r.assigned_class || "Class 1",
        assignedSection: r.assigned_section || "A",
        pin: r.pin || "1234",
        boundDeviceId: r.bound_device_id || null,
        phone: r.phone || "",
        email: r.email || "",
        status: todayRec ? todayRec.status : "Absent",
        checkIn: todayRec ? todayRec.checkIn : "--:--"
      };
    });

    students = (studentsRows || []).map(r => ({
      id: String(r.id),
      fullName: r.full_name,
      fatherName: r.father_name,
      rollNumber: r.roll_number,
      class: r.class,
      section: r.section,
      dob: r.dob ? String(r.dob).slice(0, 10) : "",
      phone: r.phone,
      bFormNumber: r.b_form_number || "",
      hasBForm: Boolean(r.has_b_form),
      bFormUrl: r.b_form_url || null,
      bFormType: r.b_form_type || null,
      address: r.address || ""
    }));
  } catch (err) {
    console.error("Neon DB load error:", err);
    toast("Database connect nahi hua: " + err.message, "danger");
  }

  checkAuthFlow();
}

/* ========================================================
   AUTHENTICATION LOGIC
   ======================================================== */
function checkAuthFlow() {
  const loginView = $("loginView");
  const appView = $("appView");
  const emailAuthCard = $("emailAuthCard");
  const pinCard = $("pinLoginCard");
  const recCard = $("recoveryCard");

  applyTheme(currentTheme);

  if (!deviceLinkedEmail || !schoolConfig.isConfigured) {
    loginView.classList.remove("d-none");
    appView.classList.add("d-none");
    emailAuthCard.classList.remove("d-none");
    pinCard.classList.add("d-none");
    recCard.classList.add("d-none");
  } else {
    loginView.classList.remove("d-none");
    appView.classList.add("d-none");
    emailAuthCard.classList.add("d-none");
    pinCard.classList.remove("d-none");
    recCard.classList.add("d-none");
    refreshTeacherDropdown();
    $("userPinInput").value = "";
  }
}

$("tabEmailLoginBtn").addEventListener("click", () => {
  $("tabEmailLoginBtn").classList.add("active");
  $("tabEmailRegisterBtn").classList.remove("active");
  $("emailLoginForm").classList.remove("d-none");
  $("setupForm").classList.add("d-none");
  $("authCardSub").textContent = "School Admin Login";
});

$("tabEmailRegisterBtn").addEventListener("click", () => {
  $("tabEmailRegisterBtn").classList.add("active");
  $("tabEmailLoginBtn").classList.remove("active");
  $("setupForm").classList.remove("d-none");
  $("emailLoginForm").classList.add("d-none");
  $("authCardSub").textContent = "Create New School Account";
});

$("emailLoginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  setBtnLoading(btn, true, "Logging in...");
  const email = $("loginEmailInput").value.trim().toLowerCase();
  const pass = $("loginPassInput").value;

  try {
    const res = await sql`SELECT * FROM school_config WHERE LOWER(email) = ${email} LIMIT 1;`;
    if (!res || res.length === 0) return toast("Yeh email register nahi hai. 'Create Account' karein.", "warning");
    if (res[0].password_hash !== pass) return toast("Ghalat Master Password!", "danger");

    deviceLinkedEmail = res[0].email;
    localStorage.setItem("sms_linked_admin_email", deviceLinkedEmail);
    schoolConfig = {
      isConfigured: true,
      email: res[0].email,
      password: res[0].password_hash,
      adminPin: res[0].admin_pin,
      securityQuestion: res[0].security_question || "What is your secret code?",
      securityAnswer: res[0].security_answer || ""
    };

    if (res[0].theme_settings) {
      try {
        const parsed = JSON.parse(res[0].theme_settings);
        currentTheme = {
          body: { ...DEFAULT_THEME.body, ...(parsed.body || {}) },
          login: { ...DEFAULT_THEME.login, ...(parsed.login || {}) }
        };
        localStorage.setItem("sms_theme_settings", JSON.stringify(currentTheme));
      } catch (e) {}
    }

    toast("Device linked! Ab 4-digit PIN enter karein.", "success");
    checkAuthFlow();
  } catch (err) {
    toast("Login error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

$("setupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  const email = $("setupEmail").value.trim().toLowerCase();
  const pass = $("setupPass").value;
  const pin = $("setupPin").value.trim();
  const question = $("setupQuestion").value.trim();
  const answer = $("setupAnswer").value.trim();

  if (pin.length !== 4) return toast("Admin PIN 4-digit ka hona chahiye.", "warning");
  if (!question || !answer) return toast("Security question aur answer dono lazmi hain.", "warning");

  setBtnLoading(btn, true, "Creating...");
  try {
    await sql`
      INSERT INTO school_config (email, password_hash, admin_pin, security_question, security_answer)
      VALUES (${email}, ${pass}, ${pin}, ${question}, ${answer})
      ON CONFLICT (email) 
      DO UPDATE SET password_hash = ${pass}, admin_pin = ${pin}, security_question = ${question}, security_answer = ${answer};
    `;
    deviceLinkedEmail = email;
    localStorage.setItem("sms_linked_admin_email", deviceLinkedEmail);
    schoolConfig = { isConfigured: true, email, password: pass, adminPin: pin, securityQuestion: question, securityAnswer: answer };
    toast("Account Created & Device Linked!", "success");
    checkAuthFlow();
  } catch (err) {
    toast("Database save error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

$("switchAccountBtn").addEventListener("click", () => {
  if (confirm("Kya aap is device se account un-link karna chahte hain?")) {
    deviceLinkedEmail = null;
    localStorage.removeItem("sms_linked_admin_email");
    schoolConfig.isConfigured = false;
    currentSession = null;
    toast("Device unlinked.");
    checkAuthFlow();
  }
});

function setLoginTab(tab) {
  currentLoginTab = tab;
  $("userPinInput").value = "";
  $("tabAdminBtn").classList.toggle("active", tab === "admin");
  $("tabTeacherBtn").classList.toggle("active", tab === "teacher");
  $("teacherSelectWrap").classList.toggle("d-none", tab === "admin");
  $("pinSubtitle").textContent = tab === "admin" ? "Admin 4-digit PIN enter karein" : "Apna name select karein aur 4-digit PIN enter karein";
}

$("tabAdminBtn").addEventListener("click", () => setLoginTab("admin"));
$("tabTeacherBtn").addEventListener("click", () => setLoginTab("teacher"));

function refreshTeacherDropdown() {
  const sel = $("loginTeacherSelect");
  if (!sel) return;
  sel.innerHTML = teachers.map(t => `<option value="${t.id}">${esc(t.name)} (${esc(t.staffId)}) - ${esc(t.assignedClass || "")}</option>`).join("");
}

$("pinSubmitForm").addEventListener("submit", async e => {
  e.preventDefault();
  const enteredPin = $("userPinInput").value.trim();

  if (currentLoginTab === "admin") {
    if (enteredPin === schoolConfig.adminPin) {
      currentSession = { role: "admin", id: "admin", name: "Principal / Admin" };
      launchApp();
    } else {
      toast("Ghalat Admin PIN!", "danger");
      $("userPinInput").value = "";
    }
  } else {
    const teacherId = $("loginTeacherSelect").value;
    const t = teachers.find(x => x.id === teacherId);
    if (!t || t.pin !== enteredPin) {
      toast("Ghalat Teacher PIN!", "danger");
      $("userPinInput").value = "";
      return;
    }
    if (t.boundDeviceId && t.boundDeviceId !== currentDeviceId) {
      return toast("Proxy Alert: Ye account kisi doosre phone par registered hai!", "danger");
    }
    if (!t.boundDeviceId) {
      t.boundDeviceId = currentDeviceId;
      sql`UPDATE teachers SET bound_device_id = ${currentDeviceId} WHERE id = ${t.id}::uuid;`.catch(console.error);
    }
    currentSession = { role: "teacher", id: t.id, name: t.name, assignedClass: t.assignedClass, assignedSection: t.assignedSection };
    launchApp();
  }
});

/* ========================================================
   RECOVERY & SETTINGS
   ======================================================== */
function openRecovery() {
  $("pinLoginCard").classList.add("d-none");
  $("emailAuthCard").classList.add("d-none");
  $("recoveryCard").classList.remove("d-none");
  $("recStep1").classList.remove("d-none");
  $("recStep2Form").classList.add("d-none");
  $("recoveryTargetEmail").value = schoolConfig.email || deviceLinkedEmail || "";
}

$("forgotPinBtn").addEventListener("click", openRecovery);
$("forgotPinFromEmailBtn").addEventListener("click", openRecovery);
document.querySelectorAll(".cancel-rec-btn").forEach(btn => btn.addEventListener("click", checkAuthFlow));

$("verifyEmailBtn").addEventListener("click", async () => {
  const emailInput = $("recoveryTargetEmail").value.trim().toLowerCase();
  if (!emailInput) return toast("Email enter karein.", "warning");
  setBtnLoading($("verifyEmailBtn"), true, "Checking...");
  try {
    const res = await sql`SELECT * FROM school_config WHERE LOWER(email) = ${emailInput} LIMIT 1;`;
    if (!res || res.length === 0) return toast("Ye email registered nahi hai!", "danger");
    pendingRecoveryConfig = res[0];
    $("displayQuestion").textContent = pendingRecoveryConfig.security_question || "What is your secret code?";
    $("recoveryAnswerInput").value = "";
    $("resetNewPass").value = "";
    $("resetNewPin").value = "";
    $("recStep1").classList.add("d-none");
    $("recStep2Form").classList.remove("d-none");
  } catch (err) {
    toast("Database error: " + err.message, "danger");
  } finally {
    setBtnLoading($("verifyEmailBtn"), false);
  }
});

$("recStep2Form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!pendingRecoveryConfig) return toast("Session expired.", "danger");
  const enteredAnswer = $("recoveryAnswerInput").value.trim();
  const correctAnswer = (pendingRecoveryConfig.security_answer || "").trim();
  const newPassword = $("resetNewPass").value.trim();
  const newPin = $("resetNewPin").value.trim();

  if (enteredAnswer.toLowerCase() !== correctAnswer.toLowerCase()) return toast("Ghalat Security Answer!", "danger");
  if (newPin.length !== 4) return toast("Naya Admin PIN 4-digit ka hona chahiye.", "warning");

  const btn = e.target.querySelector("button[type=submit]");
  setBtnLoading(btn, true, "Resetting...");
  try {
    await sql`UPDATE school_config SET password_hash = ${newPassword}, admin_pin = ${newPin} WHERE email = ${pendingRecoveryConfig.email};`;
    schoolConfig.password = newPassword;
    schoolConfig.adminPin = newPin;
    deviceLinkedEmail = pendingRecoveryConfig.email;
    localStorage.setItem("sms_linked_admin_email", deviceLinkedEmail);
    toast("Password aur Admin PIN update ho gaya!", "success");
    pendingRecoveryConfig = null;
    checkAuthFlow();
  } catch (err) {
    toast("Update error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

$("lockScreenBtn").addEventListener("click", () => {
  currentSession = null;
  checkAuthFlow();
});

$("adminSecurityForm").addEventListener("submit", async e => {
  e.preventDefault();
  const curPass = $("curMasterPass").value;
  const newPass = $("newMasterPass").value.trim();
  const newPin = $("newAdminPin").value.trim();
  const newQ = $("curSecQuestion").value.trim();
  const newA = $("curSecAnswer").value.trim();

  if (newPin.length !== 4) return toast("PIN 4-digit ka hona chahiye.", "warning");
  if (curPass !== schoolConfig.password) return toast("Ghalat Master Password!", "danger");

  const btn = e.target.querySelector("button[type=submit]");
  setBtnLoading(btn, true, "Updating...");
  try {
    const updatedPass = newPass || curPass;
    await sql`UPDATE school_config SET password_hash = ${updatedPass}, admin_pin = ${newPin}, security_question = ${newQ}, security_answer = ${newA} WHERE email = ${schoolConfig.email};`;
    schoolConfig.adminPin = newPin;
    schoolConfig.password = updatedPass;
    schoolConfig.securityQuestion = newQ;
    schoolConfig.securityAnswer = newA;
    toast("Security Settings update ho gayin!", "success");
    $("curMasterPass").value = "";
    $("newMasterPass").value = "";
  } catch (err) {
    toast("Update error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

/* ========================================================
   APP DASHBOARD LAUNCH
   ======================================================== */
async function launchApp() {
  $("loginView").classList.add("d-none");
  $("appView").classList.remove("d-none");

  const isTeacher = currentSession.role === "teacher";
  const badge = $("roleBadge");
  badge.className = isTeacher ? "badge text-bg-info px-2 py-1 small fw-bold" : "badge text-bg-warning px-2 py-1 small fw-bold";
  badge.textContent = isTeacher ? `${currentSession.name} (${currentSession.assignedClass}-${currentSession.assignedSection})` : "Admin / Principal";

  $("navTeacherAtt").classList.toggle("d-none", isTeacher);
  $("navExport").classList.toggle("d-none", isTeacher);
  $("navGeoSettings").classList.toggle("d-none", isTeacher);
  $("navAdminSettings").classList.toggle("d-none", isTeacher);
  $("teacherSelfAttBar").classList.toggle("d-none", !isTeacher);

  const admCls = $("admitClass");
  const admSec = $("admitSection");
  if (isTeacher) {
    admCls.value = currentSession.assignedClass;
    admSec.value = currentSession.assignedSection;
    admCls.disabled = true;
    admSec.disabled = true;
    if ($("admitRoleNote")) $("admitRoleNote").textContent = `Locked to ${currentSession.assignedClass}-${currentSession.assignedSection}`;
    $("saClass").value = currentSession.assignedClass;
    $("saSection").value = currentSession.assignedSection;
    $("saClass").disabled = true;
    $("saSection").disabled = true;
  } else {
    admCls.disabled = false;
    admSec.disabled = false;
    if ($("admitRoleNote")) $("admitRoleNote").textContent = "";
    $("saClass").disabled = false;
    $("saSection").disabled = false;
  }

  const todayStr = today();
  ["dashDate", "saDate", "taDate", "exDay"].forEach(id => {
    if ($(id)) $(id).value = todayStr;
  });
  if ($("exMonth")) $("exMonth").value = todayStr.slice(0, 7);

  if (schoolGeo.lat) $("geoLat").value = schoolGeo.lat;
  if (schoolGeo.lng) $("geoLng").value = schoolGeo.lng;
  if (schoolGeo.radius) $("geoRadius").value = schoolGeo.radius;
  if ($("curSecQuestion")) $("curSecQuestion").value = schoolConfig.securityQuestion || "";
  if ($("curSecAnswer")) $("curSecAnswer").value = schoolConfig.securityAnswer || "";
  if ($("newAdminPin")) $("newAdminPin").value = schoolConfig.adminPin || "";

  syncThemeControls();
  fillStaticDropdowns();
  fillFilterSelects();
  renderDirectory();
  await Promise.all([renderTAtt(), renderSAtt(), refreshDash()]);
}

/* ========================================================
   TEACHER MANAGEMENT & ATTENDANCE
   ======================================================== */
$("teacherForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector("button[type=submit]");
  const formData = new FormData(f);

  const name = formData.get("name")?.trim();
  const staffId = formData.get("staffId")?.trim();
  const department = formData.get("department")?.trim() || "General";
  const assignedClass = formData.get("assignedClass") || "Class 1";
  const assignedSection = formData.get("assignedSection") || "A";
  const pin = formData.get("pin")?.trim();
  const phone = formData.get("phone")?.trim() || "";
  const email = formData.get("email")?.trim() || "";

  if (!name || !staffId) return toast("Name aur Staff ID lazmi hain.", "warning");
  if (!pin || pin.length !== 4) return toast("Teacher PIN 4-digit ka hona chahiye.", "warning");

  const id = generateUUID();
  setBtnLoading(btn, true, "Saving...");
  try {
    await sql`
      INSERT INTO teachers (id, name, staff_id, department, assigned_class, assigned_section, pin, phone, email, status, check_in, bound_device_id)
      VALUES (${id}::uuid, ${name}, ${staffId}, ${department}, ${assignedClass}, ${assignedSection}, ${pin}, ${phone}, ${email}, 'Absent', '--:--', NULL);
    `;
    teachers.push({ id, name, staffId, department, assignedClass, assignedSection, pin, phone, email, status: "Absent", checkIn: "--:--", boundDeviceId: null });
    toast(`Teacher ${name} add ho gaya!`, "success");
    f.reset();
    bootstrap.Modal.getInstance($("teacherModal"))?.hide();
    renderTAtt();
    refreshDash();
  } catch (err) {
    toast("Teacher add error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

async function renderTAtt() {
  const taBody = $("taBody");
  if (!taBody) return;
  if (!teachers.length) {
    taBody.innerHTML = `<tr><td colspan="8" class="empty">Koi teacher add nahi hai.</td></tr>`;
    return;
  }
  const dateVal = $("taDate")?.value || today();
  const dayData = await loadAttendanceForDate(dateVal);

  taBody.innerHTML = teachers.map(t => {
    const rec = dayData.teacher[t.id] || { status: "Absent", checkIn: "--:--" };
    return `<tr data-tid="${t.id}">
      <td><span class="badge bg-dark border border-secondary">${esc(t.staffId)}</span></td>
      <td><strong>${esc(t.name)}</strong><div class="small text-secondary">${esc(t.department || "General")}</div></td>
      <td><span class="badge bg-info text-dark">${esc(t.assignedClass)} - Sec ${esc(t.assignedSection)}</span></td>
      <td><span class="badge bg-dark text-warning px-2"><i class="bi bi-key-fill me-1"></i>${esc(t.pin || "----")}</span></td>
      <td>
        ${t.boundDeviceId
          ? `<span class="badge bg-success"><i class="bi bi-phone-fill me-1"></i>Bound</span> <button class="btn btn-sm btn-link text-warning p-0 ms-1 small" data-reset-dev="${t.id}">Reset</button>`
          : `<span class="badge bg-secondary">Unbound</span>`}
      </td>
      <td>
        <select class="form-select form-select-sm t-status" data-status-tid="${t.id}">
          ${STATUSES.map(st => `<option value="${st}" ${rec.status === st ? "selected" : ""}>${st}</option>`).join("")}
        </select>
      </td>
      <td><span class="badge ${rec.checkIn !== '--:--' ? 'bg-success' : 'bg-secondary'}">${esc(rec.checkIn)}</span></td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-warning me-1" data-edit-teacher="${t.id}"><i class="bi bi-pencil-square"></i> Edit</button>
        <button class="btn btn-sm btn-outline-danger" data-del-teacher="${t.id}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`;
  }).join("");
}

if ($("taBody")) {
  $("taBody").addEventListener("click", async e => {
    const delBtn = e.target.closest("[data-del-teacher]");
    const editBtn = e.target.closest("[data-edit-teacher]");
    const resetBtn = e.target.closest("[data-reset-dev]");

    if (resetBtn) {
      const resetDevTid = resetBtn.dataset.resetDev;
      const t = teachers.find(x => x.id === resetDevTid);
      if (t && confirm(`Kya aap ${t.name} ka device lock reset karna chahte hain?`)) {
        t.boundDeviceId = null;
        renderTAtt();
        await sql`UPDATE teachers SET bound_device_id = NULL WHERE id = ${t.id}::uuid;`;
        toast(`${t.name} ka device lock reset ho gaya.`);
      }
    }

    if (delBtn) {
      const delTid = delBtn.dataset.delTeacher;
      if (!confirm("Is teacher ko delete karna chahte hain?")) return;
      teachers = teachers.filter(t => t.id !== delTid);
      renderTAtt();
      refreshDash();
      await sql`DELETE FROM teachers WHERE id = ${delTid}::uuid;`;
      toast("Teacher record delete ho gaya.");
    }

    if (editBtn) {
      const editTid = editBtn.dataset.editTeacher;
      const t = teachers.find(x => x.id === editTid);
      if (!t) return;
      $("editTeacherId").value = t.id;
      $("editTName").value = t.name || "";
      $("editTStaffId").value = t.staffId || "";
      $("editTDept").value = t.department || "";
      $("editTClass").value = t.assignedClass || "Class 1";
      $("editTSection").value = t.assignedSection || "A";
      $("editTPin").value = t.pin || "";
      $("editTPhone").value = t.phone || "";
      $("editTEmail").value = t.email || "";
      new bootstrap.Modal($("editTeacherModal")).show();
    }
  });

  $("taBody").addEventListener("change", async e => {
    const statusTid = e.target.dataset.statusTid;
    if (!statusTid) return;
    const dateVal = $("taDate")?.value || today();
    const newStatus = e.target.value;
    const checkIn = newStatus === "Present" ? new Date().toTimeString().slice(0, 5) : "--:--";

    if (!attendanceCache[dateVal]) attendanceCache[dateVal] = { student: {}, teacher: {} };
    attendanceCache[dateVal].teacher[statusTid] = { status: newStatus, checkIn };

    renderTAtt();
    refreshDash();

    await sql`INSERT INTO attendance_logs (record_date, person_type, person_id, status, check_in_time) VALUES (${dateVal}, 'teacher', ${statusTid}, ${newStatus}, ${checkIn});`;
  });
}

$("editTeacherForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  const id = $("editTeacherId").value;
  const t = teachers.find(x => x.id === id);
  if (!t) return;

  t.name = $("editTName").value.trim();
  t.staffId = $("editTStaffId").value.trim();
  t.department = $("editTDept").value.trim();
  t.assignedClass = $("editTClass").value;
  t.assignedSection = $("editTSection").value;
  t.pin = $("editTPin").value.trim();
  t.phone = $("editTPhone").value.trim();
  t.email = $("editTEmail").value.trim();

  setBtnLoading(btn, true, "Updating...");
  try {
    await sql`UPDATE teachers SET name = ${t.name}, staff_id = ${t.staffId}, department = ${t.department}, assigned_class = ${t.assignedClass}, assigned_section = ${t.assignedSection}, pin = ${t.pin}, phone = ${t.phone}, email = ${t.email} WHERE id = ${id}::uuid;`;
    bootstrap.Modal.getInstance($("editTeacherModal"))?.hide();
    toast(`Teacher ${t.name} update ho gaya!`);
    renderTAtt();
  } catch (err) {
    toast("Update error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

/* ========================================================
   GEOFENCING & TEACHER PUNCH
   ======================================================== */
$("setSchoolLocationBtn").addEventListener("click", () => {
  if (!navigator.geolocation) return toast("Browser location support nahi karta.", "danger");
  toast("GPS Location detect ho rahi hai...", "info");
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const lat = parseFloat(pos.coords.latitude.toFixed(6));
      const lng = parseFloat(pos.coords.longitude.toFixed(6));
      $("geoLat").value = lat;
      $("geoLng").value = lng;
      schoolGeo.lat = lat;
      schoolGeo.lng = lng;
      await sql`INSERT INTO school_geofence (id, latitude, longitude, radius) VALUES (1, ${lat}, ${lng}, ${schoolGeo.radius || 150}) ON CONFLICT (id) DO UPDATE SET latitude = ${lat}, longitude = ${lng}, radius = ${schoolGeo.radius || 150};`;
      toast("Location save ho gayi!", "success");
    },
    err => toast(`GPS Error: ${err.message}`, "danger"),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

$("saveGeoBtn").addEventListener("click", async () => {
  const lat = parseFloat($("geoLat").value);
  const lng = parseFloat($("geoLng").value);
  const radius = parseInt($("geoRadius").value, 10) || 150;
  if (isNaN(lat) || isNaN(lng)) return toast("Valid Latitude/Longitude enter karein.", "warning");

  setBtnLoading($("saveGeoBtn"), true, "Saving...");
  try {
    schoolGeo = { lat, lng, radius };
    await sql`INSERT INTO school_geofence (id, latitude, longitude, radius) VALUES (1, ${lat}, ${lng}, ${radius}) ON CONFLICT (id) DO UPDATE SET latitude = ${lat}, longitude = ${lng}, radius = ${radius};`;
    toast("Geofence save ho gaya!", "success");
  } finally {
    setBtnLoading($("saveGeoBtn"), false);
  }
});

$("punchAttendanceBtn").addEventListener("click", () => {
  if (!schoolGeo.lat || !schoolGeo.lng) return toast("Admin ne GPS center set nahi kiya.", "warning");
  if (!navigator.geolocation) return toast("Device GPS support nahi karta.", "danger");

  $("teacherGeoStatus").textContent = "GPS verify ho rahi hai...";
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const distance = calculateDistanceMeters(schoolGeo.lat, schoolGeo.lng, pos.coords.latitude, pos.coords.longitude);
      if (distance <= schoolGeo.radius) {
        const currentTime = new Date().toTimeString().slice(0, 5);
        const todayStr = today();
        if (!attendanceCache[todayStr]) attendanceCache[todayStr] = { student: {}, teacher: {} };
        attendanceCache[todayStr].teacher[currentSession.id] = { status: "Present", checkIn: currentTime };

        await sql`INSERT INTO attendance_logs (record_date, person_type, person_id, status, check_in_time) VALUES (${todayStr}, 'teacher', ${currentSession.id}, 'Present', ${currentTime});`;
        $("teacherGeoStatus").innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check-circle-fill me-1"></i>Verified: Hazri lag chuki hai at ${currentTime}!</span>`;
        toast(`Hazri lag gayi at ${currentTime}.`, "success");
        renderTAtt();
        refreshDash();
      } else {
        $("teacherGeoStatus").innerHTML = `<span class="text-danger fw-bold"><i class="bi bi-x-circle-fill me-1"></i>Rejected: Aap school se ${distance}m door hain.</span>`;
        toast(`Hazri nahi lagi! Aap ${distance}m door hain.`, "danger");
      }
    },
    err => toast(`Location error: ${err.message}`, "danger"),
    { enableHighAccuracy: true, timeout: 12000 }
  );
});

/* ========================================================
   STUDENT ADMISSION & DIRECTORY
   ======================================================== */
$("admitDob").addEventListener("input", e => {
  const age = getAge(e.target.value);
  if (age !== null && age < 4) {
    $("calcAgeText").textContent = `${age} years old`;
    $("ageWarning").classList.remove("d-none");
  } else {
    $("ageWarning").classList.add("d-none");
  }
});

$("admitForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  if (!f.checkValidity()) {
    f.classList.add("was-validated");
    return toast("Please required fields fill karein.", "warning");
  }
  const btn = $("admitBtn");
  const data = Object.fromEntries(new FormData(f));
  data.id = generateUUID();

  if (currentSession && currentSession.role === "teacher") {
    data.class = currentSession.assignedClass;
    data.section = currentSession.assignedSection;
  }

  const fileInput = $("bFormFile");
  if (fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    data.hasBForm = true;
    data.bFormUrl = URL.createObjectURL(file);
    data.bFormType = file.type;
  } else {
    data.hasBForm = false;
    data.bFormUrl = null;
    data.bFormType = null;
  }

  setBtnLoading(btn, true, "Admitting...");
  try {
    await sql`
      INSERT INTO students (id, full_name, father_name, roll_number, class, section, phone, dob, b_form_number, has_b_form, b_form_url, b_form_type, address)
      VALUES (${data.id}::uuid, ${data.fullName}, ${data.fatherName}, ${data.rollNumber}, ${data.class}, ${data.section}, ${data.phone}, ${data.dob || null}, ${data.bFormNumber || ""}, ${data.hasBForm}, ${data.bFormUrl || null}, ${data.bFormType || null}, ${data.address});
    `;
    students.push(data);
    toast("Student record save ho gaya!");
    f.reset();
    $("ageWarning")?.classList.add("d-none");
    f.classList.remove("was-validated");
    renderDirectory();
    renderSAtt();
    refreshDash();
  } catch (err) {
    toast("Student admission error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

function renderDirectory() {
  const q = ($("searchBox")?.value || "").trim().toLowerCase();
  const ageFilter = $("filterAge")?.value || "all";

  const list = students.filter(s => {
    if (currentSession && currentSession.role === "teacher") {
      if (s.class !== currentSession.assignedClass || s.section !== currentSession.assignedSection) return false;
    }
    const matchText = !q || [s.fullName, s.rollNumber, s.bFormNumber, s.class].some(v => String(v ?? "").toLowerCase().includes(q));
    const age = getAge(s.dob);
    let matchAge = true;
    if (ageFilter === "under4") matchAge = (age !== null && age < 4);
    else if (ageFilter === "4to6") matchAge = (age !== null && age >= 4 && age <= 6);
    else if (ageFilter === "7to10") matchAge = (age !== null && age >= 7 && age <= 10);
    else if (ageFilter === "above10") matchAge = (age !== null && age >= 11);
    return matchText && matchAge;
  });

  const dirBody = $("dirBody");
  if (!dirBody) return;

  dirBody.innerHTML = list.length ? list.map(s => {
    const age = getAge(s.dob);
    const isUnderage = age !== null && age < 4;
    return `<tr>
      <td><strong>${esc(s.fullName)}</strong>${isUnderage ? `<span class="badge bg-warning text-dark ms-1">&lt; 4 yrs</span>` : ""}</td>
      <td>${esc(s.fatherName)}</td>
      <td><span class="badge bg-secondary">${esc(s.rollNumber)}</span></td>
      <td>${age !== null ? `<strong>${age} yrs</strong>` : "-"}<div class="small text-secondary">${esc(s.dob || "")}</div></td>
      <td>${esc(s.class)} - ${esc(s.section)}</td>
      <td>${esc(s.phone)}</td>
      <td>${s.hasBForm ? `<button class="btn btn-sm btn-outline-info" data-view="${s.id}"><i class="bi bi-file-earmark-text me-1"></i>View</button>` : `<span class="text-secondary small">Pending</span>`}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-warning me-1" data-edit="${s.id}"><i class="bi bi-pencil-square"></i> Edit</button>
        <button class="btn btn-sm btn-outline-danger" data-del="${s.id}"><i class="bi bi-trash"></i></button>
      </td></tr>`;
  }).join("") : `<tr><td colspan="8" class="empty">Koi student nahi mila.</td></tr>`;
}

$("searchBox").addEventListener("input", renderDirectory);
$("filterAge").addEventListener("change", renderDirectory);

if ($("dirBody")) {
  $("dirBody").addEventListener("click", async e => {
    const delBtn = e.target.closest("[data-del]");
    const editBtn = e.target.closest("[data-edit]");
    const viewBtn = e.target.closest("[data-view]");

    if (viewBtn) {
      const viewId = viewBtn.dataset.view;
      const s = students.find(x => x.id === viewId);
      if (!s || !s.hasBForm) return;
      currentViewStudent = s;
      $("viewBFormTitle").textContent = `${s.fullName} - B-Form Document`;
      const container = $("viewBFormBody");
      const fileUrl = s.bFormUrl || createSampleDoc(s.fullName, s.bFormNumber || "N/A");

      if (s.bFormType === "application/pdf") {
        container.innerHTML = `<iframe src="${fileUrl}" style="width:100%; height:450px; border:none;"></iframe>`;
        $("downloadBFormBtn").innerHTML = `<i class="bi bi-download me-1"></i>Download PDF`;
      } else {
        container.innerHTML = `<img id="previewBFormImg" src="${fileUrl}" class="img-fluid rounded" style="max-height: 400px; width: auto;" alt="B-Form">`;
        $("downloadBFormBtn").innerHTML = `<i class="bi bi-download me-1"></i>Download PNG`;
      }
      new bootstrap.Modal($("viewBFormModal")).show();
    }

    if (delBtn) {
      const delId = delBtn.dataset.del;
      if (!confirm("Is student ko delete karna chahte hain?")) return;
      students = students.filter(x => x.id !== delId);
      renderDirectory();
      refreshDash();
      await sql`DELETE FROM students WHERE id = ${delId}::uuid;`;
      toast("Student delete kar diya gaya.");
    }

    if (editBtn) {
      const editId = editBtn.dataset.edit;
      const s = students.find(x => x.id === editId);
      if (!s) return;
      $("editStudentId").value = s.id;
      $("editFullName").value = s.fullName || "";
      $("editFatherName").value = s.fatherName || "";
      $("editRollNumber").value = s.rollNumber || "";
      $("editClass").value = s.class || "";
      $("editSection").value = s.section || "";
      $("editDob").value = s.dob || "";
      $("editPhone").value = s.phone || "";
      $("editBFormNumber").value = s.bFormNumber || "";
      $("currentBFormStatus").textContent = s.hasBForm ? "Status: B-Form file attached." : "Status: B-Form pending.";
      new bootstrap.Modal($("editStudentModal")).show();
    }
  });
}

$("downloadBFormBtn").addEventListener("click", () => {
  if (!currentViewStudent) return;
  const cleanName = currentViewStudent.fullName.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileUrl = currentViewStudent.bFormUrl || createSampleDoc(currentViewStudent.fullName, currentViewStudent.bFormNumber || "N/A");

  if (currentViewStudent.bFormType === "application/pdf") {
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = `${cleanName}_BForm.pdf`;
    a.click();
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 500;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${cleanName}_BForm.png`;
    a.click();
    toast("B-Form PNG download ho gaya!");
  };
  img.src = fileUrl;
});

$("editStudentForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  const id = $("editStudentId").value;
  const s = students.find(x => x.id === id);
  if (!s) return;

  s.fullName = $("editFullName").value;
  s.fatherName = $("editFatherName").value;
  s.rollNumber = $("editRollNumber").value;
  s.class = $("editClass").value;
  s.section = $("editSection").value;
  s.dob = $("editDob").value;
  s.phone = $("editPhone").value;
  s.bFormNumber = $("editBFormNumber").value;

  const fileInput = $("editBFormFile");
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    s.hasBForm = true;
    s.bFormUrl = URL.createObjectURL(file);
    s.bFormType = file.type;
  }

  setBtnLoading(btn, true, "Updating...");
  try {
    await sql`UPDATE students SET full_name = ${s.fullName}, father_name = ${s.fatherName}, roll_number = ${s.rollNumber}, class = ${s.class}, section = ${s.section}, dob = ${s.dob || null}, phone = ${s.phone}, b_form_number = ${s.bFormNumber}, has_b_form = ${s.hasBForm}, b_form_url = ${s.bFormUrl}, b_form_type = ${s.bFormType}, address = ${s.address} WHERE id = ${id}::uuid;`;
    bootstrap.Modal.getInstance($("editStudentModal"))?.hide();
    toast("Student record update ho gaya!");
    renderDirectory();
    renderSAtt();
    refreshDash();
  } catch (err) {
    toast("Update error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

/* ========================================================
   STUDENT ATTENDANCE (FAST PARALLEL SAVE + REAL DATE LOAD)
   ======================================================== */
const classStudents = () => {
  const c = $("saClass")?.value;
  const s = $("saSection")?.value;
  return students.filter(st => (!c || st.class === c) && (!s || st.section === s));
};

async function renderSAtt() {
  const saBody = $("saBody");
  if (!saBody) return;
  const list = classStudents();
  if (!list.length) {
    saBody.innerHTML = `<tr><td colspan="3" class="empty">Is class/section mein koi student nahi hai.</td></tr>`;
    return;
  }
  const dateVal = $("saDate")?.value || today();
  const dayData = await loadAttendanceForDate(dateVal);

  const L = { Present: "lP", Absent: "lA", Late: "lL", Leave: "lV" };
  saBody.innerHTML = list.map(s => {
    const savedStatus = dayData.student[s.id] || "Present";
    return `<tr>
      <td>${esc(s.rollNumber)}</td>
      <td><strong>${esc(s.fullName)}</strong></td>
      <td><div class="att-radio">
        ${STATUSES.map(st => `<input type="radio" name="st_${s.id}" id="st_${s.id}_${st}" value="${st}" ${st === savedStatus ? "checked" : ""}><label class="${L[st]}" for="st_${s.id}_${st}">${st}</label>`).join("")}
      </div></td></tr>`;
  }).join("");
}

["saDate", "saClass", "saSection"].forEach(id => {
  if ($(id)) $(id).addEventListener("change", renderSAtt);
});

$("saAllBtn").addEventListener("click", () => {
  document.querySelectorAll('#saBody input[value="Present"]').forEach(r => r.checked = true);
});

$("saSaveBtn").addEventListener("click", async () => {
  const btn = $("saSaveBtn");
  const dateVal = $("saDate").value || today();
  const list = classStudents();
  if (!list.length) return;

  setBtnLoading(btn, true, "Saving...");
  try {
    if (!attendanceCache[dateVal]) attendanceCache[dateVal] = { student: {}, teacher: {} };

    await Promise.all(list.map(st => {
      const checked = document.querySelector(`input[name="st_${st.id}"]:checked`);
      const status = checked ? checked.value : "Present";
      attendanceCache[dateVal].student[st.id] = status;
      return sql`INSERT INTO attendance_logs (record_date, person_type, person_id, status) VALUES (${dateVal}, 'student', ${st.id}, ${status});`;
    }));

    toast("Student attendance save ho gayi!");
    refreshDash();
  } catch (err) {
    toast("Save error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

$("taDate").addEventListener("change", renderTAtt);
$("taSaveBtn").addEventListener("click", async () => {
  const btn = $("taSaveBtn");
  const dateVal = $("taDate").value || today();
  if (!teachers.length) return;

  setBtnLoading(btn, true, "Saving...");
  try {
    if (!attendanceCache[dateVal]) attendanceCache[dateVal] = { student: {}, teacher: {} };
    await Promise.all(teachers.map(t => {
      const sel = document.querySelector(`select[data-status-tid="${t.id}"]`);
      const status = sel ? sel.value : "Absent";
      const prev = attendanceCache[dateVal].teacher[t.id];
      const checkIn = status === "Present" ? (prev?.checkIn && prev.checkIn !== "--:--" ? prev.checkIn : new Date().toTimeString().slice(0, 5)) : "--:--";
      attendanceCache[dateVal].teacher[t.id] = { status, checkIn };
      return sql`INSERT INTO attendance_logs (record_date, person_type, person_id, status, check_in_time) VALUES (${dateVal}, 'teacher', ${t.id}, ${status}, ${checkIn});`;
    }));
    toast("Teacher attendance save ho gayi!");
    renderTAtt();
    refreshDash();
  } catch (err) {
    toast("Save error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

/* ========================================================
   DASHBOARD (SHOWS REAL SELECTED/TODAY DATE RECORDS)
   ======================================================== */
async function refreshDash(forceRefresh = false) {
  const dateVal = $("dashDate")?.value || today();
  const cls = $("dashClass")?.value;
  const sec = $("dashSection")?.value;

  const dayData = await loadAttendanceForDate(dateVal, forceRefresh);

  const scope = students.filter(s => {
    if (currentSession && currentSession.role === "teacher") {
      return s.class === currentSession.assignedClass && s.section === currentSession.assignedSection;
    }
    return (!cls || s.class === cls) && (!sec || s.section === sec);
  });

  let present = 0, absent = 0, late = 0, leave = 0;
  const absentees = [];

  for (const s of scope) {
    const st = dayData.student[s.id];
    if (st === "Present") present++;
    else if (st === "Late") late++;
    else if (st === "Leave") leave++;
    else if (st === "Absent") {
      absent++;
      absentees.push(s);
    }
  }

  const markedTotal = present + absent + late + leave;
  const rate = markedTotal > 0 ? Math.round(((present + late) / markedTotal) * 100) : 0;
  const presentTeachers = teachers.filter(t => dayData.teacher[t.id]?.status === "Present").length;

  if ($("kStudents")) $("kStudents").textContent = scope.length;
  if ($("kTeachers")) $("kTeachers").textContent = teachers.length;
  if ($("kRate")) $("kRate").textContent = markedTotal > 0 ? `${rate}%` : "Not Marked";
  if ($("kTeachAtt")) $("kTeachAtt").textContent = `${presentTeachers} / ${teachers.length}`;

  if ($("attBar")) {
    if (markedTotal === 0) {
      $("attBar").innerHTML = `<div class="progress-bar bg-secondary" style="width:100%">Is date (${dateVal}) ki attendance abhi mark nahi hui</div>`;
    } else {
      const pPct = (present / markedTotal) * 100;
      const lPct = (late / markedTotal) * 100;
      const vPct = (leave / markedTotal) * 100;
      const aPct = (absent / markedTotal) * 100;
      $("attBar").innerHTML = `
        <div class="progress-bar bg-success" style="width:${pPct}%"></div>
        <div class="progress-bar bg-warning" style="width:${lPct}%"></div>
        <div class="progress-bar bg-primary" style="width:${vPct}%"></div>
        <div class="progress-bar bg-danger" style="width:${aPct}%"></div>`;
    }
  }

  if ($("attLegend")) {
    $("attLegend").innerHTML = `
      <span><span class="badge-s b-Present">Present</span> ${present}</span>
      <span><span class="badge-s b-Absent">Absent</span> ${absent}</span>
      <span><span class="badge-s b-Late">Late</span> ${late}</span>
      <span><span class="badge-s b-Leave">Leave</span> ${leave}</span>`;
  }

  if ($("absCount")) $("absCount").textContent = absentees.length;
  if ($("absList")) {
    $("absList").innerHTML = absentees.length > 0
      ? `<table class="table table-sm align-middle"><tbody>
          ${absentees.map(s => `<tr><td><strong>${esc(s.fullName)}</strong></td><td>${esc(s.class)} - ${esc(s.section)}</td><td>${esc(s.phone)}</td></tr>`).join("")}
         </tbody></table>`
      : `<div class="empty">Is date (${dateVal}) par koi absentee nahi hai.</div>`;
  }
}

["dashDate", "dashClass", "dashSection"].forEach(id => {
  if ($(id)) $(id).addEventListener("change", () => refreshDash(false));
});

if ($("refreshDashBtn")) {
  $("refreshDashBtn").addEventListener("click", async () => {
    setBtnLoading($("refreshDashBtn"), true, "Refreshing...");
    await refreshDash(true);
    setBtnLoading($("refreshDashBtn"), false);
    toast("Dashboard updated!");
  });
}

/* ========================================================
   REAL CSV ATTENDANCE EXPORT (DAILY & MONTHLY)
   ======================================================== */
$("exMode").addEventListener("change", () => {
  const m = $("exMode").value === "monthly";
  if ($("exMonth")) $("exMonth").classList.toggle("d-none", !m);
  if ($("exDay")) $("exDay").classList.toggle("d-none", m);
});

$("exBtn").addEventListener("click", async () => {
  const btn = $("exBtn");
  const type = $("exType").value;
  const mode = $("exMode").value;
  const dayVal = $("exDay").value || today();
  const monthVal = $("exMonth").value || today().slice(0, 7);

  setBtnLoading(btn, true, "Exporting...");
  try {
    let rows = [];
    if (mode === "daily") {
      rows = await sql`
        SELECT record_date, person_id, status, check_in_time 
        FROM attendance_logs 
        WHERE person_type = ${type} AND record_date = ${dayVal}
        ORDER BY record_date, id ASC;
      `;
    } else {
      const start = `${monthVal}-01`;
      rows = await sql`
        SELECT record_date, person_id, status, check_in_time 
        FROM attendance_logs 
        WHERE person_type = ${type} 
          AND record_date >= ${start}::date 
          AND record_date < (${start}::date + INTERVAL '1 month')
        ORDER BY record_date, id ASC;
      `;
    }

    if (!rows.length) {
      return toast("Is date/month ka koi attendance record nahi mila.", "warning");
    }

    const latest = new Map();
    for (const r of rows) {
      const d = String(r.record_date).slice(0, 10);
      latest.set(`${d}_${r.person_id}`, { date: d, id: String(r.person_id), status: r.status, checkIn: r.check_in_time || "" });
    }

    const csvLines = [];
    if (type === "student") {
      csvLines.push("Date,Roll Number,Student Name,Class,Section,Status");
      for (const rec of latest.values()) {
        const st = students.find(s => s.id === rec.id);
        csvLines.push([
          rec.date,
          `"${(st?.rollNumber || "").replace(/"/g, '""')}"`,
          `"${(st?.fullName || "Unknown").replace(/"/g, '""')}"`,
          `"${(st?.class || "").replace(/"/g, '""')}"`,
          `"${(st?.section || "").replace(/"/g, '""')}"`,
          rec.status
        ].join(","));
      }
    } else {
      csvLines.push("Date,Staff ID,Teacher Name,Assigned Class,Status,Check-In");
      for (const rec of latest.values()) {
        const t = teachers.find(x => x.id === rec.id);
        csvLines.push([
          rec.date,
          `"${(t?.staffId || "").replace(/"/g, '""')}"`,
          `"${(t?.name || "Unknown").replace(/"/g, '""')}"`,
          `"${(t ? `${t.assignedClass}-${t.assignedSection}` : "").replace(/"/g, '""')}"`,
          rec.status,
          rec.checkIn
        ].join(","));
      }
    }

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `GGPS_Sawarcup_${type}_attendance_${mode === "daily" ? dayVal : monthVal}.csv`;
    a.click();
    toast("CSV file download ho gayi!", "success");
  } catch (err) {
    toast("Export error: " + err.message, "danger");
  } finally {
    setBtnLoading(btn, false);
  }
});

// Initialize Theme Studio & Load Neon Data
setupThemeStudioListeners();
loadDataFromNeon();