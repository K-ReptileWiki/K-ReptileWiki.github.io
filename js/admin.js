import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   Supabase 설정
========================= */
const SUPABASE_URL = "https://cpaikpjzlzzujwfgnanb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================
   DOM
========================= */
const usersDiv = document.getElementById("users");
const postsDiv = document.getElementById("posts");
const commentsDiv = document.getElementById("comments");
const logsDiv = document.getElementById("logs");
const statsDiv = document.getElementById("stats");

/* =========================
   Utils
========================= */
function showError(el, msg) {
  el.innerHTML = `<div class="empty">❌ ${msg}</div>`;
}

function roleBadge(role) {
  if (role === "owner") return "badge-owner";
  if (role === "admin") return "badge-mod";
  return "badge-user";
}

/* =========================
   AUTH / ROLE
========================= */
let currentUser = null;
let currentProfile = null;

async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !session.user) {
    alert("로그인이 필요합니다");
    location.href = "login.html";
    throw new Error("NO_SESSION");
  }

  const user = session.user;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, nickname, role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    alert("프로필 조회 실패");
    throw new Error("PROFILE_ERROR");
  }

  if (!["owner", "admin"].includes(profile.role)) {
    alert("관리자 권한이 없습니다");
    location.href = "index.html";
    throw new Error("NO_PERMISSION");
  }

  currentUser = user;
  currentProfile = profile;
}

/* =========================
   STATS
========================= */
async function loadStats() {
  const [{ count: users }, { count: posts }, { count: comments }] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("wiki_posts").select("*", { count: "exact", head: true }),
      supabase.from("wiki_comments").select("*", { count: "exact", head: true })
    ]);

  statsDiv.innerHTML = `
    <div class="stat-box"><strong>${users ?? 0}</strong> 사용자</div>
    <div class="stat-box"><strong>${posts ?? 0}</strong> 게시글</div>
    <div class="stat-box"><strong>${comments ?? 0}</strong> 댓글</div>
  `;
}

/* =========================
   USERS
========================= */
async function loadUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, role, created_at")
    .order("created_at", { ascending: false });

  if (error) return showError(usersDiv, "사용자 로딩 실패");
  if (!data.length) {
    usersDiv.innerHTML = `<div class="empty">사용자 없음</div>`;
    return;
  }

  usersDiv.innerHTML = "";
  data.forEach(u => {
    const canPromote = currentProfile.role === "owner" && u.role !== "owner";

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="card-content">
        <strong>${u.nickname || "익명"}</strong>
        <span class="badge ${roleBadge(u.role)}">${u.role}</span>
        <small>${new Date(u.created_at).toLocaleString()}</small>
      </div>
      <div class="card-actions">
        ${
          canPromote
            ? `<button class="btn btn-warning"
                 onclick="promoteUser('${u.id}')">관리자</button>`
            : ""
        }
      </div>
    `;
    usersDiv.appendChild(div);
  });
}

window.promoteUser = async (uid) => {
  if (!confirm("이 사용자를 admin으로 승급할까요?")) return;

  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", uid);

  if (error) return alert("승급 실패");
  await logAction(`ROLE → admin (${uid})`);
  loadUsers();
};

/* =========================
   POSTS
========================= */
async function loadPosts() {
  const { data, error } = await supabase
    .from("wiki_posts")
    .select("id, title, time")
    .order("time", { ascending: false })
    .limit(20);

  if (error) return showError(postsDiv, "게시글 로딩 실패");

  postsDiv.innerHTML = data.map(p => `
    <div class="card">
      <div class="card-content">
        <strong>${p.title}</strong>
        <small>${new Date(p.time).toLocaleString()}</small>
      </div>
    </div>
  `).join("");
}

/* =========================
   COMMENTS
========================= */
async function loadComments() {
  const { data, error } = await supabase
    .from("wiki_comments")
    .select("id, content, time")
    .order("time", { ascending: false })
    .limit(20);

  if (error) return showError(commentsDiv, "댓글 로딩 실패");
  if (!data.length) {
    commentsDiv.innerHTML = `<div class="empty">댓글 없음</div>`;
    return;
  }

  commentsDiv.innerHTML = data.map(c => `
    <div class="card">
      <div class="card-content">
        ${c.content}
        <small>${new Date(c.time).toLocaleString()}</small>
      </div>
      <div class="card-actions">
        <button class="btn btn-danger"
          onclick="deleteComment('${c.id}')">삭제</button>
      </div>
    </div>
  `).join("");
}

window.deleteComment = async (id) => {
  if (!confirm("댓글을 삭제할까요?")) return;

  await supabase.from("wiki_comments").delete().eq("id", id);
  await logAction(`DELETE COMMENT (${id})`);
  loadComments();
};

/* =========================
   LOGS
========================= */
async function loadLogs(keyword = "") {
  let q = supabase
    .from("admin_logs")
    .select("action, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (keyword) q = q.ilike("action", `%${keyword}%`);

  const { data, error } = await q;
  if (error || !data.length) {
    logsDiv.innerHTML = `<div class="empty">로그 없음</div>`;
    return;
  }

  logsDiv.innerHTML = data.map(l => `
    <div class="log">
      [${new Date(l.created_at).toLocaleString()}] ${l.action}
    </div>
  `).join("");
}

window.searchLogs = () => {
  const q = document.getElementById("logSearch").value;
  loadLogs(q);
};

async function logAction(action) {
  await supabase.from("admin_logs").insert({
    action,
    actor: currentUser.id
  });
}

/* =========================
   INIT
========================= */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await requireAdmin();
    await Promise.all([
      loadStats(),
      loadUsers(),
      loadPosts(),
      loadComments(),
      loadLogs()
    ]);
  } catch (e) {
    console.error(e);
  }
});
