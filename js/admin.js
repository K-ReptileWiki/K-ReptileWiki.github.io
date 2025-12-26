import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🔑 Supabase 설정
const SUPABASE_URL = "https://cpaikpjzlzzujwfgnanb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const usersDiv = document.getElementById("users");
const postsDiv = document.getElementById("posts");
const commentsDiv = document.getElementById("comments");
const logsDiv = document.getElementById("logs");

// 공통 에러 출력
function showError(el, msg) {
  el.innerHTML = `<div class="empty">❌ ${msg}</div>`;
}

// 🔐 로그인 + 권한 확인
async function checkAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    alert("로그인이 필요합니다.");
    location.href = "login.html";
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, nickname")
    .eq("id", user.id)
    .single();

  if (profileError) {
    alert("프로필 정보를 불러올 수 없습니다.");
    return null;
  }

  if (profile.role !== "owner") {
    alert("최고 관리자만 접근 가능합니다.");
    location.href = "index.html";
    return null;
  }

  return user;
}

// 👥 사용자 로드
async function loadUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    showError(usersDiv, "사용자 로딩 실패");
    return;
  }

  if (!data.length) {
    usersDiv.innerHTML = `<div class="empty">사용자 없음</div>`;
    return;
  }

  usersDiv.innerHTML = data.map(u => `
    <div class="card">
      <div class="card-content">
        <strong>${u.nickname}</strong>
        <span class="badge ${u.role === "owner" ? "badge-admin" : "badge-user"}">
          ${u.role}
        </span>
        <small>${new Date(u.created_at).toLocaleString()}</small>
      </div>
    </div>
  `).join("");
}

// 📝 게시글 로드
async function loadPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    showError(postsDiv, "게시글 로딩 실패");
    return;
  }

  if (!data.length) {
    postsDiv.innerHTML = `<div class="empty">게시글 없음</div>`;
    return;
  }

  postsDiv.innerHTML = data.map(p => `
    <div class="card">
      <div class="card-content">
        <strong>${p.title}</strong>
        <small>${new Date(p.created_at).toLocaleString()}</small>
      </div>
    </div>
  `).join("");
}

// 💬 댓글 로드
async function loadComments() {
  const { data, error } = await supabase
    .from("comments")
    .select("id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    showError(commentsDiv, "댓글 로딩 실패");
    return;
  }

  if (!data.length) {
    commentsDiv.innerHTML = `<div class="empty">댓글 없음</div>`;
    return;
  }

  commentsDiv.innerHTML = data.map(c => `
    <div class="card">
      <div class="card-content">
        ${c.content}
        <small>${new Date(c.created_at).toLocaleString()}</small>
      </div>
    </div>
  `).join("");
}

// 📜 로그 로드
async function loadLogs() {
  const { data, error } = await supabase
    .from("admin_logs")
    .select("action, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    showError(logsDiv, "로그 로딩 실패");
    return;
  }

  if (!data.length) {
    logsDiv.innerHTML = `<div class="empty">로그 없음</div>`;
    return;
  }

  logsDiv.innerHTML = data.map(l => `
    <div class="log">
      [${new Date(l.created_at).toLocaleString()}] ${l.action}
    </div>
  `).join("");
}

// 🚀 초기 실행
(async () => {
  const user = await checkAdmin();
  if (!user) return;

  await Promise.all([
    loadUsers(),
    loadPosts(),
    loadComments(),
    loadLogs()
  ]);
})();
