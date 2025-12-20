import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f"
});

export const auth = getAuth(app);
export const db = getFirestore(app);

/* 로그인 */
window.login = async () => {
  const emailInput = document.getElementById("email");
  const pwInput = document.getElementById("password");
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, pwInput.value);
    location.href = "/";
  } catch (e) {
    alert("로그인 실패: " + e.message);
  }
};

/* 회원가입 */
window.register = async () => {
  const emailInput = document.getElementById("email");
  const pwInput = document.getElementById("password");
  try {
    const cred = await createUserWithEmailAndPassword(auth, emailInput.value, pwInput.value);

    // 유저 문서 생성
    await setDoc(doc(db, "users", cred.user.uid), {
      nickname: emailInput.value.split("@")[0],
      role: "user",
      bannedUntil: null,
      createdAt: serverTimestamp()
    });

    location.href = "/";
  } catch (e) {
    alert("회원가입 실패: " + e.message);
  }
};

/* 로그아웃 */
window.logout = async () => {
  await signOut(auth);
  location.href = "/";
};

/* 로그인 상태 감지 */
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("로그인됨:", user.email);
  } else {
    console.log("로그아웃 상태");
  }
});
