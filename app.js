import { neon } from 'https://esm.sh/@neondatabase/serverless@0.9.0';

// ========================================================
// DIRECT NEON POSTGRES CONNECTION
// ========================================================
const NEON_CONN_STRING = "postgresql://neondb_owner:npg_Pp7ZIAD6lOdm@ep-rapid-darkness-bekuo4wo-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(NEON_CONN_STRING);

const STORE_KEY = "ggps_sawarcup_db_v15";

const CLASSES = [
  "Nursery", "Prep", "Class 1", "Class 2", "Class 3",
  "Class 4", "Class 5", "Class 6", "Class 7", "Class 8",
  "Class 9", "Class 10"
];

const SECTIONS = ["A", "B", "C", "D"];

const PUNJAB_SUBJECTS = {
  early: ["English", "Urdu", "Mathematics", "Islamiyat / Nazra", "General Knowledge", "Drawing / Art"],
  primary: ["English", "Urdu", "Mathematics", "General Knowledge", "Islamiyat", "Social Studies", "General Science", "Computer Science"],
  middle: ["English", "Urdu", "Mathematics", "General Science", "Islamiyat", "History & Geography", "Computer Science", "Arabic / Drawing"],
  high: ["English", "Urdu", "Mathematics", "Islamiyat (Compulsory)", "Pakistan Studies", "Physics", "Chemistry", "Biology / Computer Science"]
};

const BODY_PRESETS = [
  { name: "Midnight Ocean", type: "gradient", c1: "#071118", c2: "#0d2230", dir: "135deg" },
  { name: "Emerald Forest", type: "gradient", c1: "#061a15", c2: "#0f3d32", dir: "135deg" },
  { name: "Royal Navy", type: "gradient", c1: "#090d24", c2: "#162354", dir: "135deg" },
  { name: "Deep Plum", type: "gradient", c1: "#180921", c2: "#361447", dir: "135deg" },
  { name: "Warm Charcoal", type: "solid", c1: "#121619", c2: "#121619", dir: "135deg" },
  { name: "Teal Dusk", type: "gradient", c1: "#081c24", c2: "#134e5e", dir: "180deg" }
];

const LOGIN_PRESETS = [
  { name: "Teal Radial", type: "gradient", c1: "#133b4a", c2: "#071118", dir: "radial" },
  { name: "Golden Dawn", type: "gradient", c1: "#2c220c", c2: "#09151e", dir: "135deg" },
  { name: "Cyber Blue", type: "gradient", c1: "#0b2948", c2: "#06111c", dir: "135deg" },
  { name: "Emerald Glow", type: "gradient", c1: "#0c3b2e", c2: "#061410", dir: "radial" },
  { name: "Deep Indigo", type: "gradient", c1: "#1e1b4b", c2: "#090d16", dir: "135deg" },
  { name: "Classic Dark", type: "solid", c1: "#0b1920", c2: "#0b1920", dir: "135deg" }
];

const DEFAULT_RC_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d1b3e"/>
      <stop offset="100%" stop-color="#19346e"/>
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="95" fill="#ffffff" stroke="#0d1b3e" stroke-width="6"/>
  <circle cx="100" cy="100" r="84" fill="none" stroke="#84bd22" stroke-width="4" stroke-dasharray="6 4"/>
  <circle cx="100" cy="100" r="74" fill="url(#g1)"/>
  <path d="M55,112 Q100,92 145,112 L145,134 Q100,114 55,134 Z" fill="#ffffff"/>
  <path d="M100,97 L100,126" stroke="#0d1b3e" stroke-width="3"/>
  <polygon points="100,44 106,60 123,60 109,70 114,86 100,76 86,86 91,70 77,60 94,60" fill="#f5b700"/>
  <text x="100" y="154" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#84bd22" text-anchor="middle">GGPS SAWARCUP</text>
</svg>
`)}`;

const DEFAULT_THEME = {
  bodyType: "gradient",
  bodyC1: "#071118",
  bodyC2: "#0d2230",
  bodyDir: "135deg",
  loginType: "gradient",
  loginC1: "#133b4a",
  loginC2: "#071118",
  loginDir: "radial",
  loginImg: "",
  loginOverlay: 45
};

let db = loadLocalDB();
let session = { role: null, teacherId: null };
let currentBFormData = { url: "", name: "" };
let pendingRecoveryEmail = "";
let activeNeonTable = "school_store";

function defaultDB() {
  return {
    account: null,
    students: [],
    teachers: [
      {
        id: "t_default_1",
        staffId: "T-01",
        name: "Ayesha Bibi",
        department: "Primary",
        assignedClass: "Class 1",
        assignedSection: "A",
        pin: "1234",
        phone: "0300-0000000",
        email: "",
        deviceId: ""
      }
    ],
    studentAttendance: {},
    teacherAttendance: {},
    marks: {},
    reportMeta: {},
    geofence: { lat: "", lng: "", radius: 150 },
    theme: { ...DEFAULT_THEME }
  };
}

function loadLocalDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaultDB(),
        ...parsed,
        geofence: { ...defaultDB().geofence, ...(parsed.geofence || {}) },
        theme: { ...DEFAULT_THEME, ...(parsed.theme || {}) }
      };
    }
  } catch (e) {}
  return defaultDB();
}

