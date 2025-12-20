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

/* 관리자 확인 */
onAuthStateChanged(auth, async user => {
  if (!user) {
    alert("로그인 필요");
    location.href = "login.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists() || snap.data().role !== "admin") {
      alert("관리자만 접근 가능");
      location.href = "index.html"; // 일반 사용자는 메인 페이지로 이동
      return;
    }

    // 관리자일 때만 실행
    loadUsers();
    loadPosts();
    loadComments();
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
        <button onclick="deletePost('${p.id}')">삭제</button>
      `;
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
        <button onclick="deleteComment('${c.id}')">삭제</button>
      `;
      ul.appendChild(li);
    });
  } catch (e) {
    console.error("댓글 목록 불러오기 실패:", e);
    ul.textContent = "댓글을 불러올 수 없습니다.";
  }
}

/* 밴 */
window.ban = async (uid, days) => {
  if (!confirm("정말 밴할까요?")) return;

  const until = days === -1
    ? Timestamp.fromDate(new Date(8640000000000000)) // 영구 밴
    : Timestamp.fromDate(new Date(Date.now() + days * 86400000));

  try {
    await updateDoc(doc(db, "users", uid), { bannedUntil: until });
    alert("밴 완료");
    loadUsers();
  } catch (e) {
    console.error("밴 실패:", e);
    alert("밴 처리 중 오류 발생");
  }
};

/* 밴 해제 */
window.unban = async (uid) => {
  try {
    await updateDoc(doc(db, "users", uid), { bannedUntil: null });
    alert("밴 해제");
    loadUsers();
  } catch (e) {
    console.error("밴 해제 실패:", e);
    alert("밴 해제 중 오류 발생");
  }
};

/* 글 삭제 */
window.deletePost = async (postId) => {
  if (!confirm("정말 글을 삭제하시겠습니까?")) return;
  try {
    await deleteDoc(doc(db, "wiki_posts", postId));
    alert("글 삭제 완료");
    loadPosts();
  } catch (e) {
    console.error("글 삭제 실패:", e);
    alert("글 삭제 중 오류 발생");
  }
};

/* 댓글 삭제 */
window.deleteComment = async (commentId) => {
  if (!confirm("정말 댓글을 삭제하시겠습니까?")) return;
  try {
    await deleteDoc(doc(db, "wiki_comments", commentId));
    alert("댓글 삭제 완료");
    loadComments();
  } catch (e) {
    console.error("댓글 삭제 실패:", e);
    alert("댓글 삭제 중 오류 발생");
  }
};

/* 관리자 승격 */
window.makeAdmin = async (uid) => {
  if (!confirm("이 사용자를 관리자(admin)로 승격하시겠습니까?")) return;
  try {
    await updateDoc(doc(db, "users", uid), { role: "admin" });
    alert("관리자 승격 완료!");
    loadUsers();
  } catch (e) {
    console.error("관리자 승격 실패:", e);
    alert("승격 중 오류 발생");
  }
};

/* 관리자 해제 */
window.removeAdmin = async (uid) => {
  if (!confirm("이 사용자의 관리자 권한을 해제하시겠습니까?")) return;
  try {
    await updateDoc(doc(db, "users", uid), { role: "user" });
    alert("관리자 권한 해제 완료!");
    loadUsers();
  } catch (e) {
    console.error("관리자 해제 실패:", e);
    alert("해제 중 오류 발생");
  }
};
