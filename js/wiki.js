// js/wiki.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/* =========================
   Firebase 설정
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f",
  storageBucket: "k-reptilewiki-1f09f.appspot.com",
  messagingSenderId: "557869324836",
  appId: "1:557869324836:web:3eda21e6ba0333422856b1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =========================
   메인 초기화 함수
========================= */
export function initWiki(pageId) {
  /* ---------- ❤️ 좋아요 ---------- */
  const likeRef = doc(db, "wiki", pageId);

  getDoc(likeRef).then((snap) => {
    if (!snap.exists()) {
      setDoc(likeRef, { likes: 0 });
    }
  });

  onSnapshot(likeRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const likeEl = document.getElementById("likeCount");
    if (likeEl) likeEl.textContent = data.likes ?? 0;
  });

  window.like = async function () {
    const user = document.getElementById("username")?.value.trim();
    if (!user) {
      alert("닉네임을 입력하세요");
      return;
    }
    await updateDoc(likeRef, { likes: increment(1) });
  };

  /* ---------- 📝 기여 ---------- */
  const contribRef = collection(db, "wiki", pageId, "contributions");

  onSnapshot(contribRef, (snapshot) => {
    const list = document.getElementById("contributions");
    if (!list) return;
    list.innerHTML = "";
    snapshot.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = `${doc.data().user}: ${doc.data().text}`;
      list.appendChild(li);
    });
  });

  window.addContribution = async function () {
    const user = document.getElementById("contributor")?.value.trim();
    const text = document.getElementById("content")?.value.trim();
    if (!user || !text) {
      alert("닉네임과 내용을 입력하세요");
      return;
    }

    await addDoc(contribRef, {
      user,
      text,
      time: serverTimestamp()
    });

    document.getElementById("content").value = "";
  };

  /* ---------- 🔍 검색 ---------- */
  setupSearch();
}

/* =========================
   검색 기능
========================= */
function setupSearch() {
  const input = document.getElementById("searchInput");
  const resultBox = document.getElementById("searchResults");
  if (!input || !resultBox) return;

  const pages = [
  { title: "크레스티드 게코", url: "/species/crested_gecko.html" },
  { title: "데이게코", url: "/species/day_gecko.html" },
  { title: "레오파드 게코", url: "/species/leopard_gecko.html" }
];

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    resultBox.innerHTML = "";
    if (!q) return;

    pages
      .filter(p => p.title.toLowerCase().includes(q))
      .forEach(p => {
        const a = document.createElement("a");
        a.href = p.url;
        a.textContent = p.title;
        a.style.display = "block";
        resultBox.appendChild(a);
      });
  });
}
