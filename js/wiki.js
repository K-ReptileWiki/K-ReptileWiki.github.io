// wiki.js
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

const firebaseConfig = {
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f",
  storageBucket: "k-reptilewiki-1f09f.appspot.com",   // ✅ 추가된 부분
  messagingSenderId: "557869324836",
  appId: "1:557869324836:web:3eda21e6ba0333422856b1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ 페이지별 초기화 함수
export function initWiki(pageId) {
  const likeRef = doc(db, "wiki", pageId);

  // 문서 없으면 생성
  getDoc(likeRef).then((snap) => {
    if (!snap.exists()) {
      setDoc(likeRef, { likes: 0 });
    }
  });

  // ❤️ 좋아요 실시간 반영
  onSnapshot(likeRef, (docSnap) => {
    const data = docSnap.data();
    if (data && document.getElementById("likeCount")) {
      document.getElementById("likeCount").textContent = data.likes || 0;
    }
  });

  // 좋아요 버튼 기능
  window.like = async function () {
    const user = document.getElementById("username")?.value.trim();
    if (!user) {
      alert("닉네임 입력하세요");
      return;
    }
    await updateDoc(likeRef, { likes: increment(1) });
  };

  // 📝 사용자 기여
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
}
