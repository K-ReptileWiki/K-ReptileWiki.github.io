import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, addDoc, onSnapshot, serverTimestamp,
  increment, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* Firebase */
const app = initializeApp({
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f"
});

const db = getFirestore(app);
const auth = getAuth(app);

/* 필터 */
const BAD_WORDS = ["씨발","시발","병신","ㅅㅂ","ㅂㅅ","좆","지랄"];
const POST_COOLDOWN = 30 * 1000;

/* 로그인 */
signInAnonymously(auth);

let currentUser = null;
let userData = null;

onAuthStateChanged(auth, async user => {
  if (!user) return;
  currentUser = user;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const nick = prompt("닉네임을 정하세요 (변경 불가)");
    await setDoc(ref, {
      nickname: nick,
      role: "user",
      bannedUntil: null,
      lastPostAt: 0
    });
  }

  userData = (await getDoc(ref)).data();
});

/* 초기화 */
export async function initWiki(pageId) {

  /* ❤️ 좋아요 */
  const likeRef = doc(db, "wiki", pageId);
  const likeUserRef = doc(db, "wiki", pageId, "likesBy", currentUser.uid);

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

  /* 📝 글 작성 */
  const contribRef = collection(db, "wiki", pageId, "contributions");

  onSnapshot(contribRef, snap => {
    const ul = document.getElementById("contributions");
    ul.innerHTML = "";
    snap.forEach(d => {
      const p = d.data();
      ul.innerHTML += `
        <li>
          <b>${p.user}</b>: ${p.text}
          <button onclick="report('${pageId}','${d.id}')">🚨</button>
          ${userData.role === "admin"
            ? `<button onclick="del('${pageId}','${d.id}')">❌</button>` : ""}
        </li>`;
    });
  });

  window.addContribution = async () => {
    const text = content.value.trim();
    if (BAD_WORDS.some(w => text.includes(w))) return alert("욕설 금지");

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

/* 🚨 신고 */
window.report = async (pageId, postId) => {
  await updateDoc(doc(db, "wiki", pageId, "contributions", postId),
    { reports: increment(1) });
};

/* ❌ 관리자 삭제 */
window.del = async (pageId, postId) => {
  if (userData.role !== "admin") return;
  await deleteDoc(doc(db, "wiki", pageId, "contributions", postId));
};
