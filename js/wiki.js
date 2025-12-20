import { supabase } from "./supabase.js";

let currentUser = null;
let userData = { nickname: "익명", role: "user", lastPostAt: 0 };

const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"];
const POST_COOLDOWN = 30000;

supabase.auth.onAuthStateChange(async (event, session) => {
  console.log("🔑 Auth state changed:", event);

  if (session?.user) {
    currentUser = session.user;
    console.log("✅ 로그인된 유저:", currentUser.id);

    const { data: snap, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (error) console.error("❌ users 조회 오류:", error.message);

    if (snap) {
      userData = { nickname: "익명", role: "user", lastPostAt: 0, ...snap };
      console.log("✅ 유저 데이터:", userData);
    } else {
      console.log("ℹ️ 신규 유저, users 테이블에 삽입");
      await supabase.from("users").insert([{ id: currentUser.id, ...userData }]);
    }

    if (window.__PAGE_ID__) {
      console.log("📄 initWiki 실행, PAGE_ID:", window.__PAGE_ID__);
      initWiki(window.__PAGE_ID__);
    } else {
      console.log("❌ PAGE_ID 없음");
    }
  } else {
    console.log("🚫 로그인 안 됨");
    currentUser = null;
    userData = null;
  }
});

function initWiki(pageId) {
  console.log("✅ initWiki 실행됨, pageId:", pageId);

  const likeBtn = document.getElementById("likeBtn");
  if (likeBtn) {
    console.log("✅ likeBtn 요소 찾음");
    likeBtn.onclick = () => console.log("❤️ 좋아요 버튼 클릭됨");
  } else {
    console.log("❌ likeBtn 요소 못 찾음");
  }

  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    console.log("✅ addBtn 요소 찾음");
    addBtn.onclick = () => console.log("✍️ 기여 버튼 클릭됨");
  } else {
    console.log("❌ addBtn 요소 못 찾음");
  }
}

export { initWiki };