// ========================================================
// NEON CLOUD DATABASE SYNC (LOAD & SAVE)
// ========================================================
async function initNeonSync() {
  try {
    showToast("Neon Cloud Database se data sync ho raha hai...", "info");

    // 1. Check existing tables in Neon to recover any previous data automatically
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const tableNames = tables.map((t) => t.table_name);

    let loadedFromNeon = false;

    for (const tName of tableNames) {
      try {
        const rows = await sql(`SELECT * FROM "${tName}" LIMIT 5`);
        if (rows && rows.length > 0) {
          for (const row of rows) {
            const candidate = row.data || row.payload || row.state || row.json_data || row.value;
            const parsed = typeof candidate === "string" ? JSON.parse(candidate) : candidate;
            if (parsed && typeof parsed === "object" && (parsed.account || Array.isArray(parsed.students))) {
              db = {
                ...defaultDB(),
                ...parsed,
                geofence: { ...defaultDB().geofence, ...(parsed.geofence || {}) },
                theme: { ...DEFAULT_THEME, ...(parsed.theme || {}) }
              };
              activeNeonTable = tName;
              loadedFromNeon = true;
              break;
            }
          }
        }
      } catch (e) {}
      if (loadedFromNeon) break;
    }

    // 2. Ensure standard key-value store table exists in Neon
    if (!loadedFromNeon) {
      await sql`
        CREATE TABLE IF NOT EXISTS school_store (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      const existing = await sql`SELECT data FROM school_store WHERE id = 'main_db' LIMIT 1`;
      if (existing.length > 0 && existing[0].data) {
        const parsed = typeof existing[0].data === "string" ? JSON.parse(existing[0].data) : existing[0].data;
        db = {
          ...defaultDB(),
          ...parsed,
          geofence: { ...defaultDB().geofence, ...(parsed.geofence || {}) },
          theme: { ...DEFAULT_THEME, ...(parsed.theme || {}) }
        };
        loadedFromNeon = true;
      } else if (db.account || db.students.length > 0) {
        await saveNeonDB();
      }
    }

    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    applyThemeToDOM(db.theme);

    if (db.account && !session.role) {
      showAuthCard("pinLoginCard");
      populateTeacherLoginDropdown();
    }
    refreshAllViews();

    if (loadedFromNeon) {
      showToast("Neon Cloud se purana record load ho gaya!", "success");
    }
  } catch (err) {
    console.error("Neon Sync Error:", err);
    showToast("Neon Cloud offline hai — Local mode active hai.", "warning");
  }
}

async function saveNeonDB() {
  try {
    const jsonStr = JSON.stringify(db);
    if (activeNeonTable === "school_store") {
      await sql`
        INSERT INTO school_store (id, data, updated_at)
        VALUES ('main_db', ${jsonStr}::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `;
    } else {
      await sql(`UPDATE "${activeNeonTable}" SET data = $1::jsonb`, [jsonStr]);
    }
  } catch (err) {
    console.error("Neon Save Error:", err);
  }
}

function saveDB() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch (e) {}
  saveNeonDB();
}

// ========================================================
// UTILITY HELPERS
// ========================================================
const $ = (id) => document.getElementById(id);

function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg, type = "warning") {
  const container = $("toasts");
  if (!container) return;
  const el = document.createElement("div");
  const bgClass =
    type === "success" ? "text-bg-success" :
    type === "danger" ? "text-bg-danger" :
    type === "info" ? "text-bg-info" : "text-bg-warning";
  el.className = `toast align-items-center ${bgClass} border-0 show mb-2`;
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fw-semibold">${esc(msg)}</div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function formatBFormDigits(val) {
  const digits = String(val || "").replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

function calcAgeDetails(dobStr) {
  if (!dobStr) return { years: 0, text: "-" };
  const dob = new Date(dobStr);
  const now = new Date();
  if (isNaN(dob.getTime())) return { years: 0, text: "-" };
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  if (now.getDate() < dob.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 0) return { years: 0, text: "0 yrs" };
  return { years, text: `${years}y ${months}m` };
}

function getDeviceFingerprint() {
  let id = localStorage.getItem("ggps_device_fp");
  if (!id) {
    id = "DEV-" + Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
    localStorage.setItem("ggps_device_fp", id);
  }
  return id;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getActiveTeacher() {
  if (session.role !== "teacher" || !session.teacherId) return null;
  return db.teachers.find((t) => t.id === session.teacherId) || null;
}

// ========================================================
// INITIALIZATION
// ========================================================
document.addEventListener("DOMContentLoaded", async () => {
  populateDropdowns();
  setDefaultDates();
  applyThemeToDOM(db.theme);
  initThemeStudio();
  initAuthSystem();
  initBFormAutoDash();
  initAdmission();
  initDirectory();
  initStudentAttendance();
  initMarksAndReportCard();
  initTeacherManagement();
  initGeofence();
  initSecuritySettings();
  initExportCSV();
  initPasswordToggles();

  window.addEventListener("resize", () => applyThemeToDOM(db.theme));

  const rcLogo = $("rcSchoolLogoImg");
  if (rcLogo) {
    rcLogo.src = DEFAULT_RC_LOGO_SVG;
  }

  // Pull live data & background theme from Neon Cloud
  await initNeonSync();
});

function populateDropdowns() {
  document.querySelectorAll(".std-class-sel").forEach((sel) => {
    sel.innerHTML = CLASSES.map((c) => `<option value="${c}">${c}</option>`).join("");
  });
  document.querySelectorAll(".std-sec-sel").forEach((sel) => {
    sel.innerHTML = SECTIONS.map((s) => `<option value="${s}">${s}</option>`).join("");
  });

  ["dashClass", "mkClassFilter"].forEach((id) => {
    const el = $(id);
    if (el) el.innerHTML = `<option value="">All Classes</option>` + CLASSES.map((c) => `<option value="${c}">${c}</option>`).join("");
  });

  ["dashSection", "mkSectionFilter"].forEach((id) => {
    const el = $(id);
    if (el) el.innerHTML = `<option value="">All Sections</option>` + SECTIONS.map((s) => `<option value="${s}">${s}</option>`).join("");
  });

  if ($("saClass")) $("saClass").innerHTML = CLASSES.map((c) => `<option value="${c}">${c}</option>`).join("");
  if ($("saSection")) $("saSection").innerHTML = SECTIONS.map((s) => `<option value="${s}">${s}</option>`).join("");
}

function setDefaultDates() {
  const t = todayStr();
  ["dashDate", "saDate", "taDate", "exDay"].forEach((id) => {
    if ($(id)) $(id).value = t;
  });
  if ($("exMonth")) $("exMonth").value = t.slice(0, 7);
}

function initPasswordToggles() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-eye");
    if (!btn) return;
    const input = $(btn.dataset.target);
    if (!input) return;
    const isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    const icon = btn.querySelector("i");
    if (icon) {
      icon.className = isPass ? "bi bi-eye-slash-fill text-info" : "bi bi-eye-fill text-warning";
    }
  });
}

// ========================================================
// AUTHENTICATION & LOCK SCREEN
// ========================================================
function initAuthSystem() {
  if (!db.account) {
    showAuthCard("emailAuthCard");
    switchEmailTab("register");
  } else {
    showAuthCard("pinLoginCard");
    populateTeacherLoginDropdown();
  }

  $("tabEmailLoginBtn")?.addEventListener("click", () => switchEmailTab("login"));
  $("tabEmailRegisterBtn")?.addEventListener("click", () => switchEmailTab("register"));

  $("setupForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("setupEmail").value.trim().toLowerCase();
    const password = $("setupPass").value.trim();
    const pin = $("setupPin").value.trim();
    const question = $("setupQuestion").value.trim();
    const answer = $("setupAnswer").value.trim().toLowerCase();

    if (!/^\d{4}$/.test(pin)) {
      return showToast("PIN sirf 4 digits (numbers) ka hona chahiye.", "danger");
    }
    db.account = { email, password, pin, question, answer };
    saveDB();
    showToast("School Account & 4-Digit PIN Neon Cloud mein save ho gaya!", "success");
    unlockDashboard("admin", null);
  });

  $("emailLoginForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!db.account) {
      return showToast("Pehle Create Account tab se account banayein.", "danger");
    }
    const email = $("loginEmailInput").value.trim().toLowerCase();
    const pass = $("loginPassInput").value.trim();
    if (email === db.account.email && pass === db.account.password) {
      showToast("Login successful!", "success");
      unlockDashboard("admin", null);
    } else {
      showToast("Email ya Master Password ghalat hai.", "danger");
    }
  });

  let pinMode = "admin";
  $("tabAdminBtn")?.addEventListener("click", () => {
    pinMode = "admin";
    $("tabAdminBtn").classList.add("active");
    $("tabTeacherBtn").classList.remove("active");
    $("teacherSelectWrap").classList.add("d-none");
    $("pinSubtitle").textContent = "Admin 4-digit PIN enter karein";
    $("userPinInput").value = "";
    $("userPinInput").focus();
  });

  $("tabTeacherBtn")?.addEventListener("click", () => {
    pinMode = "teacher";
    $("tabTeacherBtn").classList.add("active");
    $("tabAdminBtn").classList.remove("active");
    $("teacherSelectWrap").classList.remove("d-none");
    $("pinSubtitle").textContent = "Apna naam select karein aur 4-digit PIN likhein";
    populateTeacherLoginDropdown();
    $("userPinInput").value = "";
    $("userPinInput").focus();
  });

  $("pinSubmitForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const enteredPin = $("userPinInput").value.trim();
    if (pinMode === "admin") {
      if (db.account && enteredPin === db.account.pin) {
        $("userPinInput").value = "";
        unlockDashboard("admin", null);
      } else {
        showToast("Admin PIN ghalat hai!", "danger");
      }
    } else {
      const tid = $("loginTeacherSelect").value;
      const teacher = db.teachers.find((t) => t.id === tid);
      if (!teacher) return showToast("Koi teacher select karein.", "danger");
      if (teacher.pin === enteredPin) {
        $("userPinInput").value = "";
        unlockDashboard("teacher", teacher.id);
      } else {
        showToast("Teacher PIN ghalat hai!", "danger");
      }
    }
  });

  $("lockScreenBtn")?.addEventListener("click", () => {
    session = { role: null, teacherId: null };
    $("appView").classList.add("d-none");
    $("loginView").classList.remove("d-none");
    showAuthCard("pinLoginCard");
    populateTeacherLoginDropdown();
  });

  $("switchAccountBtn")?.addEventListener("click", () => {
    showAuthCard("emailAuthCard");
    switchEmailTab("login");
  });

  $("forgotPinBtn")?.addEventListener("click", () => openRecoveryScreen());
  $("forgotPinFromEmailBtn")?.addEventListener("click", () => openRecoveryScreen());

  document.querySelectorAll(".cancel-rec-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      showAuthCard(db.account ? "pinLoginCard" : "emailAuthCard");
    });
  });

  $("verifyEmailBtn")?.addEventListener("click", () => {
    const email = $("recoveryTargetEmail").value.trim().toLowerCase();
    if (!db.account || db.account.email !== email) {
      return showToast("Yeh email registered nahi hai.", "danger");
    }
    pendingRecoveryEmail = email;
    $("displayQuestion").textContent = db.account.question;
    $("recStep1").classList.add("d-none");
    $("recStep2Form").classList.remove("d-none");
  });

  $("recStep2Form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!db.account || db.account.email !== pendingRecoveryEmail) return;
    const ans = $("recoveryAnswerInput").value.trim().toLowerCase();
    const newPass = $("resetNewPass").value.trim();
    const newPin = $("resetNewPin").value.trim();

    if (ans !== db.account.answer) {
      return showToast("Security answer ghalat hai!", "danger");
    }
    if (!/^\d{4}$/.test(newPin)) {
      return showToast("PIN 4 digits ka hona chahiye.", "danger");
    }
    db.account.password = newPass;
    db.account.pin = newPin;
    saveDB();
    showToast("Password aur PIN reset ho gaye!", "success");
    showAuthCard("pinLoginCard");
  });
}

function switchEmailTab(tab) {
  if (tab === "login") {
    $("tabEmailLoginBtn").classList.add("active");
    $("tabEmailRegisterBtn").classList.remove("active");
    $("emailLoginForm").classList.remove("d-none");
    $("setupForm").classList.add("d-none");
    $("authCardSub").textContent = "School Admin Login";
  } else {
    $("tabEmailRegisterBtn").classList.add("active");
    $("tabEmailLoginBtn").classList.remove("active");
    $("setupForm").classList.remove("d-none");
    $("emailLoginForm").classList.add("d-none");
    $("authCardSub").textContent = "Create New School Account";
  }
}

function showAuthCard(cardId) {
  ["emailAuthCard", "pinLoginCard", "recoveryCard"].forEach((id) => {
    $(id)?.classList.toggle("d-none", id !== cardId);
  });
}

function openRecoveryScreen() {
  showAuthCard("recoveryCard");
  $("recStep1").classList.remove("d-none");
  $("recStep2Form").classList.add("d-none");
  $("recoveryTargetEmail").value = db.account?.email || "";
}

function populateTeacherLoginDropdown() {
  const sel = $("loginTeacherSelect");
  if (!sel) return;
  if (!db.teachers.length) {
    sel.innerHTML = `<option value="">No teachers added yet</option>`;
    return;
  }
  sel.innerHTML = db.teachers
    .map((t) => `<option value="${esc(t.id)}">${esc(t.name)} (${esc(t.staffId)}) - ${esc(t.assignedClass)}</option>`)
    .join("");
}

function applyAdmissionRoleState() {
  const teacher = getActiveTeacher();
  const classSel = $("admitClass");
  const secSel = $("admitSection");
  if (!classSel || !secSel) return;

  if (teacher) {
    classSel.value = teacher.assignedClass;
    secSel.value = teacher.assignedSection;
    classSel.disabled = true;
    secSel.disabled = true;
    $("admitRoleNote").innerHTML = `<i class="bi bi-lock-fill me-1"></i>Auto-Assigned Class: ${esc(teacher.assignedClass)} (${esc(teacher.assignedSection)})`;
  } else {
    classSel.disabled = false;
    secSel.disabled = false;
    $("admitRoleNote").textContent = "Full Admin Access";
  }
}

function unlockDashboard(role, teacherId) {
  session = { role, teacherId };
  $("loginView").classList.add("d-none");
  $("appView").classList.remove("d-none");

  const isAdmin = role === "admin";
  const teacher = getActiveTeacher();

  $("roleBadge").textContent = isAdmin
    ? "Principal / Admin"
    : `Teacher: ${teacher ? teacher.name : "Staff"}`;

  $("navTeacherAtt")?.classList.toggle("d-none", !isAdmin);
  $("navGeoSettings")?.classList.toggle("d-none", !isAdmin);
  $("navAdminSettings")?.classList.toggle("d-none", !isAdmin);
  $("teacherSelfAttBar")?.classList.toggle("d-none", isAdmin);

  applyAdmissionRoleState();

  if (!isAdmin && teacher) {
    $("saClass").value = teacher.assignedClass;
    $("saSection").value = teacher.assignedSection;
    $("mkClassFilter").value = teacher.assignedClass;
    $("mkSectionFilter").value = teacher.assignedSection;
    if ($("rcTeacherNameInput")) $("rcTeacherNameInput").value = teacher.name;
  }

  refreshAllViews();
}

function refreshAllViews() {
  renderDashboard();
  renderDirectory();
  renderStudentAttendance();
  refreshMarksStudentList();
  renderTeachersTable();
  loadGeoInputs();
  loadSecurityInputs();
}

// ========================================================
// B-FORM AUTO-DASH (00000-0000000-0)
// ========================================================
function initBFormAutoDash() {
  document.addEventListener("input", (e) => {
    if (!e.target.classList.contains("bform-auto-dash")) return;
    const formatted = formatBFormDigits(e.target.value);
    e.target.value = formatted;

    if (e.target.id === "admitBFormInput") {
      const exists =
        formatted.length === 15 &&
        db.students.some((s) => s.bFormNumber === formatted);
      $("bFormDupAlert")?.classList.toggle("d-none", !exists);
    }
  });
}

// ========================================================
// DASHBOARD & KPI OVERVIEW
// ========================================================
function renderDashboard() {
  const date = $("dashDate")?.value || todayStr();
  const fClass = $("dashClass")?.value || "";
  const fSec = $("dashSection")?.value || "";

  const filteredStudents = db.students.filter(
    (s) => (!fClass || s.class === fClass) && (!fSec || s.section === fSec)
  );

  $("kStudents").textContent = filteredStudents.length;
  $("kTeachers").textContent = db.teachers.length;

  const dayAtt = db.studentAttendance[date] || {};
  let counts = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
  const absentees = [];

  filteredStudents.forEach((s) => {
    const st = dayAtt[s.id];
    if (st && counts[st] !== undefined) {
      counts[st]++;
      if (st === "Absent" || st === "Leave") {
        absentees.push({ ...s, status: st });
      }
    }
  });

  const markedTotal = counts.Present + counts.Absent + counts.Late + counts.Leave;
  const rate = markedTotal > 0 ? Math.round(((counts.Present + counts.Late) / markedTotal) * 100) : 0;
  $("kRate").textContent = `${rate}%`;

  const tDayAtt = db.teacherAttendance[date] || {};
  const tPresent = db.teachers.filter((t) => tDayAtt[t.id]?.status === "Present" || tDayAtt[t.id]?.status === "Late").length;
  $("kTeachAtt").textContent = `${tPresent} / ${db.teachers.length}`;

  const bar = $("attBar");
  const legend = $("attLegend");
  if (bar && legend) {
    if (markedTotal === 0) {
      bar.innerHTML = `<div class="progress-bar bg-secondary" style="width:100%">No attendance marked for ${esc(date)}</div>`;
      legend.innerHTML = `<span class="text-secondary">Attendance tab se aaj ki hazri save karein.</span>`;
    } else {
      const pPct = (counts.Present / markedTotal) * 100;
      const lPct = (counts.Late / markedTotal) * 100;
      const lvPct = (counts.Leave / markedTotal) * 100;
      const aPct = (counts.Absent / markedTotal) * 100;
      bar.innerHTML = `
        <div class="progress-bar bg-success" style="width:${pPct}%">${counts.Present}</div>
        <div class="progress-bar bg-warning text-dark" style="width:${lPct}%">${counts.Late}</div>
        <div class="progress-bar bg-primary" style="width:${lvPct}%">${counts.Leave}</div>
        <div class="progress-bar bg-danger" style="width:${aPct}%">${counts.Absent}</div>
      `;
      legend.innerHTML = `
        <span class="badge-s b-Present">Present: ${counts.Present}</span>
        <span class="badge-s b-Late">Late: ${counts.Late}</span>
        <span class="badge-s b-Leave">Leave: ${counts.Leave}</span>
        <span class="badge-s b-Absent">Absent: ${counts.Absent}</span>
      `;
    }
  }

  $("absCount").textContent = absentees.length;
  const absList = $("absList");
  if (absList) {
    if (!absentees.length) {
      absList.innerHTML = `<div class="empty py-4">Is tareekh ko koi student absent nahi hai.</div>`;
    } else {
      absList.innerHTML = `
        <table class="table table-sm align-middle">
          <thead><tr><th>Roll</th><th>Name</th><th>Class</th><th>Phone</th><th>Status</th></tr></thead>
          <tbody>
            ${absentees
              .map(
                (a) => `
              <tr>
                <td>${esc(a.rollNumber)}</td>
                <td class="fw-semibold">${esc(a.fullName)}</td>
                <td>${esc(a.class)}-${esc(a.section)}</td>
                <td>${esc(a.phone)}</td>
                <td><span class="badge-s b-${esc(a.status)}">${esc(a.status)}</span></td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>`;
    }
  }
}

$("dashDate")?.addEventListener("change", renderDashboard);
$("dashClass")?.addEventListener("change", renderDashboard);
$("dashSection")?.addEventListener("change", renderDashboard);
$("refreshDashBtn")?.addEventListener("click", async () => {
  await initNeonSync();
  showToast("Neon Cloud se latest data refresh ho gaya!", "info");
});

// ========================================================
// STUDENT ADMISSION (AUTO-LOCKED CLASS FOR TEACHERS)
// ========================================================
function initAdmission() {
  $("admitDob")?.addEventListener("change", () => {
    const { years, text } = calcAgeDetails($("admitDob").value);
    $("calcAgeText").textContent = text;
    $("ageWarning")?.classList.toggle("d-none", years >= 4 || !$("admitDob").value);
  });

  $("admitForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const teacher = getActiveTeacher();
    const fd = new FormData(e.target);

    const fullName = fd.get("fullName").trim();
    const fatherName = fd.get("fatherName").trim();
    const rollNumber = fd.get("rollNumber").trim();
    const cls = teacher ? teacher.assignedClass : $("admitClass").value;
    const section = teacher ? teacher.assignedSection : $("admitSection").value;
    const bFormNumber = formatBFormDigits(fd.get("bFormNumber"));
    const phone = fd.get("phone").trim();
    const dob = fd.get("dob");
    const address = fd.get("address").trim();

    if (!fullName || !fatherName || !rollNumber || !bFormNumber || !phone || !dob || !address) {
      return showToast("Tamam zaroori (*) fields fill karein.", "danger");
    }
    if (!/^\d{5}-\d{7}-\d{1}$/.test(bFormNumber)) {
      return showToast("B-Form number 13 digits (00000-0000000-0) hona chahiye.", "danger");
    }
    if (db.students.some((s) => s.bFormNumber === bFormNumber)) {
      return showToast("Yeh B-Form number pehle se maujood hai!", "danger");
    }

    let bFormDoc = "";
    let bFormDocType = "";
    const file = $("bFormFile")?.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        return showToast("B-Form file 5MB se choti honi chahiye.", "danger");
      }
      bFormDoc = await readFileAsDataURL(file);
      bFormDocType = file.type;
    }

    const student = {
      id: "std_" + Date.now(),
      fullName,
      fatherName,
      rollNumber,
      class: cls,
      section,
      bFormNumber,
      phone,
      dob,
      address,
      bFormDoc,
      bFormDocType,
      createdAt: todayStr()
    };

    db.students.push(student);
    saveDB();
    e.target.reset();
    applyAdmissionRoleState();

    $("ageWarning")?.classList.add("d-none");
    $("bFormDupAlert")?.classList.add("d-none");
    showToast(`${fullName} (${cls}-${section}) Neon Cloud mein save ho gaya!`, "success");
    refreshAllViews();
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ========================================================
// STUDENT DIRECTORY, VIEW B-FORM, EDIT & DELETE
// ========================================================
function initDirectory() {
  $("searchBox")?.addEventListener("input", renderDirectory);
  $("filterAge")?.addEventListener("change", renderDirectory);

  $("dirBody")?.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".btn-view-bform");
    const editBtn = e.target.closest(".btn-edit-std");
    const delBtn = e.target.closest(".btn-del-std");

    if (viewBtn) {
      const std = db.students.find((s) => s.id === viewBtn.dataset.id);
      if (std) openBFormViewer(std);
    } else if (editBtn) {
      const std = db.students.find((s) => s.id === editBtn.dataset.id);
      if (std) openEditStudentModal(std);
    } else if (delBtn) {
      const std = db.students.find((s) => s.id === delBtn.dataset.id);
      if (std && confirm(`Kya aap ${std.fullName} ka record delete karna chahte hain?`)) {
        db.students = db.students.filter((s) => s.id !== std.id);
        delete db.marks[std.id];
        saveDB();
        showToast("Student record delete ho gaya.", "info");
        refreshAllViews();
      }
    }
  });

  $("editStudentForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("editStudentId").value;
    const std = db.students.find((s) => s.id === id);
    if (!std) return;

    const teacher = getActiveTeacher();
    const bFormNumber = formatBFormDigits($("editBFormNumber").value);
    if (!/^\d{5}-\d{7}-\d{1}$/.test(bFormNumber)) {
      return showToast("B-Form format 00000-0000000-0 hona chahiye.", "danger");
    }
    if (db.students.some((s) => s.id !== id && s.bFormNumber === bFormNumber)) {
      return showToast("Yeh B-Form kisi aur student ke paas registered hai!", "danger");
    }

    std.fullName = $("editFullName").value.trim();
    std.fatherName = $("editFatherName").value.trim();
    std.rollNumber = $("editRollNumber").value.trim();
    std.class = teacher ? teacher.assignedClass : $("editClass").value;
    std.section = teacher ? teacher.assignedSection : $("editSection").value;
    std.dob = $("editDob").value;
    std.phone = $("editPhone").value.trim();
    std.bFormNumber = bFormNumber;

    const file = $("editBFormFile")?.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        return showToast("File 5MB se choti honi chahiye.", "danger");
      }
      std.bFormDoc = await readFileAsDataURL(file);
      std.bFormDocType = file.type;
    }

    saveDB();
    bootstrap.Modal.getInstance($("editStudentModal"))?.hide();
    showToast("Student record update ho gaya!", "success");
    refreshAllViews();
  });

  $("downloadBFormBtn")?.addEventListener("click", () => {
    if (!currentBFormData.url) return;
    const a = document.createElement("a");
    a.href = currentBFormData.url;
    a.download = currentBFormData.name || "B-Form.png";
    a.click();
  });
}

