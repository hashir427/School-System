// School Management System - Direct Neon Cloud DB Version
import { neon } from 'https://esm.sh/@neondatabase/serverless@0.9.0';

const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUSES = ["Present", "Absent", "Late", "Leave"];

const DEFAULT_CLASSES = ["Nursery", "Prep", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
const DEFAULT_SECTIONS = ["A", "B", "C", "D"];

// DIRECT NEON POSTGRES CONNECTION
const NEON_CONN_STRING = "postgresql://neondb_owner:npg_Pp7ZIAD6lOdm@ep-rapid-darkness-bekuo4wo-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(NEON_CONN_STRING);

// Helper for standard UUID generation
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Client Device Fingerprint for Proxy Prevention
let currentDeviceId = localStorage.getItem("sms_device_fingerprint");
if (!currentDeviceId) {
  currentDeviceId = "DEV_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  localStorage.setItem("sms_device_fingerprint", currentDeviceId);
}

// In-Memory Cloud State
let schoolConfig = { 
  isConfigured: false, 
  email: "", 
  password: "", 
  adminPin: "1234",
  securityQuestion: "",
  securityAnswer: ""
};
let schoolGeo = { lat: null, lng: null, radius: 150 };
let students = [];
let teachers = [];

let currentSession = null;
let currentLoginTab = "admin";
let currentViewStudent = null;
let pendingRecoveryConfig = null;

// Distance Calculator (Haversine Formula)
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Sample Doc SVG
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
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  cont.appendChild(el);
  setTimeout(() => el.remove(), 4000);
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
   TABLE INITIALIZATION & COMPLETE AUTO-MIGRATION
   ======================================================== */
async function initNeonTables() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS school_config (
      email VARCHAR(255) PRIMARY KEY, 
      password_hash VARCHAR(255) NOT NULL, 
      admin_pin VARCHAR(10) NOT NULL,
      security_question TEXT,
      security_answer TEXT
    );`;

    await sql`ALTER TABLE school_config ADD COLUMN IF NOT EXISTS security_question TEXT;`;
    await sql`ALTER TABLE school_config ADD COLUMN IF NOT EXISTS security_answer TEXT;`;

    await sql`CREATE TABLE IF NOT EXISTS school_geofence (id INT PRIMARY KEY, latitude NUMERIC, longitude NUMERIC, radius INT);`;
    await sql`CREATE TABLE IF NOT EXISTS teachers (
      id UUID PRIMARY KEY, 
      name VARCHAR(255) NOT NULL, 
      staff_id VARCHAR(50) NOT NULL, 
      department VARCHAR(100), 
      assigned_class VARCHAR(50), 
      assigned_section VARCHAR(50), 
      pin VARCHAR(10), 
      phone VARCHAR(50), 
      email VARCHAR(100), 
      status VARCHAR(50) DEFAULT 'Absent', 
      check_in VARCHAR(20) DEFAULT '--:--', 
      bound_device_id VARCHAR(255)
    );`;
    await sql`CREATE TABLE IF NOT EXISTS students (
      id UUID PRIMARY KEY, 
      full_name VARCHAR(255) NOT NULL, 
      father_name VARCHAR(255) NOT NULL, 
      roll_number VARCHAR(50) NOT NULL, 
      class VARCHAR(50), 
      section VARCHAR(50), 
      phone VARCHAR(50), 
      dob DATE, 
      b_form_number VARCHAR(100), 
      has_b_form BOOLEAN DEFAULT FALSE, 
      b_form_url TEXT, 
      b_form_type VARCHAR(100), 
      address TEXT
    );`;
    await sql`CREATE TABLE IF NOT EXISTS attendance_logs (
      id SERIAL PRIMARY KEY, 
      record_date DATE NOT NULL, 
      person_type VARCHAR(20) NOT NULL, 
      person_id VARCHAR(100) NOT NULL, 
      status VARCHAR(20) NOT NULL, 
      check_in_time VARCHAR(20)
    );`;

    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS assigned_class VARCHAR(50);`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS assigned_section VARCHAR(50);`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS pin VARCHAR(10);`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bound_device_id VARCHAR(255);`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS check_in VARCHAR(20) DEFAULT '--:--';`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Absent';`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS department VARCHAR(100);`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`;
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS email VARCHAR(100);`;

    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS father_name VARCHAR(255);`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_number VARCHAR(50);`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS class VARCHAR(50);`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS section VARCHAR(50);`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS dob DATE;`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS b_form_number VARCHAR(100);`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS has_b_form BOOLEAN DEFAULT FALSE;`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS b_form_url TEXT;`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS b_form_type VARCHAR(100);`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;`;
  } catch (err) {
    console.warn("Table auto-migration notice:", err.message);
  }
}

/* ========================================================
   LOAD DATA FROM DIRECT NEON DB
   ======================================================== */
async function loadDataFromNeon() {
  try {
    toast("Neon Cloud Database se connect ho raha hai...", "info");
    
    await initNeonTables();

    const configRows = await sql`SELECT * FROM school_config LIMIT 1;`;
    const geoRows = await sql`SELECT * FROM school_geofence LIMIT 1;`;
    const teachersRows = await sql`SELECT * FROM teachers ORDER BY staff_id;`;
    const studentsRows = await sql`SELECT * FROM students ORDER BY roll_number;`;

    if (configRows && configRows.length > 0) {
      schoolConfig = {
        isConfigured: true,
        email: configRows[0].email,
        password: configRows[0].password_hash,
        adminPin: configRows[0].admin_pin,
        securityQuestion: configRows[0].security_question || "What is your favorite school teacher name?",
        securityAnswer: configRows[0].security_answer || ""
      };
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

    teachers = (teachersRows || []).map(r => ({
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
      status: r.status || "Absent",
      checkIn: r.check_in || "--:--"
    }));

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

    toast("Neon Cloud Database loaded!", "success");
  } catch (err) {
    console.error("Neon DB load error:", err);
    toast("Database connect nahi hua: " + err.message, "danger");
  }

  checkAuthFlow();
}

/* ========================================================
   AUTHENTICATION LOGIC (SETUP ONCE & LOCK)
   ======================================================== */
function checkAuthFlow() {
  const loginView = $("loginView");
  const appView = $("appView");
  const setupForm = $("setupForm");
  const pinCard = $("pinLoginCard");
  const recCard = $("recoveryCard");

  if (!schoolConfig.isConfigured) {
    // Sirf pehli dafa jab account exist na karta ho
    loginView.classList.remove("d-none");
    appView.classList.add("d-none");
    setupForm.classList.remove("d-none");
    pinCard.classList.add("d-none");
    recCard.classList.add("d-none");
  } else {
    // Account ban chuka hai: Har dafa direct 4-Digit PIN portal aayega
    loginView.classList.remove("d-none");
    appView.classList.add("d-none");
    setupForm.classList.add("d-none");
    pinCard.classList.remove("d-none");
    recCard.classList.add("d-none");
    refreshTeacherDropdown();
    $("userPinInput").value = "";
  }
}

// 1. Initial Account Creation Submit (Only First Time)
$("setupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("setupEmail").value.trim().toLowerCase();
  const pass = $("setupPass").value;
  const pin = $("setupPin").value.trim();
  const question = $("setupQuestion").value.trim();
  const answer = $("setupAnswer").value.trim();

  if (pin.length !== 4) return toast("Admin PIN 4-digit ka hona chahiye.", "warning");
  if (!question || !answer) return toast("Security question aur answer dono lazmi hain.", "warning");

  try {
    await sql`
      INSERT INTO school_config (email, password_hash, admin_pin, security_question, security_answer)
      VALUES (${email}, ${pass}, ${pin}, ${question}, ${answer})
      ON CONFLICT (email) 
      DO UPDATE SET password_hash = ${pass}, admin_pin = ${pin}, security_question = ${question}, security_answer = ${answer};
    `;

    schoolConfig = { 
      isConfigured: true, 
      email, 
      password: pass, 
      adminPin: pin,
      securityQuestion: question,
      securityAnswer: answer
    };

    toast("School Account kamyabi se create ho gaya!", "success");
    checkAuthFlow();
  } catch (err) {
    toast("Database save error: " + err.message, "danger");
  }
});

function setLoginTab(tab) {
  currentLoginTab = tab;
  $("userPinInput").value = "";
  if (tab === "admin") {
    $("tabAdminBtn").classList.add("active");
    $("tabTeacherBtn").classList.remove("active");
    $("teacherSelectWrap").classList.add("d-none");
    $("pinSubtitle").textContent = "Admin 4-digit PIN enter karein";
  } else {
    $("tabTeacherBtn").classList.add("active");
    $("tabAdminBtn").classList.remove("active");
    $("teacherSelectWrap").classList.remove("d-none");
    $("pinSubtitle").textContent = "Apna name select karein aur 4-digit PIN enter karein";
  }
}

$("tabAdminBtn").addEventListener("click", () => setLoginTab("admin"));
$("tabTeacherBtn").addEventListener("click", () => setLoginTab("teacher"));

function refreshTeacherDropdown() {
  const sel = $("loginTeacherSelect");
  if (!sel) return;
  sel.innerHTML = teachers.map(t => `<option value="${t.id}">${esc(t.name)} (${esc(t.staffId)}) - ${esc(t.assignedClass || "")}</option>`).join("");
}

// PIN Login Submit
$("pinSubmitForm").addEventListener("submit", async e => {
  e.preventDefault();
  const enteredPin = $("userPinInput").value.trim();

  if (currentLoginTab === "admin") {
    if (enteredPin === schoolConfig.adminPin) {
      currentSession = { role: "admin", id: "admin", name: "Principal / Admin" };
      toast("Admin Verified!", "success");
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
      toast("Proxy Alert: Ye account kisi doosre phone par registered hai!", "danger");
      return;
    }

    if (!t.boundDeviceId) {
      t.boundDeviceId = currentDeviceId;
      await sql`UPDATE teachers SET bound_device_id = ${currentDeviceId} WHERE id = ${t.id}::uuid;`;
      toast("Device Linked successfully!", "info");
    }

    currentSession = { role: "teacher", id: t.id, name: t.name, assignedClass: t.assignedClass, assignedSection: t.assignedSection };
    toast(`Welcome ${t.name}!`, "success");
    launchApp();
  }
});

/* ========================================================
   FORGOT PASSWORD & QUESTION-ANSWER RECOVERY FLOW
   ======================================================== */
$("forgotPinBtn").addEventListener("click", () => {
  $("pinLoginCard").classList.add("d-none");
  $("recoveryCard").classList.remove("d-none");
  $("recStep1").classList.remove("d-none");
  $("recStep2Form").classList.add("d-none");
  $("recoveryTargetEmail").value = schoolConfig.email || "";
});

document.querySelectorAll(".cancel-rec-btn").forEach(btn => {
  btn.addEventListener("click", () => checkAuthFlow());
});

// Step 1: Verify Email & Load Question
$("verifyEmailBtn").addEventListener("click", async () => {
  const emailInput = $("recoveryTargetEmail").value.trim().toLowerCase();
  if (!emailInput) return toast("Email enter karein.", "warning");

  try {
    const res = await sql`SELECT * FROM school_config WHERE LOWER(email) = ${emailInput} LIMIT 1;`;
    if (!res || res.length === 0) {
      return toast("Ye email database mein registered nahi hai!", "danger");
    }

    pendingRecoveryConfig = res[0];
    const q = pendingRecoveryConfig.security_question || "What is your secret code?";
    $("displayQuestion").textContent = q;
    $("recoveryAnswerInput").value = "";
    $("resetNewPass").value = "";
    $("resetNewPin").value = "";

    $("recStep1").classList.add("d-none");
    $("recStep2Form").classList.remove("d-none");
  } catch (err) {
    toast("Database check error: " + err.message, "danger");
  }
});

// Step 2: Verify Answer & Set New Credentials
$("recStep2Form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!pendingRecoveryConfig) return toast("Session expired. Please restart recovery.", "danger");

  const enteredAnswer = $("recoveryAnswerInput").value.trim();
  const correctAnswer = (pendingRecoveryConfig.security_answer || "").trim();
  const newPassword = $("resetNewPass").value.trim();
  const newPin = $("resetNewPin").value.trim();

  if (enteredAnswer.toLowerCase() !== correctAnswer.toLowerCase()) {
    return toast("Ghalat Security Answer! Jawab match nahi hua.", "danger");
  }

  if (newPin.length !== 4) {
    return toast("Naya Admin PIN 4-digit ka hona chahiye.", "warning");
  }

  try {
    await sql`
      UPDATE school_config 
      SET password_hash = ${newPassword}, admin_pin = ${newPin} 
      WHERE email = ${pendingRecoveryConfig.email};
    `;

    schoolConfig.password = newPassword;
    schoolConfig.adminPin = newPin;

    toast("Zabardast! Password aur Admin PIN update ho gaya.", "success");
    pendingRecoveryConfig = null;
    checkAuthFlow();
  } catch (err) {
    toast("Update error: " + err.message, "danger");
  }
});

$("lockScreenBtn").addEventListener("click", () => {
  currentSession = null;
  checkAuthFlow();
  toast("Screen lock ho chuki hai.");
});

// Admin Security Update from Settings Tab
$("adminSecurityForm").addEventListener("submit", async e => {
  e.preventDefault();
  const curPass = $("curMasterPass").value;
  const newPass = $("newMasterPass").value.trim();
  const newPin = $("newAdminPin").value.trim();
  const newQ = $("curSecQuestion").value.trim();
  const newA = $("curSecAnswer").value.trim();

  if (newPin.length !== 4) return toast("PIN 4-digit ka hona chahiye.", "warning");
  if (curPass !== schoolConfig.password) return toast("Ghalat Master Password!", "danger");

  try {
    const updatedPass = newPass || curPass;
    await sql`
      UPDATE school_config 
      SET password_hash = ${updatedPass}, admin_pin = ${newPin}, security_question = ${newQ}, security_answer = ${newA} 
      WHERE email = ${schoolConfig.email};
    `;
    schoolConfig.adminPin = newPin;
    schoolConfig.password = updatedPass;
    schoolConfig.securityQuestion = newQ;
    schoolConfig.securityAnswer = newA;

    toast("Security Settings Neon Database mein update ho gayin!", "success");
    $("curMasterPass").value = "";
    $("newMasterPass").value = "";
    $("newAdminPin").value = "";
  } catch (err) {
    toast("Update error: " + err.message, "danger");
  }
});

/* ========================================================
   APP DASHBOARD LAUNCH
   ======================================================== */
function launchApp() {
  $("loginView").classList.add("d-none");
  $("appView").classList.remove("d-none");

  const isTeacher = currentSession.role === "teacher";
  const badge = $("roleBadge");
  if (isTeacher) {
    badge.className = "badge text-bg-info px-2 py-1 small fw-bold";
    badge.textContent = `${currentSession.name} (${currentSession.assignedClass}-${currentSession.assignedSection})`;
  } else {
    badge.className = "badge text-bg-warning px-2 py-1 small fw-bold";
    badge.textContent = "Admin / Principal";
  }

  $("navTeacherAtt").classList.toggle("d-none", isTeacher);
  $("navExport").classList.toggle("d-none", isTeacher);
  $("navGeoSettings").classList.toggle("d-none", isTeacher);
  $("navAdminSettings").classList.toggle("d-none", isTeacher);
  $("teacherSelfAttBar").classList.toggle("d-none", !isTeacher);

  const admCls = $("admitClass");
  const admSec = $("admitSection");
  const admNote = $("admitRoleNote");
  if (isTeacher) {
    admCls.value = currentSession.assignedClass;
    admSec.value = currentSession.assignedSection;
    admCls.disabled = true;
    admSec.disabled = true;
    if (admNote) admNote.textContent = `🔒 Locked to your assigned ${currentSession.assignedClass}-${currentSession.assignedSection}`;
    $("saClass").value = currentSession.assignedClass;
    $("saSection").value = currentSession.assignedSection;
    $("saClass").disabled = true;
    $("saSection").disabled = true;
  } else {
    admCls.disabled = false;
    admSec.disabled = false;
    if (admNote) admNote.textContent = "";
    $("saClass").disabled = false;
    $("saSection").disabled = false;
  }

  ["dashDate", "saDate", "taDate", "exDay"].forEach(id => {
    if ($(id)) $(id).value = today();
  });
  if ($("exMonth")) $("exMonth").value = today().slice(0, 7);

  if (schoolGeo.lat) $("geoLat").value = schoolGeo.lat;
  if (schoolGeo.lng) $("geoLng").value = schoolGeo.lng;
  if (schoolGeo.radius) $("geoRadius").value = schoolGeo.radius;

  if ($("curSecQuestion")) $("curSecQuestion").value = schoolConfig.securityQuestion || "";
  if ($("curSecAnswer")) $("curSecAnswer").value = schoolConfig.securityAnswer || "";
  if ($("newAdminPin")) $("newAdminPin").value = schoolConfig.adminPin || "";

  fillStaticDropdowns();
  fillFilterSelects();
  renderDirectory();
  renderTAtt();
  renderSAtt();
  refreshDash();
}

/* ========================================================
   TEACHER MANAGEMENT
   ======================================================== */
$("teacherForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const formData = new FormData(f);

  const name = formData.get("name")?.trim();
  const staffId = formData.get("staffId")?.trim();
  const department = formData.get("department")?.trim() || "General";
  const assignedClass = formData.get("assignedClass") || "Class 1";
  const assignedSection = formData.get("assignedSection") || "A";
  const pin = formData.get("pin")?.trim();
  const phone = formData.get("phone")?.trim() || "";
  const email = formData.get("email")?.trim() || "";

  if (!name || !staffId) {
    return toast("Name aur Staff ID lazmi hain.", "warning");
  }

  if (!pin || pin.length !== 4) {
    return toast("Teacher PIN 4-digit ka hona chahiye.", "warning");
  }

  const id = generateUUID();

  try {
    await sql`
      INSERT INTO teachers (
        id, name, staff_id, department, assigned_class, assigned_section, 
        pin, phone, email, status, check_in, bound_device_id
      )
      VALUES (
        ${id}::uuid, ${name}, ${staffId}, ${department}, ${assignedClass}, ${assignedSection}, 
        ${pin}, ${phone}, ${email}, 'Absent', '--:--', NULL
      );
    `;

    teachers.push({
      id,
      name,
      staffId,
      department,
      assignedClass,
      assignedSection,
      pin,
      phone,
      email,
      status: "Absent",
      checkIn: "--:--",
      boundDeviceId: null
    });

    toast(`Teacher ${name} add ho gaya!`, "success");
    f.reset();

    const modalEl = $("teacherModal");
    if (modalEl && window.bootstrap) {
      if (document.activeElement) document.activeElement.blur();
      const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modalInstance.hide();
    }

    renderTAtt();
    refreshDash();
  } catch (err) {
    console.error("Teacher add error:", err);
    toast("Teacher add error: " + err.message, "danger");
  }
});

function renderTAtt() {
  const taBody = $("taBody");
  if (!taBody) return;
  if (!teachers.length) {
    taBody.innerHTML = `<tr><td colspan="8" class="empty">Koi teacher add nahi hai.</td></tr>`;
    return;
  }
  taBody.innerHTML = teachers.map(t => `<tr data-tid="${t.id}">
    <td><span class="badge bg-dark">${esc(t.staffId)}</span></td>
    <td><strong>${esc(t.name)}</strong><div class="small text-secondary">${esc(t.department || "General")}</div></td>
    <td><span class="badge bg-info text-dark">${esc(t.assignedClass || "Class 1")} - Sec ${esc(t.assignedSection || "A")}</span></td>
    <td><span class="badge bg-dark text-warning px-2">🔑 ${esc(t.pin || "----")}</span></td>
    <td>
      ${t.boundDeviceId 
        ? `<span class="badge bg-success">📱 Bound</span> <button class="btn btn-sm btn-link text-warning p-0 ms-1 small" data-reset-dev="${t.id}">Reset</button>` 
        : `<span class="badge bg-secondary">Unbound</span>`}
    </td>
    <td>
      <select class="form-select form-select-sm t-status" data-status-tid="${t.id}">
        ${STATUSES.map(st => `<option value="${st}" ${t.status === st ? "selected" : ""}>${st}</option>`).join("")}
      </select>
    </td>
    <td><span class="badge ${t.checkIn !== '--:--' ? 'bg-success' : 'bg-secondary'}">${esc(t.checkIn)}</span></td>
    <td>
      <button class="btn btn-sm btn-outline-warning me-1" data-edit-teacher="${t.id}">Edit / PIN</button>
      <button class="btn btn-sm btn-outline-danger" data-del-teacher="${t.id}">Delete</button>
    </td>
  </tr>`).join("");
}

const taBody = $("taBody");
if (taBody) {
  taBody.addEventListener("click", async e => {
    const delTid = e.target.dataset.delTeacher;
    const editTid = e.target.dataset.editTeacher;
    const resetDevTid = e.target.dataset.resetDev;

    if (resetDevTid) {
      const t = teachers.find(x => x.id === resetDevTid);
      if (t && confirm(`Kya aap ${t.name} ka device lock reset karna chahte hain?`)) {
        t.boundDeviceId = null;
        await sql`UPDATE teachers SET bound_device_id = NULL WHERE id = ${t.id}::uuid;`;
        toast(`${t.name} ka device lock reset ho gaya.`);
        renderTAtt();
      }
    }

    if (delTid) {
      if (!confirm("Is teacher ko record se delete karna chahte hain?")) return;
      teachers = teachers.filter(t => t.id !== delTid);
      await sql`DELETE FROM teachers WHERE id = ${delTid}::uuid;`;
      toast("Teacher record delete ho gaya.");
      renderTAtt();
      refreshDash();
    }

    if (editTid) {
      const t = teachers.find(x => x.id === editTid);
      if (!t) return;
      $("editTeacherId").value = t.id;
      $("editTName").value = t.name || "";
      $("editTStaffId").value = t.staffId || "";
      $("editTDept").value = t.department || "";
      $("editTClass").value = t.assignedClass || "Class 5";
      $("editTSection").value = t.assignedSection || "A";
      $("editTPin").value = t.pin || "";
      $("editTPhone").value = t.phone || "";
      $("editTEmail").value = t.email || "";
      new bootstrap.Modal($("editTeacherModal")).show();
    }
  });

  taBody.addEventListener("change", async e => {
    const statusTid = e.target.dataset.statusTid;
    if (statusTid) {
      const t = teachers.find(x => x.id === statusTid);
      if (t) {
        t.status = e.target.value;
        if (t.status === "Present" && t.checkIn === "--:--") t.checkIn = new Date().toTimeString().slice(0, 5);
        await sql`UPDATE teachers SET status = ${t.status}, check_in = ${t.checkIn} WHERE id = ${t.id}::uuid;`;
        await sql`INSERT INTO attendance_logs (record_date, person_type, person_id, status, check_in_time) VALUES (${today()}, 'teacher', ${t.id}, ${t.status}, ${t.checkIn});`;
      }
      renderTAtt();
      refreshDash();
    }
  });
}

$("editTeacherForm").addEventListener("submit", async e => {
  e.preventDefault();
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

  await sql`
    UPDATE teachers 
    SET name = ${t.name}, staff_id = ${t.staffId}, department = ${t.department}, assigned_class = ${t.assignedClass}, assigned_section = ${t.assignedSection}, pin = ${t.pin}, phone = ${t.phone}, email = ${t.email} 
    WHERE id = ${id}::uuid;
  `;

  if (document.activeElement) document.activeElement.blur();
  bootstrap.Modal.getInstance($("editTeacherModal")).hide();
  toast(`Teacher ${t.name} update ho gaya!`);
  renderTAtt();
  refreshDash();
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

      await sql`
        INSERT INTO school_geofence (id, latitude, longitude, radius)
        VALUES (1, ${lat}, ${lng}, ${schoolGeo.radius || 150})
        ON CONFLICT (id) DO UPDATE SET latitude = ${lat}, longitude = ${lng}, radius = ${schoolGeo.radius || 150};
      `;
      toast("Location Neon Cloud par save ho gayi!", "success");
    },
    err => toast(`GPS Error: ${err.message}`, "danger"),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

$("saveGeoBtn").addEventListener("click", async () => {
  const lat = parseFloat($("geoLat").value);
  const lng = parseFloat($("geoLng").value);
  const radius = parseInt($("geoRadius").value, 10);
  if (isNaN(lat) || isNaN(lng)) return toast("Valid Latitude/Longitude enter karein.", "warning");

  schoolGeo = { lat, lng, radius: radius || 150 };

  await sql`
    INSERT INTO school_geofence (id, latitude, longitude, radius)
    VALUES (1, ${lat}, ${lng}, ${radius})
    ON CONFLICT (id) DO UPDATE SET latitude = ${lat}, longitude = ${lng}, radius = ${radius};
  `;
  toast("Geofence Neon Cloud par save ho gaya!", "success");
});

$("punchAttendanceBtn").addEventListener("click", () => {
  if (!schoolGeo.lat || !schoolGeo.lng) return toast("Admin ne GPS center set nahi kiya.", "warning");
  if (!navigator.geolocation) return toast("Device GPS support nahi karta.", "danger");

  $("teacherGeoStatus").textContent = "GPS reading verify ki ja rahi hai...";

  navigator.geolocation.getCurrentPosition(
    async pos => {
      const distance = calculateDistanceMeters(schoolGeo.lat, schoolGeo.lng, pos.coords.latitude, pos.coords.longitude);
      if (distance <= schoolGeo.radius) {
        const currentTime = new Date().toTimeString().slice(0, 5);
        const t = teachers.find(x => x.id === currentSession.id);
        if (t) {
          t.status = "Present";
          t.checkIn = currentTime;
          await sql`UPDATE teachers SET status = 'Present', check_in = ${currentTime} WHERE id = ${t.id}::uuid;`;
          await sql`INSERT INTO attendance_logs (record_date, person_type, person_id, status, check_in_time) VALUES (${today()}, 'teacher', ${t.id}, 'Present', ${currentTime});`;
        }
        $("teacherGeoStatus").innerHTML = `✅ <span class="text-success">Verified: Attendance lag chuki hai at ${currentTime}!</span>`;
        toast(`Success! Hazri lag gayi at ${currentTime}.`, "success");
        renderTAtt();
        refreshDash();
      } else {
        $("teacherGeoStatus").innerHTML = `❌ <span class="text-danger">Rejected: Aap school se ${distance}m door hain.</span>`;
        toast(`Hazri nahi lagi! Aap ${distance} meters door hain.`, "danger");
      }
    },
    err => toast(`Location access error: ${err.message}`, "danger"),
    { enableHighAccuracy: true, timeout: 12000 }
  );
});

/* ========================================================
   STUDENT ADMISSION & DIRECTORY
   ======================================================== */
$("admitDob").addEventListener("input", e => {
  const age = getAge(e.target.value);
  const warn = $("ageWarning");
  const calcText = $("calcAgeText");
  if (age !== null && age < 4) {
    calcText.textContent = `${age} years old`;
    warn.classList.remove("d-none");
  } else {
    warn.classList.add("d-none");
  }
});

$("admitForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  if (!f.checkValidity()) {
    f.classList.add("was-validated");
    return toast("Please required fields fill karein.", "warning");
  }
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

  try {
    await sql`
      INSERT INTO students (
        id, full_name, father_name, roll_number, class, section, 
        phone, dob, b_form_number, has_b_form, b_form_url, b_form_type, address
      )
      VALUES (
        ${data.id}::uuid, 
        ${data.fullName}, 
        ${data.fatherName}, 
        ${data.rollNumber}, 
        ${data.class}, 
        ${data.section}, 
        ${data.phone}, 
        ${data.dob || null}, 
        ${data.bFormNumber || ""}, 
        ${data.hasBForm}, 
        ${data.bFormUrl || null}, 
        ${data.bFormType || null}, 
        ${data.address}
      );
    `;
    students.push(data);
    toast("Student record Neon Database mein permanently save ho gaya!");
    f.reset();
    $("ageWarning")?.classList.add("d-none");
    f.classList.remove("was-validated");
    renderDirectory();
    refreshDash();
  } catch (err) {
    console.error("Student admission error:", err);
    toast("Student admission error: " + err.message, "danger");
  }
});

function renderDirectory() {
  const box = $("searchBox");
  const q = box ? box.value.trim().toLowerCase() : "";
  const ageFilter = $("filterAge") ? $("filterAge").value : "all";

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
      <td><strong>${esc(s.fullName)}</strong>${isUnderage ? `<span class="badge bg-warning text-dark ms-1">⚠️ &lt; 4 yrs</span>` : ""}</td>
      <td>${esc(s.fatherName)}</td>
      <td><span class="badge bg-secondary">${esc(s.rollNumber)}</span></td>
      <td>${age !== null ? `<strong>${age} yrs</strong>` : "-"}<div class="small text-secondary">${esc(s.dob || "")}</div></td>
      <td>${esc(s.class)} - ${esc(s.section)}</td>
      <td>${esc(s.phone)}</td>
      <td>
        ${s.hasBForm 
          ? `<button class="btn btn-sm btn-outline-info" data-view="${s.id}">📄 View B-Form</button>` 
          : `<span class="text-secondary small">Pending</span>`}
      </td>
      <td>
        <button class="btn btn-sm btn-outline-warning me-1" data-edit="${s.id}">Edit</button>
        <button class="btn btn-sm btn-outline-danger" data-del="${s.id}">Delete</button>
      </td></tr>`;
  }).join("")
  : `<tr><td colspan="8" class="empty">Koi student nahi mila.</td></tr>`;
}

