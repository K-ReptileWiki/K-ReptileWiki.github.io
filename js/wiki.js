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

/* 🔥 Firebase 설정 */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ======================= */
window.initWiki = async function (pageId) {
  const likeRef = doc(db, "wiki", pageId);

  // 좋아요 문서 없으면 생성
  const snap = await getDoc(likeRef);
  if (!snap.exists()) {
    await setDoc(likeRef, { likes: 0 });
  }

  // ❤️ 실시간 좋아요
  onSnapshot(likeRef, (docSnap) => {
    document.getElementById("likeCount").textContent =
      docSnap.data().likes || 0;
  });

  window.like = async function () {
    const user = document.getElementById("username").value.trim();
    if (!user) {
      alert("닉네임 입력");
      return;
    }
    await updateDoc(likeRef, { likes: increment(1) });
  };

  // 📝 사용자 기여
  const contribRef = collection(db, "wiki", pageId, "contributions");

  onSnapshot(contribRef, (snapshot) => {
    const list = document.getElementById("contributions");
    list.innerHTML = "";
    snapshot.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = `${doc.data().user}: ${doc.data().text}`;
      list.appendChild(li);
    });
  });

  window.addContribution = async function () {
    const user = document.getElementById("contributor").value.trim();
    const text = document.getElementById("content").value.trim();
    if (!user || !text) return;

    await addDoc(contribRef, {
      user,
      text,
      time: serverTimestamp()
    });

    document.getElementById("content").value = "";
  };
};