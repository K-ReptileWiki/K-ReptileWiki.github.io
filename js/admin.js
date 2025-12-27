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
  try {
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
      .maybeSingle();

    if (error || !profile) {
      console.error("프로필 조회 실패:", error);
      alert("프로필 조회 실패. 다시 로그인해주세요.");
      location.href = "login.html";
      throw new Error("PROFILE_ERROR");
    }

    if (!["owner", "admin"].includes(profile.role)) {
      alert("관리자 권한이 없습니다");
      location.href = "index.html";
      throw new Error("NO_PERMISSION");
    }

    currentUser = user;
    currentProfile = profile;
    
    console.log("✅ 관리자 인증 완료:", profile.nickname, profile.role);
  } catch (error) {
    console.error("❌ requireAdmin 오류:", error);
    throw error;
  }
}

/* =========================
   STATS
========================= */
async function loadStats() {
  try {
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
  } catch (error) {
    console.error("통계 로드 실패:", error);
    showError(statsDiv, "통계 로드 실패");
  }
}

/* =========================
   USERS
========================= */
async function loadUsers() {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nickname, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("사용자 로드 실패:", error);
      return showError(usersDiv, "사용자 로딩 실패");
    }
    
    if (!data || data.length === 0) {
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
                   onclick="window.promoteUser('${u.id}', '${u.nickname}')">관리자 승급</button>`
              : ""
          }
        </div>
      `;
      usersDiv.appendChild(div);
    });
  } catch (error) {
    console.error("loadUsers 오류:", error);
    showError(usersDiv, "사용자 로드 중 오류 발생");
  }
}

window.promoteUser = async (uid, nickname) => {
  if (!confirm(`${nickname}님을 관리자로 승급할까요?`)) return;

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", uid);

    if (error) {
      console.error("승급 실패:", error);
      alert("승급 실패: " + error.message);
      return;
    }

    // 로그 기록 (실패해도 승급은 성공)
    await logAction(`ROLE → admin (${nickname})`);
    
    alert("승급 완료!");
    await loadUsers();
  } catch (error) {
    console.error("promoteUser 오류:", error);
    alert("승급 처리 중 오류 발생");
  }
};

/* =========================
   POSTS
========================= */
async function loadPosts() {
  try {
    const { data, error } = await supabase
      .from("wiki_posts")
      .select("id, title, time, deleted")
      .order("time", { ascending: false })
      .limit(20);

    if (error) {
      console.error("게시글 로드 실패:", error);
      return showError(postsDiv, "게시글 로딩 실패");
    }

    if (!data || data.length === 0) {
      postsDiv.innerHTML = `<div class="empty">게시글 없음</div>`;
      return;
    }

    postsDiv.innerHTML = data.map(p => `
      <div class="card">
        <div class="card-content">
          <strong>${p.title}</strong>
          ${p.deleted ? '<span style="color:red;">(삭제됨)</span>' : ''}
          <small>${new Date(p.time).toLocaleString()}</small>
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary" onclick="location.href='post.html?id=${p.id}'">보기</button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error("loadPosts 오류:", error);
    showError(postsDiv, "게시글 로드 중 오류 발생");
  }
}

/* =========================
   COMMENTS
========================= */
async function loadComments() {
  try {
    const { data, error } = await supabase
      .from("wiki_comments")
      .select("id, content, time, author")
      .order("time", { ascending: false })
      .limit(20);

    if (error) {
      console.error("댓글 로드 실패:", error);
      return showError(commentsDiv, "댓글 로딩 실패");
    }
    
    if (!data || data.length === 0) {
      commentsDiv.innerHTML = `<div class="empty">댓글 없음</div>`;
      return;
    }

    commentsDiv.innerHTML = data.map(c => `
      <div class="card">
        <div class="card-content">
          <strong>${c.author || '익명'}</strong>: ${c.content}
          <small>${new Date(c.time).toLocaleString()}</small>
        </div>
        <div class="card-actions">
          <button class="btn btn-danger"
            onclick="window.deleteComment('${c.id}', '${c.content.substring(0, 20)}')">삭제</button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error("loadComments 오류:", error);
    showError(commentsDiv, "댓글 로드 중 오류 발생");
  }
}

window.deleteComment = async (id, preview) => {
  if (!confirm(`"${preview}..." 댓글을 삭제할까요?`)) return;

  try {
    const { error } = await supabase
      .from("wiki_comments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("댓글 삭제 실패:", error);
      alert("삭제 실패: " + error.message);
      return;
    }

    // 로그 기록 (실패해도 삭제는 성공)
    await logAction(`DELETE COMMENT (${id})`);
    
    alert("삭제 완료!");
    await loadComments();
  } catch (error) {
    console.error("deleteComment 오류:", error);
    alert("삭제 처리 중 오류 발생");
  }
};

/* =========================
   LOGS
========================= */
async function loadLogs(keyword = "") {
  try {
    let q = supabase
      .from("admin_logs")
      .select("action, created_at, actor")
      .order("created_at", { ascending: false })
      .limit(50);

    if (keyword) {
      q = q.ilike("action", `%${keyword}%`);
    }

    const { data, error } = await q;
    
    if (error) {
      console.error("로그 로드 실패:", error);
      // admin_logs 테이블이 없을 수 있으므로 경고만 표시
      logsDiv.innerHTML = `<div class="empty">⚠️ 로그 테이블이 없거나 권한이 없습니다</div>`;
      return;
    }
    
    if (!data || data.length === 0) {
      logsDiv.innerHTML = `<div class="empty">로그 없음</div>`;
      return;
    }

    logsDiv.innerHTML = data.map(l => `
      <div class="log">
        [${new Date(l.created_at).toLocaleString()}] ${l.action}
      </div>
    `).join("");
  } catch (error) {
    console.error("loadLogs 오류:", error);
    logsDiv.innerHTML = `<div class="empty">⚠️ 로그를 불러올 수 없습니다</div>`;
  }
}

window.searchLogs = () => {
  const q = document.getElementById("logSearch").value;
  loadLogs(q);
};

async function logAction(action) {
  try {
    const { error } = await supabase
      .from("admin_logs")
      .insert({
        action,
        actor: currentUser.id,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error("로그 기록 실패:", error);
      // 로그 실패는 무시 (중요한 작업은 아니므로)
    }
  } catch (error) {
    console.error("logAction 오류:", error);
    // 로그 실패는 무시
  }
}

/* =========================
   INIT
========================= */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("🔧 관리자 패널 초기화 시작");
    
    await requireAdmin();
    
    console.log("📊 데이터 로딩 시작");
    await Promise.all([
      loadStats(),
      loadUsers(),
      loadPosts(),
      loadComments(),
      loadLogs()
    ]);
    
    console.log("✅ 관리자 패널 초기화 완료");
  } catch (e) {
    console.error("❌ 초기화 실패:", e);
  }
});
