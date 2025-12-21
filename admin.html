import { supabaseService, supabase } from "./supabase.js";

let currentUserRole = "user";

// 관리자 확인
document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ DOMContentLoaded 실행됨");

  // 로그인 및 관리자 권한 확인
  if (!supabaseService.isLoggedIn()) {
    alert("로그인이 필요합니다");
    location.href = "login.html";
    return;
  }

  if (!supabaseService.isAdmin()) {
    alert("관리자만 접근 가능합니다");
    location.href = "index.html";
    return;
  }

  const { data } = supabaseService.getCurrentUser();
  currentUserRole = data?.role ?? "user";
  console.log("👤 현재 사용자 권한:", currentUserRole);

  console.log("✅ 관리자 권한 확인됨, 데이터 로딩 시작");
  loadUsers();
  loadPosts();
  loadComments();
  loadVisits();
});

/* 사용자 목록 */
async function loadUsers() {
  console.log("📥 사용자 목록 불러오기 시도");
  const ul = document.getElementById("userList");
  ul.innerHTML = "";

  const { data: users, error } = await supabase.from("profiles").select("*");
  console.log("🔎 사용자 데이터:", users, "에러:", error);

  if (error) {
    console.error("❌ 사용자 목록 불러오기 실패:", error);
    ul.textContent = "사용자 목록을 불러올 수 없습니다.";
    return;
  }

  if (!users || users.length === 0) {
    ul.textContent = "사용자가 없습니다.";
    return;
  }

  users.forEach(u => {
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `
      <b>${u.nickname ?? "닉네임없음"}</b>
      <br>이메일: ${u.email ?? "없음"}
      <br>UID: ${u.id}
      <br>권한: ${u.role ?? "user"}
      <br><br>
      ${u.role !== "admin" 
        ? `<button onclick="makeAdmin('${u.id}')">관리자 승격</button>` 
        : `<button onclick="removeAdmin('${u.id}')">관리자 해제</button>`
      }
    `;
    ul.appendChild(li);
  });
}

/* 글 목록 */
async function loadPosts() {
  console.log("📥 글 목록 불러오기 시도");
  const ul = document.getElementById("postList");
  ul.innerHTML = "";

  const { data: posts, error } = await supabase
    .from("wiki_posts")
    .select("*")
    .order("time", { ascending: false });
  console.log("🔎 글 데이터:", posts, "에러:", error);

  if (error) {
    console.error("❌ 글 목록 불러오기 실패:", error);
    ul.textContent = "글을 불러올 수 없습니다.";
    return;
  }

  if (!posts || posts.length === 0) {
    ul.textContent = "글이 없습니다.";
    return;
  }

  posts.forEach(p => {
    const li = document.createElement("li");
    li.className = "card";
    
    // 내용 미리보기
    const plainText = p.content?.replace(/<[^>]+>/g, "").substring(0, 100) ?? "";
    
    li.innerHTML = `
      <b>${p.title}</b>
      <p style="color:#666;font-size:14px;">${plainText}...</p>
      <small>작성자: ${p.author ?? "익명"} | ${new Date(p.time).toLocaleString()}</small>
      <br><br>
      ${currentUserRole === "admin" 
        ? `<button onclick="deletePost('${p.id}')">삭제</button>
           <button onclick="viewPost('${p.id}')">보기</button>` 
        : ""
      }
    `;
    ul.appendChild(li);
  });
}

/* 댓글 목록 */
async function loadComments() {
  console.log("📥 댓글 목록 불러오기 시도");
  const ul = document.getElementById("commentList");
  ul.innerHTML = "";

  const { data: comments, error } = await supabase
    .from("wiki_comments")
    .select("*")
    .order("time", { ascending: false });
  console.log("🔎 댓글 데이터:", comments, "에러:", error);

  if (error) {
    console.error("❌ 댓글 목록 불러오기 실패:", error);
    ul.textContent = "댓글을 불러올 수 없습니다.";
    return;
  }

  if (!comments || comments.length === 0) {
    ul.textContent = "댓글이 없습니다.";
    return;
  }

  comments.forEach(c => {
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `
      <p>${c.content}</p>
      <small>${c.author ?? "익명"} | ${new Date(c.time).toLocaleString()}</small>
      <br><br>
      ${currentUserRole === "admin" 
        ? `<button onclick="deleteComment('${c.id}')">삭제</button>` 
        : ""
      }
    `;
    ul.appendChild(li);
  });
}

