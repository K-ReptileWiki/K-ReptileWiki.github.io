// js/wiki.js
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
  increment
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

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

export function initWiki(pageId) {
  const likeRef = doc(db, "wiki", pageId);

  getDoc(likeRef).then((snap) => {
    if (!snap.exists()) setDoc(likeRef, { likes: 0 });
  });

  onSnapshot(likeRef, (snap) => {
    const data = snap.data();
    if (data) document.getElementById("likeCount").textContent = data.likes ?? 0;
  });

  window.like = async () => {
    const user = document.getElementById("username")?.value.trim();
    if (!user) return alert("닉네임 입력");

    await updateDoc(likeRef, { likes: increment(1) });
  };

  const contribRef = collection(db, "wiki", pageId, "contributions");

  onSnapshot(contribRef, (snap) => {
    const list = document.getElementById("contributions");
    list.innerHTML = "";
    snap.forEach(d => {
      const li = document.createElement("li");
      li.textContent = `${d.data().user}: ${d.data().text}`;
      list.appendChild(li);
    });
  });

  window.addContribution = async () => {
    const user = contributor.value.trim();
    const text = content.value.trim();
    if (!user || !text) return alert("입력 필요");

    await addDoc(contribRef, { user, text, time: serverTimestamp() });
    content.value = "";
  };
}