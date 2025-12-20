import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore, collection, getDocs,
  doc, getDoc, updateDoc, deleteDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* Firebase 초기화 */
const app = initializeApp({
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f"
});
const db = getFirestore(app);
const auth = getAuth(app);

let currentUserRole = "user"; // 로그인한 사용자의 권한 저장

/* 관리자 확인 */
onAuthStateChanged(auth, async user => {
  if (!user) {
    alert("로그인 필요");
    location.href = "login.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) {
      alert("사용자 문서 없음");
      location.href = "index.html";
      return;
    }

    currentUserRole = snap.data().role ?? "user";

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
  } catch (e) {
    console.error("관리자 확인 실패:", e);
    alert("권한 확인 중 오류 발생");
    location.href = "index.html";
  }
});

/* 사용자 목록 */
async function loadUsers() {
  const ul = document.getElementById("userList");
  ul.innerHTML = "";

  try {
    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.forEach(u => {
      const data = u.data();
      const li = document.createElement("li");

      const bannedUntil = data.bannedUntil?.toDate?.();
      const banned = bannedUntil && bannedUntil > new Date();

      li.className = "card";
      li.innerHTML = `
        <b>${data.nickname ?? "닉네임없음"}</b>
        <br>UID: ${u.id}
        <br>상태: ${banned ? "🚫 밴 중 (해제: " + bannedUntil.toLocaleDateString() + ")" : "정상"}
        <br>권한: ${data.role ?? "user"}
        <br><br>
        <button onclick="makeAdmin('${u.id}')">관리자 승격</button>
        <button onclick="removeAdmin('${u.id}')">관리자 해제</button>
        <br><br>
        <button onclick="ban('${u.id}',7)">1주 밴</button>
        <button onclick="ban('${u.id}',30)">1달 밴</button>
        <button onclick="ban('${u.id}',365)">1년 밴</button>
        <button onclick="ban('${u.id}',-1)">영구 밴</button>
        <button onclick="unban('${u.id}')">해제</button>
      `;
      ul.appendChild(li);
    });
  } catch (e) {
    console.error("사용자 목록 불러오기 실패:", e);
    ul.textContent = "사용자 목록을 불러올 수 없습니다.";
  }
}

/* 글 목록 */
async function loadPosts() {
  const ul = document.getElementById("postList");
  ul.innerHTML = "";

  try {
    const postsSnap = await getDocs(collection(db, "wiki_posts"));
    postsSnap.forEach(p => {
      const data = p.data();
      const li = document.createElement("li");

      li.innerHTML = `
        <b>${data.title}</b> (작성자: ${data.author ?? "익명"})
        <br>
      `;

      // 관리자만 삭제 버튼 표시 (익명 포함)
      if (currentUserRole === "admin") {
        li.innerHTML += `<button onclick="deletePost('${p.id}')">삭제</button>`;
      }

      ul.appendChild(li);
    });
  } catch (e) {
    console.error("글 목록 불러오기 실패:", e);
    ul.textContent = "글을 불러올 수 없습니다.";
  }
}

/* 댓글 목록 */
async function loadComments() {
  const ul = document.getElementById("commentList");
  ul.innerHTML = "";

  try {
    const commentsSnap = await getDocs(collection(db, "wiki_comments"));
    commentsSnap.forEach(c => {
      const data = c.data();
      const li = document.createElement("li");
      const time = data.time?.toDate?.() ?? new Date(data.time);

      li.innerHTML = `
        <p>${data.content}</p>
        <small>${data.author ?? "익명"} | ${time.toLocaleString()}</small>
        <br>
      `;

      // 관리자만 삭제 버튼 표시 (익명 포함)
      if (currentUserRole === "admin") {
        li.innerHTML += `<button onclick="deleteComment('${c.id}')">삭제</button>`;
      }

      ul.appendChild(li);
    });
  } catch (e) {
    console.error("댓글 목록 불러오기 실패:", e);
    ul.textContent = "댓글을 불러올 수 없습니다.";
  }
}

/* 방문 기록 목록 */
async function loadVisits() {
  const ul = document.getElementById("visitList");
  ul.innerHTML = "";

  try {
    const visitsSnap = await getDocs(collection(db, "visits"));
    visitsSnap.forEach(v => {
      const data = v.data();
      const li = document.createElement("li");

      li.className = "card";
      li.innerHTML = `
        <b>${data.nickname ?? data.email ?? "익명"}</b>
        <br>UID: ${v.id}
        <br>총 방문 횟수: ${data.times?.length ?? 0}
        <br>방문 기록:
        <ul>
          ${(data.times ?? []).map(t => `<li>${new Date(t.seconds*1000).toLocaleString()}</li>`).join("")}
        </ul>
      `;
      ul.appendChild(li);
    });
  } catch (e) {
    console.error("방문 기록 불러오기 실패:", e);
    ul.textContent = "방문 기록을 불러올 수 없습니다.";
  }
}

/* 밴/해제/삭제/승격/해제 함수는 기존 그대로 */
window.ban = async (uid, days) => { /* ... */ };
window.unban = async (uid) => { /* ... */ };
window.deletePost = async (postId) => { /* ... */ };
window.deleteComment = async (commentId) => { /* ... */ };
window.makeAdmin = async (uid) => { /* ... */ };
window.removeAdmin = async (uid) => { /* ... */ };
