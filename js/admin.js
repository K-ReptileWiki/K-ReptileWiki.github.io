import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore, collection, getDocs,
  doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* Firebase */
const app = initializeApp({
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f"
});
const db = getFirestore(app);
const auth = getAuth(app);

/* 관리자 확인 */
onAuthStateChanged(auth, async user => {
  if (!user) {
    alert("로그인 필요");
    location.href = "/";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    alert("관리자만 접근 가능");
    location.href = "/";
    return;
  }

  loadUsers();
});

/* 사용자 목록 */
async function loadUsers() {
  const ul = document.getElementById("userList");
  ul.innerHTML = "";

  const usersSnap = await getDocs(collection(db, "users"));

  usersSnap.forEach(u => {
    const data = u.data();
    const li = document.createElement("li");

    const bannedUntil = data.bannedUntil?.toDate?.();
    const banned = bannedUntil && bannedUntil > new Date();

    li.className = "card";
    li.innerHTML = `
      <b>${data.nickname ?? "닉네임없음"}</b>
      <br>
      UID: ${u.id}
      <br>
      상태: ${banned ? "🚫 밴 중" : "정상"}
      <br><br>
      <button class="short" onclick="ban('${u.id}',1)">1일</button>
      <button class="short" onclick="ban('${u.id}',3)">3일</button>
      <button class="short" onclick="ban('${u.id}',5)">5일</button>
      <button class="long" onclick="ban('${u.id}',7)">1주</button>
      <button class="long" onclick="ban('${u.id}',21)">3주</button>
      <button class="long" onclick="ban('${u.id}',30)">1달</button>
      <button class="long" onclick="ban('${u.id}',365)">1년</button>
      <button class="long" onclick="ban('${u.id}',1095)">3년</button>
      <button class="perma" onclick="ban('${u.id}',-1)">영구</button>
      <button onclick="unban('${u.id}')">해제</button>
    `;
    ul.appendChild(li);
  });
}

/* 밴 */
window.ban = async (uid, days) => {
  if (!confirm("정말 밴할까요?")) return;

  const until = days === -1
    ? new Date(8640000000000000)
    : new Date(Date.now() + days * 86400000);

  await updateDoc(doc(db, "users", uid), {
    bannedUntil: until
  });

  alert("밴 완료");
  loadUsers();
};

/* 밴 해제 */
window.unban = async (uid) => {
  await updateDoc(doc(db, "users", uid), {
    bannedUntil: null
  });

  alert("밴 해제");
  loadUsers();
};
