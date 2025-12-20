import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/* Firebase 초기화 */
const app = initializeApp({
  apiKey: "AIzaSyDfrvgcAed9VvS5MFXVZFIxch8aCAfMp1w",
  authDomain: "k-reptilewiki-1f09f.firebaseapp.com",
  projectId: "k-reptilewiki-1f09f"
});
const auth = getAuth(app);
const db = getFirestore(app);

/* 방문 기록 저장 */
onAuthStateChanged(auth, async user => {
  if (!user) return; // 로그인 안 한 경우 기록하지 않음

  try {
    const visitRef = doc(db, "visits", user.uid);

    // 방문 기록: 배열에 시간 추가
    await setDoc(visitRef, {
      email: user.email,
      nickname: user.displayName ?? user.email.split("@")[0],
      times: arrayUnion(new Date())
    }, { merge: true });

    console.log("✅ 방문 기록 저장 완료:", user.uid);
  } catch (e) {
    console.error("❌ 방문 기록 저장 실패:", e);
  }
});
