import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, addDoc, onSnapshot,
  serverTimestamp, increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* ================= Firebase ================= */
const app = initializeApp({
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f"
});

const db = getFirestore(app);
const auth = getAuth(app);

/* ================= 설정 ================= */
const BAD_WORDS = ["씨발","시발","병신","ㅅㅂ","ㅂㅅ","좆","지랄"];
const POST_COOLDOWN = 30 * 1000;

/* ================= 전역 상태 ================= */
let currentUser = null;
let userData = null;
let wikiStarted = false;

/* ================= 로그인 ================= */
signInAnonymously(auth);

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  currentUser = user;
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const nick = prompt("닉네임을 정하세요 (변경 불가)");
    await setDoc(userRef, {
      nickname: nick || "익명",
      role: "user",
      bannedUntil: null,
      lastPostAt: 0
    });
  }

  userData = (await getDoc(userRef)).data();

  /* 🔥 로그인 완료 후 wiki 초기화 */
  if (window.__PAGE_ID__ && !wikiStarted) {
    wikiStarted = true;
    initWiki(window.__PAGE_ID__);
  }
});

/* ================= 메인 ================= */
export function initWiki(pageId) {
  if (!currentUser || !userData) return;

  /* ❤️ 좋아요 */
  const likeRef = doc(db, "wiki", pageId);
  const likeUserRef = doc(db, "wiki", pageId, "likesBy", currentUser.uid);

  getDoc(likeRef).then(snap => {
    if (!snap.exists()) setDoc(likeRef, { likes: 0 });
  });

  onSnapshot(likeRef, snap => {
    if (snap.exists())
      document.getElementById("likeCount").textContent = snap.data().likes ?? 0;
  });

  window.like = async () => {
    if ((await getDoc(likeUserRef)).exists()) {
      alert("이미 좋아요를 눌렀습니다");
      return;
    }
    await setDoc(likeUserRef, { time: serverTimestamp() });
    await updateDoc(likeRef, { likes: increment(1) });
  };

  /* 📝 글 */
  const contribRef = collection(db, "wiki", pageId, "contributions");

  onSnapshot(contribRef, snap => {
    const ul = document.getElementById("contributions");
    ul.innerHTML = "";

    snap.forEach(d => {
      const p = d.data();
      const li = document.createElement("li");

      li.innerHTML = `
        <b>${p.user}</b>: ${p.text}
        <button onclick="report('${pageId}','${d.id}')">🚨</button>
        ${userData.role === "admin"
          ? `<button onclick="del('${pageId}','${d.id}')">❌</button>` : ""}
      `;

      ul.appendChild(li);
    });
  });

  window.addContribution = async () => {
    const text = content.value.trim();
    if (!text) return;

    if (BAD_WORDS.some(w => text.includes(w)))
      return alert("욕설은 금지입니다");

    const now = Date.now();
    if (now - userData.lastPostAt < POST_COOLDOWN)
      return alert("도배 방지: 잠시 후 다시");

    await addDoc(contribRef, {
      uid: currentUser.uid,
      user: userData.nickname,
      text,
      reports: 0,
      time: serverTimestamp()
    });

    await updateDoc(doc(db, "users", currentUser.uid), {
      lastPostAt: now
    });

    content.value = "";
  };
}

/* ================= 신고 ================= */
window.report = async (pageId, postId) => {
  await updateDoc(
    doc(db, "wiki", pageId, "contributions", postId),
    { reports: increment(1) }
  );
  alert("신고 완료");
};

/* ================= 관리자 삭제 ================= */
window.del = async (pageId, postId) => {
  if (userData.role !== "admin") return;
  await deleteDoc(doc(db, "wiki", pageId, "contributions", postId));
};
