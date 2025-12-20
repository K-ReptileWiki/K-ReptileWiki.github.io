import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/* Firebase 초기화 */
const app = initializeApp({
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f"
});
const auth = getAuth(app);
const db = getFirestore(app);

/* 로그인 */
window.login = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("로그인 성공!");
    location.href = "admin.html";
  } catch (e) {
    alert("로그인 실패: " + e.message);
  }
};

/* 회원가입 */
window.register = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();
  const nickname = document.getElementById("nickname").value.trim() || email.split("@")[0];

  if (password !== confirmPassword) {
    alert("비밀번호가 일치하지 않습니다.");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Firestore에서 관리자 이메일 확인
    const adminSnap = await getDoc(doc(db, "admin_emails", email));
    const role = (adminSnap.exists() && adminSnap.data().active) ? "admin" : "user";

    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      nickname,
      role,
      bannedUntil: null,
      createdAt: new Date()
    });

    alert(`회원가입 성공! (${role} 권한 부여됨)`);
  } catch (e) {
    alert("회원가입 실패: " + e.message);
  }
};

/* 로그아웃 */
window.logout = async () => {
  try {
    await signOut(auth);
    alert("로그아웃 완료");
    location.href = "login.html";
  } catch (e) {
    alert("로그아웃 실패: " + e.message);
  }
};

/* 로그인 상태 표시 */
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async user => {
    const info = document.getElementById("userInfo");
    if (!info) return;

    if (user) {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? snap.data() : {};
        info.textContent = `현재 로그인: ${data.nickname ?? user.email} (권한: ${data.role ?? "user"})`;
      } catch (e) {
        info.textContent = `현재 로그인: ${user.email}`;
      }
    } else {
      info.textContent = "현재 로그인된 사용자 없음";
    }
  });
});
