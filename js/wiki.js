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
  increment,
  deleteDoc
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
   필터 & 설정
========================= */
const BAD_WORDS = ["씨발","시발","병신","ㅅㅂ","ㅂㅅ","좆","지랄"];
const AD_WORDS = ["http","www",".com",".kr","카톡","텔레그램","광고","구매","판매"];
const MIN_LEN = 5;
const MAX_LEN = 200;
const REPORT_LIMIT = 3;
const ADMIN_CODE = "1234"; // 🔐 관리자 코드

/* =========================
   메인 초기화
========================= */
export function initWiki(pageId) {

  /* ❤️ 좋아요 */
  const likeRef = doc(db, "wiki", pageId);

  getDoc(likeRef).then(snap => {
    if (!snap.exists()) setDoc(likeRef, { likes: 0 });
  });

  onSnapshot(likeRef, snap => {
    if (!snap.exists()) return;
    document.getElementById("likeCount").textContent = snap.data().likes ?? 0;
  });

  window.like = async () => {
    const user = document.getElementById("username").value.trim();
    if (!user) return alert("닉네임 입력");
    await updateDoc(likeRef, { likes: increment(1) });
  };

  /* 📝 기여 */
  const contribRef = collection(db, "wiki", pageId, "contributions");

  onSnapshot(contribRef, snapshot => {
    const ul = document.getElementById("contributions");
    ul.innerHTML = "";

    snapshot.forEach(d => {
      const data = d.data();
      const li = document.createElement("li");

      const reports = data.reports ?? 0;
      const hidden = reports >= REPORT_LIMIT;

      li.innerHTML = `
        <b>${data.user}</b> :
        ${hidden ? "<i>[신고로 숨김 처리됨]</i>" : data.text}
        <br>
        <button onclick="reportPost('${pageId}','${d.id}')">🚨 신고 (${reports})</button>
        <button onclick="adminDelete('${pageId}','${d.id}')">❌</button>
      `;

      ul.appendChild(li);
    });
  });

  window.addContribution = async () => {
    const user = document.getElementById("contributor").value.trim();
    const text = document.getElementById("content").value.trim();

    if (!user || !text) return alert("닉네임/내용 입력");

    const err = filterText(text);
    if (err) return alert(err);

    await addDoc(contribRef, {
      user,
      text,
      reports: 0,
      time: serverTimestamp()
    });

    document.getElementById("content").value = "";
  };
}

/* =========================
   필터
========================= */
function filterText(text) {
  const t = text.toLowerCase();

  if (BAD_WORDS.some(w => t.includes(w)))
    return "욕설이 포함되어 있습니다.";

  if (AD_WORDS.some(w => t.includes(w)))
    return "광고/홍보 글은 금지입니다.";

  if (text.length < MIN_LEN)
    return `최소 ${MIN_LEN}자 이상 입력하세요.`;

  if (text.length > MAX_LEN)
    return `최대 ${MAX_LEN}자까지만 가능합니다.`;

  if (/(.)\1{4,}/.test(text))
    return "의미없는 반복 문자입니다.";

  return null;
}

/* =========================
   🚨 신고
========================= */
window.reportPost = async (pageId, postId) => {
  const ref = doc(db, "wiki", pageId, "contributions", postId);
  await updateDoc(ref, { reports: increment(1) });
  alert("신고되었습니다.");
};

/* =========================
   🔐 관리자 삭제
========================= */
window.adminDelete = async (pageId, postId) => {
  const code = prompt("관리자 코드 입력");
  if (code !== ADMIN_CODE) {
    alert("코드 틀림");
    return;
  }

  await deleteDoc(doc(db, "wiki", pageId, "contributions", postId));
  alert("삭제 완료");
};