function renderDirectory() {
  const tbody = $("dirBody");
  if (!tbody) return;

  const q = ($("searchBox")?.value || "").trim().toLowerCase();
  const ageFilter = $("filterAge")?.value || "all";

  let list = db.students.filter((s) => {
    if (session.role === "teacher") {
      const t = getActiveTeacher();
      if (t && (s.class !== t.assignedClass || s.section !== t.assignedSection)) return false;
    }
    const matchText =
      !q ||
      s.fullName.toLowerCase().includes(q) ||
      s.fatherName.toLowerCase().includes(q) ||
      s.rollNumber.toLowerCase().includes(q) ||
      s.class.toLowerCase().includes(q) ||
      s.bFormNumber.includes(q);
    if (!matchText) return false;

    const { years } = calcAgeDetails(s.dob);
    if (ageFilter === "under4") return years < 4;
    if (ageFilter === "4to6") return years >= 4 && years <= 6;
    if (ageFilter === "7to10") return years >= 7 && years <= 10;
    if (ageFilter === "above10") return years >= 11;
    return true;
  });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Koi student record nahi mila.</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((s) => {
      const age = calcAgeDetails(s.dob);
      const docBtn = s.bFormDoc
        ? `<button class="btn btn-sm btn-outline-info btn-view-bform" data-id="${esc(s.id)}" title="View B-Form"><i class="bi bi-file-earmark-image"></i> View</button>`
        : `<span class="badge bg-secondary bg-opacity-50">No File</span>`;
      return `
      <tr>
        <td class="fw-bold">${esc(s.fullName)}</td>
        <td>${esc(s.fatherName)}</td>
        <td><span class="badge bg-warning text-dark">${esc(s.rollNumber)}</span></td>
        <td><div>${esc(age.text)}</div><small class="text-secondary">${esc(s.dob)}</small></td>
        <td>${esc(s.class)} (${esc(s.section)})</td>
        <td>${esc(s.phone)}</td>
        <td><div class="small fw-semibold">${esc(s.bFormNumber)}</div>${docBtn}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-warning btn-edit-std me-1" data-id="${esc(s.id)}" title="Edit"><i class="bi bi-pencil-square"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-del-std" data-id="${esc(s.id)}" title="Delete"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    })
    .join("");
}

function openBFormViewer(std) {
  $("viewBFormTitle").textContent = `B-Form: ${std.fullName} (${std.bFormNumber})`;
  const body = $("viewBFormBody");
  currentBFormData = { url: std.bFormDoc, name: `${std.fullName}_BForm` };

  if (std.bFormDocType === "application/pdf") {
    body.innerHTML = `<iframe src="${std.bFormDoc}" style="width:100%;height:500px;border:none;border-radius:8px;"></iframe>`;
  } else {
    body.innerHTML = `<img src="${std.bFormDoc}" alt="B-Form" style="max-width:100%;max-height:520px;border-radius:10px;">`;
  }
  new bootstrap.Modal($("viewBFormModal")).show();
}

function openEditStudentModal(std) {
  const teacher = getActiveTeacher();
  $("editStudentId").value = std.id;
  $("editFullName").value = std.fullName;
  $("editFatherName").value = std.fatherName;
  $("editRollNumber").value = std.rollNumber;
  $("editClass").value = std.class;
  $("editSection").value = std.section;
  $("editClass").disabled = !!teacher;
  $("editSection").disabled = !!teacher;
  $("editDob").value = std.dob;
  $("editPhone").value = std.phone;
  $("editBFormNumber").value = std.bFormNumber;
  $("editBFormFile").value = "";
  $("currentBFormStatus").textContent = std.bFormDoc
    ? "B-Form file pehle se uploaded hai (nayi file select karne par replace hogi)."
    : "Abhi koi B-Form image/PDF upload nahi hai.";
  new bootstrap.Modal($("editStudentModal")).show();
}

// ========================================================
// STUDENT ATTENDANCE
// ========================================================
function initStudentAttendance() {
  $("saDate")?.addEventListener("change", renderStudentAttendance);
  $("saClass")?.addEventListener("change", renderStudentAttendance);
  $("saSection")?.addEventListener("change", renderStudentAttendance);

  $("saAllBtn")?.addEventListener("click", () => {
    document.querySelectorAll('#saBody input[value="Present"]').forEach((r) => (r.checked = true));
    showToast("Sab students ko Present mark kar diya gaya. Ab Save dabayein.", "info");
  });

  $("saSaveBtn")?.addEventListener("click", () => {
    const date = $("saDate").value || todayStr();
    if (!db.studentAttendance[date]) db.studentAttendance[date] = {};

    const rows = $("saBody").querySelectorAll("tr[data-sid]");
    if (!rows.length) return showToast("Is class mein koi student nahi hai.", "danger");

    rows.forEach((tr) => {
      const sid = tr.dataset.sid;
      const checked = tr.querySelector("input[type=radio]:checked");
      if (checked) db.studentAttendance[date][sid] = checked.value;
    });

    saveDB();
    renderDashboard();
    showToast(`Attendance (${date}) Neon Cloud mein save ho gayi!`, "success");
  });
}

function renderStudentAttendance() {
  const tbody = $("saBody");
  if (!tbody) return;

  const date = $("saDate")?.value || todayStr();
  const cls = $("saClass")?.value || "Class 1";
  const sec = $("saSection")?.value || "A";
  const savedDay = db.studentAttendance[date] || {};

  const students = db.students.filter((s) => s.class === cls && s.section === sec);
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">Is class aur section mein koi student dakhil nahi hai.</td></tr>`;
    return;
  }

  tbody.innerHTML = students
    .map((s) => {
      const cur = savedDay[s.id] || "Present";
      const statuses = ["Present", "Absent", "Late", "Leave"];
      return `
      <tr data-sid="${esc(s.id)}">
        <td><span class="badge bg-warning text-dark">${esc(s.rollNumber)}</span></td>
        <td class="fw-bold">${esc(s.fullName)} <small class="text-secondary d-block">${esc(s.fatherName)}</small></td>
        <td>
          <div class="att-radio">
            ${statuses
              .map(
                (st) => `
              <input type="radio" name="att_${esc(s.id)}" id="att_${esc(s.id)}_${st}" value="${st}" ${cur === st ? "checked" : ""}>
              <label for="att_${esc(s.id)}_${st}">${st}</label>`
              )
              .join("")}
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

// ========================================================
// MARKS & REPORT CARD GENERATOR
// ========================================================
function initMarksAndReportCard() {
  $("mkClassFilter")?.addEventListener("change", refreshMarksStudentList);
  $("mkSectionFilter")?.addEventListener("change", refreshMarksStudentList);
  $("mkStudentSelect")?.addEventListener("change", renderSelectedStudentMarks);

  $("mkSubjectSelect")?.addEventListener("change", () => {
    const isCustom = $("mkSubjectSelect").value === "__CUSTOM__";
    $("mkCustomSubjectWrap")?.classList.toggle("d-none", !isCustom);
    if (isCustom) $("mkCustomSubjectInput").focus();
  });

  $("addMarkForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const sid = $("mkStudentSelect").value;
    if (!sid) return showToast("Pehle student select karein.", "danger");

    let subject = $("mkSubjectSelect").value;
    if (subject === "__CUSTOM__") {
      subject = $("mkCustomSubjectInput").value.trim();
    }
    if (!subject) return showToast("Subject ka naam likhein.", "danger");

    const obtain = parseFloat($("mkObtainInput").value);
    const total = parseFloat($("mkTotalInput").value);

    if (isNaN(obtain) || isNaN(total) || total <= 0 || obtain < 0 || obtain > total) {
      return showToast("Sahi Obtain aur Total marks enter karein.", "danger");
    }

    if (!db.marks[sid]) db.marks[sid] = [];
    const existingIdx = db.marks[sid].findIndex((m) => m.subject.toLowerCase() === subject.toLowerCase());
    if (existingIdx >= 0) {
      db.marks[sid][existingIdx] = { subject, obtain, total };
    } else {
      db.marks[sid].push({ subject, obtain, total });
    }

    saveDB();
    $("mkObtainInput").value = "";
    $("mkCustomSubjectInput").value = "";
    showToast(`${subject} ke marks save ho gaye!`, "success");
    renderSelectedStudentMarks();
  });

  $("mkMarksBody")?.addEventListener("click", (e) => {
    const delBtn = e.target.closest(".btn-del-mark");
    if (!delBtn) return;
    const sid = $("mkStudentSelect").value;
    const idx = parseInt(delBtn.dataset.idx, 10);
    if (sid && db.marks[sid]) {
      db.marks[sid].splice(idx, 1);
      saveDB();
      renderSelectedStudentMarks();
    }
  });

  $("clearStudentMarksBtn")?.addEventListener("click", () => {
    const sid = $("mkStudentSelect").value;
    if (!sid) return;
    if (confirm("Kya aap is student ke saare marks clear karna chahte hain?")) {
      db.marks[sid] = [];
      saveDB();
      renderSelectedStudentMarks();
    }
  });

  $("generateReportCardBtn")?.addEventListener("click", openReportCardPreview);

  $("printReportCardBtn")?.addEventListener("click", () => {
    window.print();
  });

  $("downloadReportCardPngBtn")?.addEventListener("click", exportReportCardAsPNG);
}

function refreshMarksStudentList() {
  const fClass = $("mkClassFilter")?.value || "";
  const fSec = $("mkSectionFilter")?.value || "";
  const sel = $("mkStudentSelect");
  if (!sel) return;

  const list = db.students.filter(
    (s) => (!fClass || s.class === fClass) && (!fSec || s.section === fSec)
  );

  if (!list.length) {
    sel.innerHTML = `<option value="">No students found</option>`;
  } else {
    sel.innerHTML = list
      .map((s) => `<option value="${esc(s.id)}">${esc(s.fullName)} (Roll: ${esc(s.rollNumber)} | ${esc(s.class)}-${esc(s.section)})</option>`)
      .join("");
  }
  renderSelectedStudentMarks();
}

function getSubjectsForClass(cls) {
  if (["Nursery", "Prep"].includes(cls)) return PUNJAB_SUBJECTS.early;
  if (["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"].includes(cls)) return PUNJAB_SUBJECTS.primary;
  if (["Class 6", "Class 7", "Class 8"].includes(cls)) return PUNJAB_SUBJECTS.middle;
  return PUNJAB_SUBJECTS.high;
}

function renderSelectedStudentMarks() {
  const sid = $("mkStudentSelect")?.value;
  const std = db.students.find((s) => s.id === sid);
  const tbody = $("mkMarksBody");
  const tfoot = $("mkMarksFoot");
  const subSel = $("mkSubjectSelect");

  if (!std) {
    $("mkSelectedStudentInfo").textContent = "Student select karein";
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Pehle student select karein.</td></tr>`;
    tfoot?.classList.add("d-none");
    $("clearStudentMarksBtn")?.classList.add("d-none");
    return;
  }

  $("mkSelectedStudentInfo").textContent = `${std.fullName} — ${std.class} (${std.section}) | Roll #${std.rollNumber}`;
  const entries = db.marks[sid] || [];
  const enteredNames = entries.map((m) => m.subject.toLowerCase());

  const boardSubs = getSubjectsForClass(std.class);
  const remaining = boardSubs.filter((sub) => !enteredNames.includes(sub.toLowerCase()));
  subSel.innerHTML =
    remaining.map((sub) => `<option value="${esc(sub)}">${esc(sub)}</option>`).join("") +
    `<option value="__CUSTOM__">+ Custom Subject...</option>`;

  $("mkSubjectHint").textContent = `${remaining.length} Punjab Board subjects baqi hain (${std.class}).`;
  $("mkCustomSubjectWrap")?.classList.toggle("d-none", subSel.value !== "__CUSTOM__");

  const meta = db.reportMeta[sid] || {};
  if (meta.year) $("rcSchoolYearInput").value = meta.year;
  if (meta.teacherName) $("rcTeacherNameInput").value = meta.teacherName;
  $("rcFeedbackInput").value = meta.feedback || "";

  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Abhi tak koi subject marks add nahi kiye gaye.</td></tr>`;
    tfoot?.classList.add("d-none");
    $("clearStudentMarksBtn")?.classList.add("d-none");
    return;
  }

  $("clearStudentMarksBtn")?.classList.remove("d-none");
  let sumObt = 0;
  let sumTot = 0;

  tbody.innerHTML = entries
    .map((m, i) => {
      sumObt += Number(m.obtain);
      sumTot += Number(m.total);
      return `
      <tr>
        <td>${i + 1}</td>
        <td class="fw-bold">${esc(m.subject)}</td>
        <td>${esc(m.obtain)}</td>
        <td>${esc(m.total)}</td>
        <td>
          <button type="button" class="btn btn-sm btn-outline-danger btn-del-mark" data-idx="${i}" title="Remove">
            <i class="bi bi-x-lg"></i>
          </button>
        </td>
      </tr>`;
    })
    .join("");

  const pct = sumTot > 0 ? ((sumObt / sumTot) * 100).toFixed(1) : "0";
  $("mkFootObt").textContent = sumObt;
  $("mkFootTot").textContent = sumTot;
  $("mkFootPct").textContent = `${pct}%`;
  tfoot?.classList.remove("d-none");
}

function openReportCardPreview() {
  const sid = $("mkStudentSelect")?.value;
  const std = db.students.find((s) => s.id === sid);
  if (!std) return showToast("Pehle student select karein.", "danger");

  const entries = db.marks[sid] || [];
  if (!entries.length) return showToast("Report card ke liye kam az kam 1 subject ke marks save karein.", "danger");

  const year = $("rcSchoolYearInput").value.trim() || "2026-2027";
  const teacherName = $("rcTeacherNameInput").value.trim() || "Class Teacher";
  const feedback = $("rcFeedbackInput").value.trim() || "Keep up the good work and continue striving for excellence!";

  db.reportMeta[sid] = { year, teacherName, feedback };
  saveDB();

  $("rcOutName").textContent = std.fullName;
  $("rcOutClass").textContent = `${std.class} - ${std.section} (Roll #${std.rollNumber})`;
  $("rcOutYear").textContent = year;
  $("rcOutTeacher").textContent = teacherName;
  $("rcOutFeedback").textContent = feedback;

  let sumObt = 0;
  let sumTot = 0;
  $("rcOutTableBody").innerHTML = entries
    .map((m, idx) => {
      sumObt += Number(m.obtain);
      sumTot += Number(m.total);
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${esc(m.subject)}</td>
        <td>${esc(m.obtain)}</td>
        <td>${esc(m.total)}</td>
      </tr>`;
    })
    .join("");

  const pct = sumTot > 0 ? ((sumObt / sumTot) * 100).toFixed(1) : "0";
  $("rcOutTotalObt").textContent = sumObt;
  $("rcOutTotalMax").textContent = sumTot;
  $("rcOutPct").textContent = `${pct}%`;

  new bootstrap.Modal($("reportCardModal")).show();
}

function exportReportCardAsPNG() {
  const sid = $("mkStudentSelect")?.value;
  const std = db.students.find((s) => s.id === sid);
  if (!std) return;
  const entries = db.marks[sid] || [];
  if (!entries.length) return;

  const year = $("rcOutYear").textContent;
  const teacherName = $("rcOutTeacher").textContent;
  const feedback = $("rcOutFeedback").textContent;
  const totalObt = $("rcOutTotalObt").textContent;
  const totalMax = $("rcOutTotalMax").textContent;
  const pct = $("rcOutPct").textContent;

  const canvas = document.createElement("canvas");
  const W = 1240;
  const H = 1754;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#84bd22";
  ctx.beginPath();
  ctx.moveTo(W - 320, 0);
  ctx.lineTo(W - 180, 0);
  ctx.quadraticCurveTo(W - 110, 140, W, 260);
  ctx.lineTo(W, 340);
  ctx.quadraticCurveTo(W - 160, 210, W - 320, 0);
  ctx.fill();

  ctx.fillStyle = "#0d1b3e";
  ctx.beginPath();
  ctx.moveTo(W - 230, 80);
  ctx.quadraticCurveTo(W - 110, 210, W, 320);
  ctx.lineTo(W, 420);
  ctx.quadraticCurveTo(W - 140, 260, W - 230, 80);
  ctx.fill();

  ctx.fillStyle = "#0d1b3e";
  ctx.beginPath();
  ctx.moveTo(0, H - 410);
  ctx.quadraticCurveTo(130, H - 230, 290, H);
  ctx.lineTo(190, H);
  ctx.quadraticCurveTo(80, H - 160, 0, H - 310);
  ctx.fill();

  ctx.fillStyle = "#84bd22";
  ctx.beginPath();
  ctx.moveTo(0, H - 280);
  ctx.quadraticCurveTo(100, H - 140, 220, H);
  ctx.lineTo(105, H);
  ctx.quadraticCurveTo(45, H - 80, 0, H - 170);
  ctx.fill();

  const pad = 54;
  ctx.strokeStyle = "#0d1b3e";
  ctx.lineWidth = 4;
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  ctx.fillStyle = "#0d1b3e";
  ctx.textAlign = "center";
  ctx.font = "bold 66px Arial, sans-serif";
  ctx.fillText("REPORT CARD", W / 2 + 50, 165);
  ctx.font = "bold 36px Arial, sans-serif";
  ctx.fillText("GGPS SAWARCUP", W / 2 + 50, 215);

  ctx.textAlign = "left";
  ctx.font = "bold 26px Arial, sans-serif";
  const leftX = 110;
  const rightX = W - 110;

  const drawField = (label, val, x1, x2, y) => {
    ctx.fillStyle = "#0d1b3e";
    ctx.fillText(label, x1, y);
    const lw = ctx.measureText(label).width + 14;
    ctx.fillStyle = "#111827";
    ctx.fillText(val, x1 + lw, y);
    ctx.strokeStyle = "#0d1b3e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1 + lw, y + 8);
    ctx.lineTo(x2, y + 8);
    ctx.stroke();
  };

  drawField("Student Name:", std.fullName, leftX, rightX, 300);
  drawField("Class/Section:", `${std.class} - ${std.section} (Roll #${std.rollNumber})`, leftX, 640, 355);
  drawField("School Year:", year, 670, rightX, 355);
  drawField("Teacher Name:", teacherName, leftX, rightX, 410);

  let ty = 465;
  const rowH = 54;
  const colW = [130, 510, 190, 190];
  const headers = ["Sr. No.", "Subject Name", "Obtain Marks", "Total Marks"];

  ctx.fillStyle = "#0d1b3e";
  ctx.fillRect(leftX, ty, rightX - leftX, rowH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial, sans-serif";

  let cx = leftX;
  headers.forEach((h, i) => {
    ctx.textAlign = i === 1 ? "left" : "center";
    ctx.fillText(h, i === 1 ? cx + 20 : cx + colW[i] / 2, ty + 35);
    cx += colW[i];
  });

  ty += rowH;
  entries.forEach((m, idx) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(leftX, ty, rightX - leftX, rowH);
    ctx.strokeStyle = "#0d1b3e";
    ctx.lineWidth = 2;
    ctx.strokeRect(leftX, ty, rightX - leftX, rowH);

    ctx.fillStyle = "#0d1b3e";
    ctx.font = "600 24px Arial, sans-serif";
    const vals = [String(idx + 1), m.subject, String(m.obtain), String(m.total)];
    let rx = leftX;
    vals.forEach((v, i) => {
      if (i > 0) {
        ctx.beginPath();
        ctx.moveTo(rx, ty);
        ctx.lineTo(rx, ty + rowH);
        ctx.stroke();
      }
      ctx.textAlign = i === 1 ? "left" : "center";
      ctx.fillText(v, i === 1 ? rx + 20 : rx + colW[i] / 2, ty + 35);
      rx += colW[i];
    });
    ty += rowH;
  });

  ty += 35;
  const box1W = 580;
  const box2W = 400;
  const boxH = 165;

  ctx.strokeStyle = "#0d1b3e";
  ctx.lineWidth = 3;
  ctx.strokeRect(leftX, ty, box1W, boxH);
  ctx.fillStyle = "#0d1b3e";
  ctx.fillRect(leftX, ty, box1W, 48);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.fillText("Overall Marks", leftX + box1W / 2, ty + 33);

  ctx.fillStyle = "#0d1b3e";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText("Obtained Marks", leftX + box1W * 0.25, ty + 82);
  ctx.fillText("Total Marks", leftX + box1W * 0.75, ty + 82);
  ctx.beginPath();
  ctx.moveTo(leftX, ty + 96);
  ctx.lineTo(leftX + box1W, ty + 96);
  ctx.moveTo(leftX + box1W / 2, ty + 48);
  ctx.lineTo(leftX + box1W / 2, ty + boxH);
  ctx.stroke();

  ctx.font = "bold 34px Arial, sans-serif";
  ctx.fillText(totalObt, leftX + box1W * 0.25, ty + 142);
  ctx.fillText(totalMax, leftX + box1W * 0.75, ty + 142);

  const b2X = rightX - box2W;
  ctx.strokeRect(b2X, ty, box2W, boxH);
  ctx.fillStyle = "#0d1b3e";
  ctx.fillRect(b2X, ty, box2W, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.fillText("Percentage", b2X + box2W / 2, ty + 33);
  ctx.fillStyle = "#0d1b3e";
  ctx.font = "bold 46px Arial, sans-serif";
  ctx.fillText(pct, b2X + box2W / 2, ty + 122);

  ty += boxH + 35;
  const fbH = 155;
  ctx.strokeRect(leftX, ty, rightX - leftX, fbH);
  ctx.fillStyle = "#0d1b3e";
  ctx.fillRect(leftX, ty, rightX - leftX, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.fillText("Teacher's Feedback", W / 2, ty + 33);

  ctx.fillStyle = "#111827";
  ctx.textAlign = "left";
  ctx.font = "600 23px Arial, sans-serif";
  ctx.fillText(feedback.slice(0, 82), leftX + 24, ty + 92);
  if (feedback.length > 82) {
    ctx.fillText(feedback.slice(82, 164), leftX + 24, ty + 126);
  }

  const sigY = H - 135;
  ctx.strokeStyle = "#0d1b3e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(220, sigY);
  ctx.lineTo(520, sigY);
  ctx.moveTo(W - 520, sigY);
  ctx.lineTo(W - 220, sigY);
  ctx.stroke();

  ctx.fillStyle = "#0d1b3e";
  ctx.textAlign = "center";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText("Teacher Sign", 370, sigY + 34);
  ctx.fillText("Headmaster Sign", W - 370, sigY + 34);

  const logoImg = new Image();
  logoImg.onload = () => {
    ctx.drawImage(logoImg, 135, 88, 145, 145);
    triggerCanvasDownload(canvas, `${std.fullName}_Report_Card.png`);
  };
  logoImg.onerror = () => {
    triggerCanvasDownload(canvas, `${std.fullName}_Report_Card.png`);
  };
  logoImg.src = DEFAULT_RC_LOGO_SVG;
}

function triggerCanvasDownload(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("Report Card PNG download ho gaya!", "success");
}

// ========================================================
// TEACHER MANAGEMENT & GPS ATTENDANCE
// ========================================================
function initTeacherManagement() {
  $("taDate")?.addEventListener("change", renderTeachersTable);

  $("teacherForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pin = fd.get("pin").trim();
    if (!/^\d{4}$/.test(pin)) {
      return showToast("PIN sirf 4 digits ka hona chahiye.", "danger");
    }

    db.teachers.push({
      id: "tch_" + Date.now(),
      name: fd.get("name").trim(),
      staffId: fd.get("staffId").trim(),
      department: fd.get("department").trim(),
      assignedClass: fd.get("assignedClass"),
      assignedSection: fd.get("assignedSection"),
      pin,
      phone: fd.get("phone").trim(),
      email: fd.get("email").trim(),
      deviceId: ""
    });

    saveDB();
    e.target.reset();
    bootstrap.Modal.getInstance($("teacherModal"))?.hide();
    showToast("Naya teacher add ho gaya!", "success");
    refreshAllViews();
  });

  $("taBody")?.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".btn-edit-tch");
    const delBtn = e.target.closest(".btn-del-tch");
    const resetDevBtn = e.target.closest(".btn-reset-dev");

    if (editBtn) {
      const t = db.teachers.find((x) => x.id === editBtn.dataset.id);
      if (t) openEditTeacherModal(t);
    } else if (resetDevBtn) {
      const t = db.teachers.find((x) => x.id === resetDevBtn.dataset.id);
      if (t) {
        t.deviceId = "";
        saveDB();
        renderTeachersTable();
        showToast(`${t.name} ka device lock reset ho gaya.`, "info");
      }
    } else if (delBtn) {
      const t = db.teachers.find((x) => x.id === delBtn.dataset.id);
      if (t && confirm(`Kya aap ${t.name} ko remove karna chahte hain?`)) {
        db.teachers = db.teachers.filter((x) => x.id !== t.id);
        saveDB();
        refreshAllViews();
      }
    }
  });

  $("editTeacherForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("editTeacherId").value;
    const t = db.teachers.find((x) => x.id === id);
    if (!t) return;

    const pin = $("editTPin").value.trim();
    if (!/^\d{4}$/.test(pin)) return showToast("PIN 4 digits ka hona chahiye.", "danger");

    t.name = $("editTName").value.trim();
    t.staffId = $("editTStaffId").value.trim();
    t.department = $("editTDept").value.trim();
    t.assignedClass = $("editTClass").value;
    t.assignedSection = $("editTSection").value;
    t.pin = pin;
    t.phone = $("editTPhone").value.trim();
    t.email = $("editTEmail").value.trim();

    saveDB();
    bootstrap.Modal.getInstance($("editTeacherModal"))?.hide();
    showToast("Teacher record update ho gaya!", "success");
    refreshAllViews();
  });

  $("taSaveBtn")?.addEventListener("click", () => {
    const date = $("taDate").value || todayStr();
    if (!db.teacherAttendance[date]) db.teacherAttendance[date] = {};

    $("taBody")
      .querySelectorAll("tr[data-tid]")
      .forEach((tr) => {
        const tid = tr.dataset.tid;
        const st = tr.querySelector("select.tch-att-sel").value;
        const prev = db.teacherAttendance[date][tid] || {};
        db.teacherAttendance[date][tid] = {
          status: st,
          time: prev.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
      });

    saveDB();
    renderDashboard();
    showToast("Teachers attendance save ho gayi!", "success");
  });

  $("punchAttendanceBtn")?.addEventListener("click", () => {
    if (session.role !== "teacher" || !session.teacherId) return;
    const teacher = getActiveTeacher();
    if (!teacher) return;

    const fp = getDeviceFingerprint();
    if (teacher.deviceId && teacher.deviceId !== fp) {
      return showToast("Yeh account kisi aur mobile device se locked hai! Admin se device reset karwayein.", "danger");
    }

    if (!navigator.geolocation) {
      return showToast("Aapke browser mein GPS support nahi hai.", "danger");
    }

    $("teacherGeoStatus").textContent = "GPS location check ho rahi hai...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const gLat = parseFloat(db.geofence.lat);
        const gLng = parseFloat(db.geofence.lng);
        const radius = parseFloat(db.geofence.radius) || 150;

        if (!isNaN(gLat) && !isNaN(gLng)) {
          const dist = Math.round(distanceMeters(latitude, longitude, gLat, gLng));
          if (dist > radius) {
            $("teacherGeoStatus").textContent = `Aap school se ${dist}m door hain (Allowed: ${radius}m).`;
            return showToast(`School boundary se bahar hain (${dist}m).`, "danger");
          }
        }

        if (!teacher.deviceId) teacher.deviceId = fp;
        const date = todayStr();
        const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (!db.teacherAttendance[date]) db.teacherAttendance[date] = {};
        db.teacherAttendance[date][teacher.id] = { status: "Present", time: nowTime };
        saveDB();

        $("teacherGeoStatus").textContent = `Hazri lag gayi! Check-in Time: ${nowTime} (Device Locked)`;
        showToast("Aapki aaj ki hazri kamyabi se lag gayi!", "success");
        renderDashboard();
      },
      () => {
        $("teacherGeoStatus").textContent = "GPS permission deny ho gayi. Location ON karein.";
        showToast("Location access allow karein.", "danger");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

function renderTeachersTable() {
  const tbody = $("taBody");
  if (!tbody) return;
  const date = $("taDate")?.value || todayStr();
  const dayRec = db.teacherAttendance[date] || {};

  if (!db.teachers.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Koi teacher add nahi kiya gaya.</td></tr>`;
    return;
  }

  tbody.innerHTML = db.teachers
    .map((t) => {
      const rec = dayRec[t.id] || { status: "Present", time: "-" };
      const devBadge = t.deviceId
        ? `<span class="badge bg-info text-dark me-1">Locked</span><button class="btn btn-xs btn-outline-warning py-0 px-1 btn-reset-dev" data-id="${esc(t.id)}" title="Reset Device"><i class="bi bi-arrow-counterclockwise"></i></button>`
        : `<span class="badge bg-secondary">Unlocked</span>`;
      return `
      <tr data-tid="${esc(t.id)}">
        <td class="fw-bold text-warning">${esc(t.staffId)}</td>
        <td class="fw-bold">${esc(t.name)}</td>
        <td>${esc(t.assignedClass)} (${esc(t.assignedSection)})</td>
        <td><code>${esc(t.pin)}</code></td>
        <td>${devBadge}</td>
        <td>
          <select class="form-select form-select-sm tch-att-sel" style="min-width:110px;">
            ${["Present", "Absent", "Late", "Leave"]
              .map((st) => `<option value="${st}" ${rec.status === st ? "selected" : ""}>${st}</option>`)
              .join("")}
          </select>
        </td>
        <td>${esc(rec.time || "-")}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-warning btn-edit-tch me-1" data-id="${esc(t.id)}"><i class="bi bi-pencil-square"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-del-tch" data-id="${esc(t.id)}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    })
    .join("");
}

function openEditTeacherModal(t) {
  $("editTeacherId").value = t.id;
  $("editTName").value = t.name;
  $("editTStaffId").value = t.staffId;
  $("editTDept").value = t.department || "";
  $("editTClass").value = t.assignedClass;
  $("editTSection").value = t.assignedSection;
  $("editTPin").value = t.pin;
  $("editTPhone").value = t.phone || "";
  $("editTEmail").value = t.email || "";
  new bootstrap.Modal($("editTeacherModal")).show();
}

// ========================================================
// SCHOOL GEOFENCE & ADMIN SECURITY
// ========================================================
function initGeofence() {
  $("setSchoolLocationBtn")?.addEventListener("click", () => {
    if (!navigator.geolocation) return showToast("GPS available nahi hai.", "danger");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        $("geoLat").value = pos.coords.latitude.toFixed(6);
        $("geoLng").value = pos.coords.longitude.toFixed(6);
        showToast("Current GPS coordinates fetch ho gaye!", "success");
      },
      () => showToast("GPS location hasil nahi ho saki.", "danger"),
      { enableHighAccuracy: true }
    );
  });

  $("saveGeoBtn")?.addEventListener("click", () => {
    db.geofence = {
      lat: $("geoLat").value.trim(),
      lng: $("geoLng").value.trim(),
      radius: parseInt($("geoRadius").value, 10) || 150
    };
    saveDB();
    showToast("School Geofence settings save ho gayin!", "success");
  });
}

function loadGeoInputs() {
  if ($("geoLat")) $("geoLat").value = db.geofence.lat || "";
  if ($("geoLng")) $("geoLng").value = db.geofence.lng || "";
  if ($("geoRadius")) $("geoRadius").value = db.geofence.radius || 150;
}

function initSecuritySettings() {
  $("adminSecurityForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!db.account) return;
    const curPass = $("curMasterPass").value.trim();
    if (curPass !== db.account.password) {
      return showToast("Current Master Password ghalat hai!", "danger");
    }
    const newPass = $("newMasterPass").value.trim();
    const newPin = $("newAdminPin").value.trim();
    const q = $("curSecQuestion").value.trim();
    const a = $("curSecAnswer").value.trim().toLowerCase();

    if (!/^\d{4}$/.test(newPin)) return showToast("Admin PIN 4 digits ka hona chahiye.", "danger");

    if (newPass) db.account.password = newPass;
    db.account.pin = newPin;
    db.account.question = q;
    db.account.answer = a;
    saveDB();
    $("curMasterPass").value = "";
    $("newMasterPass").value = "";
    showToast("Principal Security Settings update ho gayin!", "success");
  });
}

function loadSecurityInputs() {
  if (!db.account) return;
  if ($("newAdminPin")) $("newAdminPin").value = db.account.pin || "";
  if ($("curSecQuestion")) $("curSecQuestion").value = db.account.question || "";
  if ($("curSecAnswer")) $("curSecAnswer").value = db.account.answer || "";
}

// ========================================================
// THEME & BACKGROUND STUDIO (5MB SUPPORT + MOBILE FIT)
// ========================================================
function buildBgCss(type, c1, c2, dir, imgUrl = "", overlay = 45) {
  if (type === "image" && imgUrl) {
    const alpha = Math.min(Math.max(overlay, 0), 85) / 100;
    const attach = window.innerWidth <= 768 ? "scroll" : "fixed";
    return `linear-gradient(rgba(7, 17, 24, ${alpha}), rgba(7, 17, 24, ${alpha})), url("${imgUrl}") center center / cover no-repeat ${attach}`;
  }
  if (type === "gradient") {
    if (dir === "radial") return `radial-gradient(circle at top, ${c1} 0%, ${c2} 80%)`;
    return `linear-gradient(${dir || "135deg"}, ${c1} 0%, ${c2} 100%)`;
  }
  return c1;
}

function compressBgImage(file, maxWidth = 1440, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function applyThemeToDOM(t) {
  const th = { ...DEFAULT_THEME, ...(t || {}) };
  document.body.style.background = buildBgCss(th.bodyType, th.bodyC1, th.bodyC2, th.bodyDir);
  const loginView = $("loginView");
  if (loginView) {
    loginView.style.background = buildBgCss(
      th.loginType,
      th.loginC1,
      th.loginC2,
      th.loginDir,
      th.loginImg,
      th.loginOverlay
    );
  }
}

function initThemeStudio() {
  let draftTheme = { ...db.theme };

  const renderSwatches = (containerId, presets, isBody) => {
    const box = $(containerId);
    if (!box) return;
    box.innerHTML = presets
      .map(
        (p, idx) => `
      <button type="button" class="theme-swatch" data-idx="${idx}" title="${esc(p.name)}"
        style="background: ${buildBgCss(p.type, p.c1, p.c2, p.dir)};"></button>`
      )
      .join("");

    box.addEventListener("click", (e) => {
      const btn = e.target.closest(".theme-swatch");
      if (!btn) return;
      const p = presets[parseInt(btn.dataset.idx, 10)];
      if (!p) return;
      if (isBody) {
        draftTheme.bodyType = p.type;
        draftTheme.bodyC1 = p.c1;
        draftTheme.bodyC2 = p.c2;
        draftTheme.bodyDir = p.dir;
      } else {
        draftTheme.loginType = p.type;
        draftTheme.loginC1 = p.c1;
        draftTheme.loginC2 = p.c2;
        draftTheme.loginDir = p.dir;
      }
      syncStudioUI();
    });
  };

  renderSwatches("bodyPresets", BODY_PRESETS, true);
  renderSwatches("loginPresets", LOGIN_PRESETS, false);

  const syncStudioUI = () => {
    if ($("bodyBgType")) $("bodyBgType").value = draftTheme.bodyType;
    if ($("bodyColor1")) $("bodyColor1").value = draftTheme.bodyC1;
    if ($("bodyColor2")) $("bodyColor2").value = draftTheme.bodyC2;
    if ($("bodyGradDir")) $("bodyGradDir").value = draftTheme.bodyDir;

    const isBodyGrad = draftTheme.bodyType === "gradient";
    $("bodyColor2Wrap")?.classList.toggle("d-none", !isBodyGrad);
    $("bodyDirWrap")?.classList.toggle("d-none", !isBodyGrad);

    if ($("loginBgType")) $("loginBgType").value = draftTheme.loginType;
    if ($("loginColor1")) $("loginColor1").value = draftTheme.loginC1;
    if ($("loginColor2")) $("loginColor2").value = draftTheme.loginC2;
    if ($("loginGradDir")) $("loginGradDir").value = draftTheme.loginDir;
    if ($("loginOverlayRange")) $("loginOverlayRange").value = draftTheme.loginOverlay;
    if ($("overlayValText")) $("overlayValText").textContent = `${draftTheme.loginOverlay}%`;

    const isLoginImg = draftTheme.loginType === "image";
    const isLoginGrad = draftTheme.loginType === "gradient";
    $("loginImgCtrl")?.classList.toggle("d-none", !isLoginImg);
    document.querySelectorAll(".login-color-ctrl").forEach((el) => el.classList.toggle("d-none", isLoginImg));
    document.querySelectorAll(".login-grad-ctrl").forEach((el) => el.classList.toggle("d-none", !isLoginGrad));

    const preview = $("loginPreviewBox");
    if (preview) {
      preview.style.background = buildBgCss(
        draftTheme.loginType,
        draftTheme.loginC1,
        draftTheme.loginC2,
        draftTheme.loginDir,
        draftTheme.loginImg,
        draftTheme.loginOverlay
      );
    }
    applyThemeToDOM(draftTheme);
  };

  ["bodyBgType", "bodyColor1", "bodyColor2", "bodyGradDir"].forEach((id) => {
    $(id)?.addEventListener("input", () => {
      draftTheme.bodyType = $("bodyBgType").value;
      draftTheme.bodyC1 = $("bodyColor1").value;
      draftTheme.bodyC2 = $("bodyColor2").value;
      draftTheme.bodyDir = $("bodyGradDir").value;
      syncStudioUI();
    });
  });

  ["loginBgType", "loginColor1", "loginColor2", "loginGradDir", "loginOverlayRange"].forEach((id) => {
    $(id)?.addEventListener("input", () => {
      draftTheme.loginType = $("loginBgType").value;
      draftTheme.loginC1 = $("loginColor1").value;
      draftTheme.loginC2 = $("loginColor2").value;
      draftTheme.loginDir = $("loginGradDir").value;
      draftTheme.loginOverlay = parseInt($("loginOverlayRange").value, 10) || 45;
      syncStudioUI();
    });
  });

  $("loginBgFile")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      return showToast("Image 5MB se choti honi chahiye.", "danger");
    }
    showToast("Image optimize ho rahi hai...", "info");
    draftTheme.loginImg = await compressBgImage(file, 1440, 0.82);
    draftTheme.loginType = "image";
    syncStudioUI();
    showToast("Background picture set ho gayi! Save & Apply dabayein.", "success");
  });

  $("removeLoginImgBtn")?.addEventListener("click", () => {
    draftTheme.loginImg = "";
    draftTheme.loginType = "gradient";
    if ($("loginBgFile")) $("loginBgFile").value = "";
    syncStudioUI();
  });

  $("saveThemeBtn")?.addEventListener("click", () => {
    db.theme = { ...draftTheme };
    saveDB();
    applyThemeToDOM(db.theme);
    showToast("Theme & Background Neon Cloud mein save ho gaya!", "success");
  });

  $("resetThemeBtn")?.addEventListener("click", () => {
    draftTheme = { ...DEFAULT_THEME };
    db.theme = { ...DEFAULT_THEME };
    saveDB();
    syncStudioUI();
    showToast("Default theme wapas aa gaya.", "info");
  });

  syncStudioUI();
}

// ========================================================
// EXPORT CSV (EXCEL)
// ========================================================
function initExportCSV() {
  $("exMode")?.addEventListener("change", () => {
    const isMonthly = $("exMode").value === "monthly";
    $("exDay")?.classList.toggle("d-none", isMonthly);
    $("exMonth")?.classList.toggle("d-none", !isMonthly);
  });

  $("exBtn")?.addEventListener("click", () => {
    const type = $("exType").value;
    const mode = $("exMode").value;
    const target = mode === "daily" ? $("exDay").value : $("exMonth").value;
    if (!target) return showToast("Date ya Month select karein.", "danger");

    const rows = [];
    if (type === "student") {
      rows.push(["Date", "Roll Number", "Student Name", "Father Name", "Class", "Section", "Status"]);
      Object.keys(db.studentAttendance)
        .filter((d) => (mode === "daily" ? d === target : d.startsWith(target)))
        .sort()
        .forEach((d) => {
          const dayMap = db.studentAttendance[d] || {};
          db.students.forEach((s) => {
            if (dayMap[s.id]) {
              rows.push([d, s.rollNumber, s.fullName, s.fatherName, s.class, s.section, dayMap[s.id]]);
            }
          });
        });
    } else {
      rows.push(["Date", "Staff ID", "Teacher Name", "Assigned Class", "Status", "Check-in Time"]);
      Object.keys(db.teacherAttendance)
        .filter((d) => (mode === "daily" ? d === target : d.startsWith(target)))
        .sort()
        .forEach((d) => {
          const dayMap = db.teacherAttendance[d] || {};
          db.teachers.forEach((t) => {
            if (dayMap[t.id]) {
              rows.push([d, t.staffId, t.name, `${t.assignedClass}-${t.assignedSection}`, dayMap[t.id].status, dayMap[t.id].time || "-"]);
            }
          });
        });
    }

    if (rows.length <= 1) {
      return showToast("Is tareekh/mahine ka koi record nahi mila.", "danger");
    }

    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GGPS_${type}_attendance_${target}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV file download ho gayi!", "success");
  });
}
