import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  onSnapshot, collection, addDoc, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// Firebase 초기화는 posts.js와 동일하게 되어 있다고 가정
const db = getFirestore();
const auth = getAuth();

// 전역 사용자 상태
let currentUser = null;
let userData = { nickname: "익명", role: "user", lastPostAt: 0 };

// 로그인 상태 감지
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
  } else {
    currentUser = null;
    userData = null;
  }
});

// 🚀 위키 초기화 함수
export async function initWiki(pageId) {
  // 사용자 준비가 안 됐으면 대기
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
  likeBtn.disabled = false;
  likeBtn.addEventListener("click", async () => {
    if ((await getDoc(likeUserRef)).exists()) {
      alert("이미 좋아요를 눌렀습니다");
      return;
    }
    await setDoc(likeUserRef, { time: serverTimestamp() });
    await updateDoc(likeRef, { likes: increment(1) });
  });

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
    const text = document.getElementById("content").value.trim();
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

    document.getElementById("content").value = "";
  };
}
