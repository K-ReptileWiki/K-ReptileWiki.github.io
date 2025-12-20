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
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ 로그인 성공, UID:", cred.user.uid);
    alert("로그인 성공!");
    location.href = "index.html";
  } catch (e) {
    console.error("❌ 로그인 실패:", e);
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
    console.log("✅ 회원가입 성공, UID:", cred.user.uid);

    // Firestore에서 관리자 이메일 확인
    const adminSnap = await getDoc(doc(db, "admin_emails", email));
    const role = (adminSnap.exists() && adminSnap.data().active) ? "admin" : "user";
    console.log("✅ 부여된 role:", role);

    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      nickname,
      role,
      bannedUntil: null,
      createdAt: new Date()
    });

    alert(`회원가입 성공! (${role} 권한 부여됨)`);
  } catch (e) {
    console.error("❌ 회원가입 실패:", e);
    alert("회원가입 실패: " + e.message);
  }
};

/* 로그아웃 */
window.logout = async () => {
  try {
    await signOut(auth);
    console.log("✅ 로그아웃 완료");
    alert("로그아웃 완료");
    location.href = "login.html";
  } catch (e) {
    console.error("❌ 로그아웃 실패:", e);
    alert("로그아웃 실패: " + e.message);
  }
};

/* 로그인 취소 → 메인 페이지 이동 */
document.addEventListener("DOMContentLoaded", () => {
  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  /* 로그인 상태 표시 */
  onAuthStateChanged(auth, async user => {
    const info = document.getElementById("userInfo");
    if (!info) return;

    if (user) {
      console.log("✅ 로그인된 UID:", user.uid);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          console.log("✅ Firestore role:", data.role);
          info.textContent = `현재 로그인: ${data.nickname ?? user.email} (권한: ${data.role ?? "user"})`;
        } else {
          console.warn("❌ Firestore에 사용자 문서 없음:", user.uid);
          info.textContent = `현재 로그인: ${user.email} (문서 없음)`;
        }
      } catch (e) {
        console.error("❌ Firestore 읽기 실패:", e);
        info.textContent = `현재 로그인: ${user.email}`;
      }
    } else {
      console.log("ℹ️ 현재 로그인된 사용자 없음");
      info.textContent = "현재 로그인된 사용자 없음";
    }
  });
});
