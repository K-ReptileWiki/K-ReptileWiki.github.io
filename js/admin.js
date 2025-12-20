import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://cpaikpjzlzzujwfgnanb.supabase.co",
  "sb_publishable_-dZ6xDssPQs29A_hHa2Irw_WxZ24NxB"
);

let currentUserRole = "user";

// 관리자 확인
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert("로그인 필요");
    location.href = "login.html";
    return;
  }

  // 프로필 조회 (id 기준)
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    alert("프로필 없음");
    location.href = "index.html";
    return;
  }

  currentUserRole = profile.role ?? "user";

  if (currentUserRole !== "admin") {
    alert("관리자만 접근 가능");
    location.href = "index.html";
    return;
  }

  // 관리자일 때만 실행
  loadUsers();
  loadPosts();
  loadComments();
  loadVisits();
});

/* 사용자 목록 */
async function loadUsers() {
  const ul = document.getElementById("userList");
  ul.innerHTML = "";

  const { data: users, error } = await supabase.from("profiles").select("*");
  if (error) {
    console.error("사용자 목록 불러오기 실패:", error);
    ul.textContent = "사용자 목록을 불러올 수 없습니다.";
    return;
  }

  users.forEach(u => {
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `
      <b>${u.nickname ?? "닉네임없음"}</b>
      <br>UID: ${u.id}
      <br>권한: ${u.role ?? "user"}
      <br><br>
      <button onclick="makeAdmin('${u.id}')">관리자 승격</button>
      <button onclick="removeAdmin('${u.id}')">관리자 해제</button>
    `;
    ul.appendChild(li);
  });
}

/* 글 목록 */
async function loadPosts() {
  const ul = document.getElementById("postList");
  ul.innerHTML = "";

  const { data: posts, error } = await supabase.from("wiki_posts").select("*");
  if (error) {
    console.error("글 목록 불러오기 실패:", error);
    ul.textContent = "글을 불러올 수 없습니다.";
    return;
  }

  posts.forEach(p => {
    const li = document.createElement("li");
    li.innerHTML = `
      <b>${p.title}</b> (작성자: ${p.author ?? "익명"})
      <br>
    `;
    if (currentUserRole === "admin") {
      li.innerHTML += `<button onclick="deletePost('${p.id}')">삭제</button>`;
    }
    ul.appendChild(li);
  });
}

/* 댓글 목록 */
async function loadComments() {
  const ul = document.getElementById("commentList");
  ul.innerHTML = "";

  const { data: comments, error } = await supabase.from("wiki_comments").select("*");
  if (error) {
    console.error("댓글 목록 불러오기 실패:", error);
    ul.textContent = "댓글을 불러올 수 없습니다.";
    return;
  }

  comments.forEach(c => {
    const li = document.createElement("li");
    li.innerHTML = `
      <p>${c.content}</p>
      <small>${c.author ?? "익명"} | ${new Date(c.time).toLocaleString()}</small>
      <br>
    `;
    if (currentUserRole === "admin") {
      li.innerHTML += `<button onclick="deleteComment('${c.id}')">삭제</button>`;
    }
    ul.appendChild(li);
  });
}

/* 방문 기록 목록 */
async function loadVisits() {
  const ul = document.getElementById("visitList");
  ul.innerHTML = "";

  const { data: visits, error } = await supabase.from("visits").select("*");
  if (error) {
    console.error("방문 기록 불러오기 실패:", error);
    ul.textContent = "방문 기록을 불러올 수 없습니다.";
    return;
  }

  visits.forEach(v => {
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `
      <b>${v.nickname ?? v.email ?? "익명"}</b>
      <br>UID: ${v.id}
      <br>총 방문 횟수: ${(v.times ?? []).length}
      <br>방문 기록:
      <ul>
        ${(v.times ?? []).map(t => `<li>${new Date(t).toLocaleString()}</li>`).join("")}
      </ul>
    `;
    ul.appendChild(li);
  });
}

/* 관리자 기능 함수 */
window.makeAdmin = async (uid) => {
  await supabase.from("profiles").update({ role: "admin" }).eq("id", uid);
  loadUsers();
};
window.removeAdmin = async (uid) => {
  await supabase.from("profiles").update({ role: "user" }).eq("id", uid);
  loadUsers();
};
window.deletePost = async (postId) => {
  await supabase.from("wiki_posts").delete().eq("id", postId);
  loadPosts();
};
window.deleteComment = async (commentId) => {
  await supabase.from("wiki_comments").delete().eq("id", commentId);
  loadComments();
};
