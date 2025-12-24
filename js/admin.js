import { supabaseService, supabase } from "./supabase.js";

/* =========================
   Admin Guard
========================== */
async function requireAdmin() {
  await supabaseService.waitForAuth();

  if (!supabaseService.isLoggedIn()) {
    alert("로그인 필요");
    location.href = "login.html";
    throw new Error("로그인 필요");
  }

  if (!supabaseService.isAdmin()) {
    alert("관리자 권한 없음");
    location.href = "index.html";
    throw new Error("권한 없음");
  }
}

async function log(action, target) {
  await supabase.from("admin_logs").insert({
    admin_id: supabaseService.currentUser.id,
    action,
    target_id: target
  });
}

/* =========================
   Admin Service
========================== */
export const adminService = {
  /* ---------- USERS ---------- */
  async getUsers() {
    await requireAdmin();
    const { data } = await supabase.from("profiles").select("*");
    return data;
  },

  async getBlocks() {
    const { data } = await supabase.from("user_blocks").select("*");
    return data || [];
  },

  async blockUser(uid, reason, days) {
    let until = null;
    if (days) {
      until = new Date(Date.now() + days * 86400000).toISOString();
    }

    await supabase.from("user_blocks").upsert({
      user_id: uid,
      reason,
      blocked_until: until
    });

    await log("BLOCK_USER", uid);
  },

  async unblockUser(uid) {
    await supabase.from("user_blocks").delete().eq("user_id", uid);
    await log("UNBLOCK_USER", uid);
  },

  /* ---------- POSTS ---------- */
  async getPosts() {
    const { data } = await supabase
      .from("wiki_posts")
      .select("*")
      .order("time", { ascending: false });
    return data;
  },

  async deletePost(id) {
    await supabase.from("wiki_posts").update({ deleted: true }).eq("id", id);
    await log("DELETE_POST", id);
  },

  /* ---------- COMMENTS ---------- */
  async getComments() {
    const { data } = await supabase
      .from("wiki_comments")
      .select("*")
      .order("time", { ascending: false });
    return data;
  },

  async deleteComment(id) {
    await supabase.from("wiki_comments").delete().eq("id", id);
    await log("DELETE_COMMENT", id);
  },

  /* ---------- LOGS ---------- */
  async getLogs() {
    const { data } = await supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data;
  }
};

/* =========================
   UI LOADERS
========================== */
window.onload = async () => {
  await requireAdmin();
  loadUsers();
  loadPosts();
  loadComments();
  loadLogs();
};

/* ---------- USERS ---------- */
async function loadUsers() {
  const users = await adminService.getUsers();
  const blocks = await adminService.getBlocks();
  const map = {};
  blocks.forEach(b => map[b.user_id] = b);

  const box = document.getElementById("users");
  box.innerHTML = "";

  users.forEach(u => {
    const block = map[u.id];
    const status = block
      ? `⛔ ${block.blocked_until ? "임시" : "영구"}`
      : "정상";

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <b>${u.nickname}</b> (${u.role}) - ${status}<br>
      <button onclick="ban('${u.id}')">차단</button>
      <button onclick="unban('${u.id}')">해제</button>
    `;
    box.appendChild(div);
  });
}

/* ---------- POSTS ---------- */
async function loadPosts() {
  const posts = await adminService.getPosts();
  const box = document.getElementById("posts");
  box.innerHTML = "";

  posts.forEach(p => {
    box.innerHTML += `
      <div class="card">
        <b>${p.title}</b>
        <button onclick="delPost(${p.id})">삭제</button>
      </div>
    `;
  });
}

/* ---------- COMMENTS ---------- */
async function loadComments() {
  const comments = await adminService.getComments();
  const box = document.getElementById("comments");
  box.innerHTML = "";

  comments.forEach(c => {
    box.innerHTML += `
      <div class="card">
        ${c.content}
        <button onclick="delComment(${c.id})">삭제</button>
      </div>
    `;
  });
}

/* ---------- LOGS ---------- */
async function loadLogs() {
  const logs = await adminService.getLogs();
  const box = document.getElementById("logs");
  box.innerHTML = logs.map(l =>
    `<div class="log">${l.action} → ${l.target_id}</div>`
  ).join("");
}

/* ---------- ACTIONS ---------- */
window.ban = async (id) => {
  const reason = prompt("사유");
  const days = prompt("기간 (일, 비우면 영구)");
  await adminService.blockUser(id, reason, days ? Number(days) : null);
  loadUsers();
};

window.unban = async (id) => {
  await adminService.unblockUser(id);
  loadUsers();
};

window.delPost = async (id) => {
  if (confirm("게시글 삭제?")) {
    await adminService.deletePost(id);
    loadPosts();
  }
};

window.delComment = async (id) => {
  if (confirm("댓글 삭제?")) {
    await adminService.deleteComment(id);
    loadComments();
  }
};
