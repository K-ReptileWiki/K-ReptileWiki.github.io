import { db, auth } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc,
  onSnapshot, collection, addDoc, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

let currentUser = null;
let userData = { nickname: "익명", role: "user", lastPostAt: 0 };

// ✅ 욕설 필터와 도배 방지 시간 정의
const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"]; 
const POST_COOLDOWN = 30000; // 30초

// 로그인 상태 확인
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      userData = { ...userData, ...snap.data() };
    } else {
      await setDoc(userRef, userData);
    }

    // ✅ 로그인 후 페이지 ID 있으면 initWiki 실행
    if (window.__PAGE_ID__) {
      initWiki(window.__PAGE_ID__);
    }
  } else {
    currentUser = null;
    userData = null;
  }
});

export async function initWiki(pageId) {
  if (!currentUser || !userData) {
    console.warn("사용자 정보가 아직 준비되지 않았습니다.");
    return;
  }

  /* ❤️ 좋아요 */
  const likeRef = doc(db, "wiki", pageId);
  const likeUserRef = doc(db, "wiki", pageId, "likesBy", currentUser.uid);

  const snap = await getDoc(likeRef);
  if (!snap.exists()) await setDoc(likeRef, { likes: 0 });

  onSnapshot(likeRef, snap => {
    if (snap.exists())
      document.getElementById("likeCount").textContent = snap.data().likes ?? 0;
  });

  const likeBtn = document.getElementById("likeBtn");
  if (likeBtn) {
    likeBtn.disabled = false;
    likeBtn.addEventListener("click", async () => {
      if ((await getDoc(likeUserRef)).exists()) {
        alert("이미 좋아요를 눌렀습니다");
        return;
      }
      await setDoc(likeUserRef, { time: serverTimestamp() });
      await updateDoc(likeRef, { likes: increment(1) });
      document.getElementById("likeMsg").textContent = "좋아요가 반영되었습니다!";
    });
  }

  /* 📝 사용자 기여 */
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
    const text = document.getElementById("content").value.trim();
    if (!text) return;

    if (BAD_WORDS.some(w => text.includes(w)))
      return alert("욕설/비속어는 금지입니다");

    const now = Date.now();
    if (now - userData.lastPostAt < POST_COOLDOWN)
      return alert("도배 방지: 잠시 후 다시 시도해 주세요.");

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

    document.getElementById("content").value = "";
  };

  // ✅ 신고 / 삭제 함수
  window.report = async (pageId, contribId) => {
    const contribDoc = doc(db, "wiki", pageId, "contributions", contribId);
    await updateDoc(contribDoc, { reports: increment(1) });
    alert("신고가 접수되었습니다");
  };

  window.del = async (pageId, contribId) => {
    const contribDoc = doc(db, "wiki", pageId, "contributions", contribId);
    await updateDoc(contribDoc, { deleted: true });
    alert("삭제되었습니다");
  };
}