/* 방문 기록 목록 */
async function loadVisits() {
  console.log("📥 방문 기록 불러오기 시도");
  const ul = document.getElementById("visitList");
  ul.innerHTML = "";

  const { data: visits, error } = await supabase.from("visits").select("*");
  console.log("🔎 방문 기록 데이터:", visits, "에러:", error);

  if (error) {
    console.error("❌ 방문 기록 불러오기 실패:", error);
    ul.textContent = "방문 기록을 불러올 수 없습니다.";
    return;
  }

  if (!visits || visits.length === 0) {
    ul.textContent = "방문 기록이 없습니다.";
    return;
  }

  visits.forEach(v => {
    const li = document.createElement("li");
    li.className = "card";
    
    // 방문 횟수 계산
    const visitCount = Array.isArray(v.times) ? v.times.length : 0;
    const visitList = Array.isArray(v.times) 
      ? v.times.map(t => `<li>${new Date(t).toLocaleString()}</li>`).join("")
      : "<li>기록 없음</li>";
    
    li.innerHTML = `
      <b>${v.nickname ?? v.email ?? "익명"}</b>
      <br>UID: ${v.id}
      <br>총 방문 횟수: ${visitCount}회
      <br>최근 방문 기록:
      <ul style="max-height:150px;overflow-y:auto;">
        ${visitList}
      </ul>
    `;
    ul.appendChild(li);
  });
}

/* 관리자 기능 함수 */
window.makeAdmin = async (uid) => {
  if (!confirm("이 사용자를 관리자로 승격하시겠습니까?")) return;
  
  console.log("⚡ makeAdmin 실행:", uid);
  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", uid);
  
  if (error) {
    console.error("❌ 관리자 승격 실패:", error);
    alert("승격 실패: " + error.message);
  } else {
    alert("관리자로 승격되었습니다");
    loadUsers();
  }
};

window.removeAdmin = async (uid) => {
  if (!confirm("이 사용자의 관리자 권한을 해제하시겠습니까?")) return;
  
  console.log("⚡ removeAdmin 실행:", uid);
  const { error } = await supabase
    .from("profiles")
    .update({ role: "user" })
    .eq("id", uid);
  
  if (error) {
    console.error("❌ 관리자 해제 실패:", error);
    alert("해제 실패: " + error.message);
  } else {
    alert("관리자 권한이 해제되었습니다");
    loadUsers();
  }
};

window.deletePost = async (postId) => {
  if (!confirm("정말 이 글을 삭제하시겠습니까?")) return;
  
  console.log("⚡ deletePost 실행:", postId);
  const { error } = await supabase
    .from("wiki_posts")
    .delete()
    .eq("id", postId);
  
  if (error) {
    console.error("❌ 글 삭제 실패:", error);
    alert("삭제 실패: " + error.message);
  } else {
    alert("글이 삭제되었습니다");
    loadPosts();
  }
};

window.viewPost = (postId) => {
  window.open(`post.html?id=${postId}`, "_blank");
};

window.deleteComment = async (commentId) => {
  if (!confirm("정말 이 댓글을 삭제하시겠습니까?")) return;
  
  console.log("⚡ deleteComment 실행:", commentId);
  const { error } = await supabase
    .from("wiki_comments")
    .delete()
    .eq("id", commentId);
  
  if (error) {
    console.error("❌ 댓글 삭제 실패:", error);
    alert("삭제 실패: " + error.message);
  } else {
    alert("댓글이 삭제되었습니다");
    loadComments();
  }
};
