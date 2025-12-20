import { db, auth } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, collection, addDoc, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

let currentUser = null;
let userData = { nickname: "익명", role: "user", lastPostAt: 0 };

// 금칙어/도배 방지
const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"];
const POST_COOLDOWN = 30000;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      userData = { nickname: "익명", role: "user", lastPostAt: 0, ...snap.data() };
    } else {
      await setDoc(userRef, userData);
    }
    if (window.__PAGE_ID__) initWiki(window.__PAGE_ID__);
  } else {
    currentUser = null;
    userData = null;
  }
});

export async function initWiki(pageId) {
  if (!currentUser || !userData) return;

  // 좋아요
  const likeRef = doc(db, "wiki", pageId);
  const likeUserRef = doc(db, "wiki", pageId, "likesBy", currentUser.uid);

  const pageSnap = await getDoc(likeRef);
  if (!pageSnap.exists()) await setDoc(likeRef, { likes: 0 });

  onSnapshot(likeRef, (s) => {
    if (s.exists()) document.getElementById("likeCount").textContent = s.data().likes ?? 0;
  });

  const likeBtn = document.getElementById("likeBtn");
  if (likeBtn) {
    likeBtn.disabled = false;
    likeBtn.onclick = async () => {
      if ((await getDoc(likeUserRef)).exists()) return alert("이미 좋아요를 눌렀습니다");
      await setDoc(likeUserRef, { time: serverTimestamp() });
      await updateDoc(likeRef, { likes: increment(1) });
      document.getElementById("likeMsg").textContent = "좋아요가 반영되었습니다!";
    };
  }

  // 사용자 기여
  const contribRef = collection(db, "wiki", pageId, "contributions");
  onSnapshot(contribRef, (snap) => {
    const ul = document.getElementById("contributions");
    ul.innerHTML = "";
    snap.forEach((d) => {
      const p = d.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <b>${p.user}</b>: ${p.text}
        <button onclick="report('${pageId}','${d.id}')">🚨</button>
        ${(userData.role === "admin" || currentUser.uid === p.uid)
          ? `<button onclick="del('${pageId}','${d.id}')">❌</button>` : ""}
      `;
      ul.appendChild(li);
    });
  });

  window.addContribution = async () => {
    const text = document.getElementById("content").value.trim();
    if (!text) return;
    if (BAD_WORDS.some((w) => text.includes(w))) return alert("욕설/비속어는 금지입니다");
    const now = Date.now();
    if (now - (userData.lastPostAt ?? 0) < POST_COOLDOWN)
      return alert("도배 방지: 잠시 후 다시 시도해 주세요.");

    await addDoc(contribRef, {
      uid: currentUser.uid,
      user: userData.nickname,
      text,
      reports: 0,
      time: serverTimestamp()
    });

    await updateDoc(doc(db, "users", currentUser.uid), { lastPostAt: now });
    document.getElementById("content").value = "";
  };

  // 신고/삭제
  window.report = async (pageId, contribId) => {
    const ref = doc(db, "wiki", pageId, "contributions", contribId);
    await updateDoc(ref, { reports: increment(1) });
    alert("신고가 접수되었습니다");
  };

  window.del = async (pageId, contribId) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const ref = doc(db, "wiki", pageId, "contributions", contribId);
    try {
      await deleteDoc(ref);
      alert("삭제되었습니다");
    } catch (e) {
      console.error("삭제 실패:", e);
      alert("삭제 권한이 없거나 오류가 발생했습니다");
    }
  };
}
