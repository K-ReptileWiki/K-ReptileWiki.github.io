import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f"
});

const auth = getAuth(app);
const db = getFirestore(app);

/* 로그인 */
window.login = async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );
    location.href = "/";
  } catch (e) {
    alert(e.message);
  }
};

/* 회원가입 */
window.register = async () => {
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );

    /* 유저 문서 생성 */
    await setDoc(doc(db, "users", cred.user.uid), {
      nickname: email.value.split("@")[0],
      role: "user",
      bannedUntil: null,
      createdAt: new Date()
    });

    location.href = "/";
  } catch (e) {
    alert(e.message);
  }
};
