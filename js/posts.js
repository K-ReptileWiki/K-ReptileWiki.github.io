import { db, auth, storage } from "./firebase.js";
import {
  collection, addDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import {
  signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

// Quill 에디터 초기화
const quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'header': [1,2,3,4,5,6,false] }],
      [{ 'color': ['#000000','#FF0000','#0000FF','#008000','#FFA500','#800080','#A52A2A','#FFD700'] }],
      [{ 'background': [] }],
      ['link']
    ]
  }
});

// 로그인 (익명)
signInAnonymously(auth);

let currentUser = null;
let userData = { nickname: "익명" };

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUser = user;
  document.getElementById("postBtn").disabled = false;
  initPosts();
});

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

      let imgHtml = "";
      if (p.images && Array.isArray(p.images)) {
        imgHtml = p.images.map(url => `<img src="${url}" style="max-width:200px;margin:5px;">`).join("");
      }

      // ✅ 제목에 상세 페이지 링크 추가
      div.innerHTML = `
        <h3><a href="post.html?id=${d.id}">${p.title}</a></h3>
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

    const imageUrls = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      imageUrls.push(url);
    }

    await addDoc(postsRef, {
      uid: currentUser.uid,
      author: userData.nickname,
      title,
      content,
      images: imageUrls,
      time: serverTimestamp()
    });

    alert("글이 게시되었습니다!");

    // 입력값 초기화
    document.getElementById("postTitle").value = "";
    quill.root.innerHTML = "";
    document.getElementById("images").value = "";

    // ✅ 글 작성 후 index.html로 이동
    window.location.href = "index.html";
  });

  // 글쓰기 취소 버튼
  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (confirm("작성 중인 글을 취소하고 메인으로 돌아가시겠습니까?")) {
        window.location.href = "index.html";
      }
    });
  }

  // ✅ 미리보기 버튼
  const previewBtn = document.getElementById("previewBtn");
  if (previewBtn) {
    previewBtn.addEventListener("click", () => {
      const title = document.getElementById("postTitle").value.trim();
      const content = quill.root.innerHTML;
      const files = document.getElementById("images").files;

      let imgHtml = "";
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        imgHtml += `<img src="${url}" style="max-width:200px;margin:5px;">`;
      }

      const previewArea = document.getElementById("previewArea");
      previewArea.style.display = "block";
      previewArea.innerHTML = `
        <h3>${title || "(제목 없음)"}</h3>
        <div>${content || "(내용 없음)"}</div>
        ${imgHtml}
      `;
    });
  }
}
