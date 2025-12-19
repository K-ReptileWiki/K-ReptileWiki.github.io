import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* Firebase 초기화 */
const app = initializeApp({
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f"
});
const db = getFirestore(app);
const auth = getAuth(app);

/* Quill 에디터 초기화 */
const quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],        // 굵기, 기울임, 밑줄
      [{ 'color': [] }, { 'background': [] }], // 글자색, 배경색
      [{ 'size': ['small', false, 'large', 'huge'] }], // 글자 크기
    ]
  }
});

/* 로그인 */
signInAnonymously(auth);

let currentUser = null;
let userData = { nickname: "익명" };

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUser = user;
  document.getElementById("postBtn").disabled = false;
  initPosts();
});

/* 글 작성 및 목록 */
function initPosts() {
  const postsRef = collection(db, "wiki_posts");

  // 글 목록 실시간 표시
  onSnapshot(postsRef, snap => {
    const list = document.getElementById("postList");
    list.innerHTML = "";
    snap.forEach(d => {
      const p = d.data();
      const div = document.createElement("div");
      div.className = "post-card";
      div.innerHTML = `
        <h3>${p.title}</h3>
        <div>${p.content}</div>
        <small>작성자: ${p.author ?? "익명"} | ${p.time?.toDate?.().toLocaleString()}</small>
      `;
      list.appendChild(div);
    });
  });

  // 글 작성 버튼
  document.getElementById("postBtn").addEventListener("click", async () => {
    const title = document.getElementById("postTitle").value.trim();
    const content = quill.root.innerHTML;
    if (!title || !content) return alert("제목과 내용을 입력하세요");

    await addDoc(postsRef, {
      uid: currentUser.uid,
      author: userData.nickname,
      title,
      content,
      time: serverTimestamp()
    });

    document.getElementById("postTitle").value = "";
    quill.root.innerHTML = "";
  });
}
