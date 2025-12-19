import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

/* Firebase 초기화 */
const app = initializeApp({
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f"
});
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

/* Quill 에디터 초기화 */
const quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'], // 굵기, 기울임, 밑줄
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }], // h1~h6 크기
      [{ 'color': [
        '#000000', // 검정
        '#FF0000', // 빨강
        '#0000FF', // 파랑
        '#008000', // 초록
        '#FFA500', // 주황
        '#800080', // 보라
        '#A52A2A', // 갈색
        '#FFD700'  // 금색
      ] }],
      [{ 'background': [] }], // 배경색
      ['link'] // 링크 삽입
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

      // 이미지 표시
      let imgHtml = "";
      if (p.images && Array.isArray(p.images)) {
        imgHtml = p.images.map(url => `<img src="${url}" style="max-width:200px;margin:5px;">`).join("");
      }

      div.innerHTML = `
        <h3>${p.title}</h3>
        <div>${p.content}</div>
        ${imgHtml}
        <small>작성자: ${p.author ?? "익명"} | ${p.time?.toDate?.().toLocaleString()}</small>
      `;
      list.appendChild(div);
    });
  });

  // 글 작성 버튼
  document.getElementById("postBtn").addEventListener("click", async () => {
    const title = document.getElementById("postTitle").value.trim();
    const content = quill.root.innerHTML;
    const files = document.getElementById("images").files;

    if (!title || !content) return alert("제목과 내용을 입력하세요");
    if (files.length > 3) return alert("사진은 최대 3장까지 첨부 가능합니다");

    // 이미지 업로드
    const imageUrls = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      imageUrls.push(url);
    }

    // Firestore에 글 저장
    await addDoc(postsRef, {
      uid: currentUser.uid,
      author: userData.nickname,
      title,
      content,
      images: imageUrls,
      time: serverTimestamp()
    });

    alert("글이 게시되었습니다!");
    document.getElementById("postTitle").value = "";
    quill.root.innerHTML = "";
    document.getElementById("images").value = "";
  });
}
