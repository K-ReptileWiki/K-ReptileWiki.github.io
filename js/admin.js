import { supabaseService, supabase } from "./supabase.js";

/* =========================
   Admin Guard
========================== */
async function requireAdmin() {
  await supabaseService.waitForAuth();

  if (!supabaseService.isLoggedIn()) {
    alert("로그인이 필요합니다");
    location.href = "login.html";
    throw new Error("로그인 필요");
  }

  if (!supabaseService.isAdmin()) {
    alert("관리자 권한이 필요합니다");
    location.href = "index.html";
    throw new Error("권한 없음");
  }
}

/* =========================
   Admin Service
========================== */
export const adminService = {
  /* ---------- USERS ---------- */
  async getUsers() {
    await requireAdmin();
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) {
      console.error("사용자 조회 실패:", error);
      return [];
    }
    return data || [];
  },

  async makeAdmin(uid) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", uid);
    
    if (error) throw new Error(error.message);
  },

  async removeAdmin(uid) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: "user" })
      .eq("id", uid);
    
    if (error) throw new Error(error.message);
  },

  /* ---------- POSTS ---------- */
  async getPosts() {
    const { data, error } = await supabase
      .from("wiki_posts")
      .select("*")
      .order("time", { ascending: false });
    
    if (error) {
      console.error("게시글 조회 실패:", error);
      return [];
    }
    return data || [];
  },

  async deletePost(id) {
    const { error } = await supabase
      .from("wiki_posts")
      .update({ deleted: true })
      .eq("id", id);
    
    if (error) throw new Error(error.message);
  },

  async restorePost(id) {
    const { error } = await supabase
      .from("wiki_posts")
      .update({ deleted: false })
      .eq("id", id);
    
    if (error) throw new Error(error.message);
  },

  /* ---------- COMMENTS ---------- */
  async getComments() {
    const { data, error } = await supabase
      .from("wiki_comments")
      .select("*")
      .order("time", { ascending: false });
    
    if (error) {
      console.error("댓글 조회 실패:", error);
      return [];
    }
    return data || [];
  },

  async deleteComment(id) {
    const { error } = await supabase
      .from("wiki_comments")
      .delete()
      .eq("id", id);
    
    if (error) throw new Error(error.message);
  }
};

/* =========================
   UI LOADERS
========================== */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await requireAdmin();
    await Promise.all([
      loadUsers(),
      loadPosts(),
      loadComments(),
      loadLogs()
    ]);
  } catch (err) {
    console.error("초기화 실패:", err);
  }
});

/* ---------- USERS ---------- */
async function loadUsers() {
  const box = document.getElementById("users");
  
  try {
    const users = await adminService.getUsers();
    
    if (!users || users.length === 0) {
      box.innerHTML = '<div class="empty">등록된 사용자가 없습니다</div>';
      return;
    }

    box.innerHTML = "";
    
    users.forEach(u => {
      const isAdmin = u.role === "admin";
      const roleClass = isAdmin ? "badge-admin" : "badge-user";
      
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="card-content">
          <strong>${u.nickname || u.email || "익명"}</strong>
          <span class="badge ${roleClass}">${u.role || "user"}</span>
          <small>UID: ${u.id}</small>
        </div>
        <div class="card-actions">
          ${!isAdmin 
            ? `<button class="btn btn-warning" onclick="makeAdmin('${u.id}')">관리자 승격</button>` 
            : `<button class="btn btn-secondary" onclick="removeAdmin('${u.id}')">관리자 해제</button>`
          }
        </div>
      `;
      box.appendChild(div);
    });
  } catch (err) {
    box.innerHTML = `<div class="empty">오류: ${err.message}</div>`;
  }
}

/* ---------- POSTS ---------- */
async function loadPosts() {
  const box = document.getElementById("posts");
  
  try {
    const posts = await adminService.getPosts();
    
    if (!posts || posts.length === 0) {
      box.innerHTML = '<div class="empty">게시글이 없습니다</div>';
      return;
    }

    box.innerHTML = "";
    
    posts.forEach(p => {
      const isDeleted = p.deleted;
      const statusClass = isDeleted ? "badge-blocked" : "badge-active";
      const statusText = isDeleted ? "삭제됨" : "활성";
      
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="card-content">
          <strong>${p.title}</strong>
          <span class="badge ${statusClass}">${statusText}</span>
          <small>작성자: ${p.author || "익명"} | ${new Date(p.time).toLocaleString()}</small>
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary" onclick="viewPost(${p.id})">보기</button>
          ${!isDeleted 
            ? `<button class="btn btn-danger" onclick="deletePost(${p.id})">삭제</button>`
            : `<button class="btn btn-success" onclick="restorePost(${p.id})">복원</button>`
          }
        </div>
      `;
      box.appendChild(div);
    });
  } catch (err) {
    box.innerHTML = `<div class="empty">오류: ${err.message}</div>`;
  }
}

/* ---------- COMMENTS ---------- */
async function loadComments() {
  const box = document.getElementById("comments");
  
  try {
    const comments = await adminService.getComments();
    
    if (!comments || comments.length === 0) {
      box.innerHTML = '<div class="empty">댓글이 없습니다</div>';
      return;
    }

    box.innerHTML = "";
    
    comments.forEach(c => {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="card-content">
          <strong>${c.content}</strong>
          <small>작성자: ${c.author || "익명"} | ${new Date(c.time).toLocaleString()}</small>
        </div>
        <div class="card-actions">
          <button class="btn btn-danger" onclick="deleteComment(${c.id})">삭제</button>
        </div>
      `;
      box.appendChild(div);
    });
  } catch (err) {
    box.innerHTML = `<div class="empty">오류: ${err.message}</div>`;
  }
}

/* ---------- LOGS ---------- */
async function loadLogs() {
  const box = document.getElementById("logs");
  box.innerHTML = '<div class="empty">활동 로그 기능은 준비 중입니다</div>';
}

/* ---------- GLOBAL ACTIONS ---------- */
window.makeAdmin = async (uid) => {
  if (!confirm("이 사용자를 관리자로 승격하시겠습니까?")) return;
  
  try {
    await adminService.makeAdmin(uid);
    alert("관리자로 승격되었습니다");
    await loadUsers();
  } catch (err) {
    alert("승격 실패: " + err.message);
  }
};

window.removeAdmin = async (uid) => {
  if (!confirm("이 사용자의 관리자 권한을 해제하시겠습니까?")) return;
  
  try {
    await adminService.removeAdmin(uid);
    alert("관리자 권한이 해제되었습니다");
    await loadUsers();
  } catch (err) {
    alert("해제 실패: " + err.message);
  }
};

window.viewPost = (id) => {
  window.open(`post.html?id=${id}`, "_blank");
};

window.deletePost = async (id) => {
  if (!confirm("이 게시글을 삭제하시겠습니까?")) return;
  
  try {
    await adminService.deletePost(id);
    alert("게시글이 삭제되었습니다");
    await loadPosts();
  } catch (err) {
    alert("삭제 실패: " + err.message);
  }
};

window.restorePost = async (id) => {
  if (!confirm("이 게시글을 복원하시겠습니까?")) return;
  
  try {
    await adminService.restorePost(id);
    alert("게시글이 복원되었습니다");
    await loadPosts();
  } catch (err) {
    alert("복원 실패: " + err.message);
  }
};

window.deleteComment = async (id) => {
  if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
  
  try {
    await adminService.deleteComment(id);
    alert("댓글이 삭제되었습니다");
    await loadComments();
  } catch (err) {
    alert("삭제 실패: " + err.message);
  }
};