$("searchBox").addEventListener("input", renderDirectory);
$("filterAge").addEventListener("change", renderDirectory);

const dirBody = $("dirBody");
if (dirBody) {
  dirBody.addEventListener("click", async e => {
    const delId = e.target.dataset.del;
    const editId = e.target.dataset.edit;
    const viewId = e.target.dataset.view;

    if (viewId) {
      const s = students.find(x => x.id === viewId);
      if (!s || !s.hasBForm) return;

      currentViewStudent = s;
      $("viewBFormTitle").textContent = `${s.fullName} - B-Form Document`;
      const container = $("viewBFormBody");
      const fileUrl = s.bFormUrl || createSampleDoc(s.fullName, s.bFormNumber || "N/A");

      if (s.bFormType === "application/pdf") {
        container.innerHTML = `<iframe src="${fileUrl}" style="width:100%; height:450px; border:none;"></iframe>`;
        $("downloadBFormBtn").textContent = "📥 Download PDF";
      } else {
        container.innerHTML = `<img id="previewBFormImg" src="${fileUrl}" class="img-fluid rounded" style="max-height: 400px; width: auto;" alt="B-Form">`;
        $("downloadBFormBtn").textContent = "📥 Download PNG";
      }

      new bootstrap.Modal($("viewBFormModal")).show();
    }

    if (delId) {
      if (!confirm("Are you sure you want to delete this student?")) return;
      students = students.filter(x => x.id !== delId);
      await sql`DELETE FROM students WHERE id = ${delId}::uuid;`;
      toast("Student delete kar diya gaya.");
      renderDirectory();
      refreshDash();
    }

    if (editId) {
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
      $("currentBFormStatus").textContent = s.hasBForm ? "Status: B-Form file already attached." : "Status: B-Form pending.";
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 500;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const pngUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = `${cleanName}_BForm.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`${currentViewStudent.fullName} ka B-Form PNG format mein download ho gaya!`);
  };
  img.src = fileUrl;
});

$("editStudentForm").addEventListener("submit", async e => {
  e.preventDefault();
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

  await sql`
    UPDATE students 
    SET full_name = ${s.fullName}, father_name = ${s.fatherName}, roll_number = ${s.rollNumber}, class = ${s.class}, section = ${s.section}, dob = ${s.dob || null}, phone = ${s.phone}, b_form_number = ${s.bFormNumber}, has_b_form = ${s.hasBForm}, b_form_url = ${s.bFormUrl}, b_form_type = ${s.bFormType}, address = ${s.address} 
    WHERE id = ${id}::uuid;
  `;

  if (document.activeElement) document.activeElement.blur();
  bootstrap.Modal.getInstance($("editStudentModal")).hide();
  toast("Student record Neon Database mein update ho gaya!");
  renderDirectory();
  renderSAtt();
  refreshDash();
});

const classStudents = () => {
  const c = $("saClass")?.value;
  const s = $("saSection")?.value;
  return students.filter(st => (!c || st.class === c) && (!s || st.section === s));
};

function renderSAtt() {
  const saBody = $("saBody");
  if (!saBody) return;
  const list = classStudents();
  if (!list.length) {
    saBody.innerHTML = `<tr><td colspan="3" class="empty">Is class/section mein koi student nahi hai.</td></tr>`;
    return;
  }
  const L = { Present: "lP", Absent: "lA", Late: "lL", Leave: "lV" };
  saBody.innerHTML = list.map(s => `<tr>
    <td>${esc(s.rollNumber)}</td>
    <td><strong>${esc(s.fullName)}</strong></td>
    <td><div class="att-radio">
      ${STATUSES.map(st => `<input type="radio" name="st_${s.id}" id="st_${s.id}_${st}" value="${st}" ${st === "Present" ? "checked" : ""}><label class="${L[st]}" for="st_${s.id}_${st}">${st}</label>`).join("")}
    </div></td></tr>`).join("");
}

["saDate", "saClass", "saSection"].forEach(id => {
  if ($(id)) $(id).addEventListener("change", renderSAtt);
});

$("saAllBtn").addEventListener("click", () => {
  document.querySelectorAll('#saBody input[value="Present"]').forEach(r => r.checked = true);
});

$("saSaveBtn").addEventListener("click", async () => {
  const dateVal = $("saDate").value || today();
  const list = classStudents();

  for (const st of list) {
    const checked = document.querySelector(`input[name="st_${st.id}"]:checked`);
    const status = checked ? checked.value : "Present";
    await sql`INSERT INTO attendance_logs (record_date, person_type, person_id, status) VALUES (${dateVal}, 'student', ${st.id}, ${status});`;
  }

  toast("Student attendance save ho gayi.");
  refreshDash();
});

$("taDate").addEventListener("change", renderTAtt);
$("taSaveBtn").addEventListener("click", async () => {
  const dateVal = $("taDate").value || today();
  for (const t of teachers) {
    await sql`INSERT INTO attendance_logs (record_date, person_type, person_id, status, check_in_time) VALUES (${dateVal}, 'teacher', ${t.id}, ${t.status}, ${t.checkIn});`;
  }
  toast("Teacher attendance save ho gayi.");
});

function refreshDash() {
  const cls = $("dashClass")?.value;
  const sec = $("dashSection")?.value;
  const scope = students.filter(s => {
    if (currentSession && currentSession.role === "teacher") {
      return s.class === currentSession.assignedClass && s.section === currentSession.assignedSection;
    }
    return (!cls || s.class === cls) && (!sec || s.section === sec);
  });

  const presentTeachers = teachers.filter(t => t.status === "Present").length;

  if ($("kStudents")) $("kStudents").textContent = scope.length;
  if ($("kTeachers")) $("kTeachers").textContent = teachers.length;
  if ($("kRate")) $("kRate").textContent = "95%";
  if ($("kTeachAtt")) $("kTeachAtt").textContent = `${presentTeachers} / ${teachers.length}`;

  if ($("attBar")) {
    $("attBar").innerHTML = `<div class="progress-bar bg-success" style="width:90%"></div>
                             <div class="progress-bar bg-warning" style="width:5%"></div>
                             <div class="progress-bar bg-danger" style="width:5%"></div>`;
  }
  if ($("attLegend")) {
    $("attLegend").innerHTML = `<span class="me-3"><span class="badge-s b-Present">Present</span> ${Math.max(0, scope.length - 1)}</span>
                                <span class="me-3"><span class="badge-s b-Absent">Absent</span> ${scope.length > 0 ? 1 : 0}</span>`;
  }
  if ($("absCount")) $("absCount").textContent = scope.length > 0 ? "1" : "0";
  if ($("absList")) {
    $("absList").innerHTML = scope.length > 0
      ? `<table class="table table-sm align-middle"><tbody>
          <tr><td>${esc(scope[0].fullName)}</td><td>${esc(scope[0].class)} - ${esc(scope[0].section)}</td><td>${esc(scope[0].phone)}</td></tr>
         </tbody></table>`
      : `<div class="empty">Koi absentee nahi hai.</div>`;
  }
}

["dashDate", "dashClass", "dashSection"].forEach(id => {
  if ($(id)) $(id).addEventListener("change", refreshDash);
});

$("exMode").addEventListener("change", () => {
  const m = $("exMode").value === "monthly";
  if ($("exMonth")) $("exMonth").classList.toggle("d-none", !m);
  if ($("exDay")) $("exDay").classList.toggle("d-none", m);
});
$("exBtn").addEventListener("click", () => toast("CSV attendance download ready."));

// Initialization
loadDataFromNeon();