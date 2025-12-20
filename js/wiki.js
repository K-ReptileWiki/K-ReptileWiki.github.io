import { supabase } from "./supabase.js";

// 1) initWiki를 '함수 선언문'으로 먼저 정의 (선언문은 호이스팅되지만, 안전하게 맨 위에 둡니다)
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

// 2) 상태 변수
let currentUser = null;
let userData = { nickname: "익명", role: "user", lastPostAt: 0 };
const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"];
const POST_COOLDOWN = 30000;

// 3) 모듈 로드 확인
console.log("🚀 wiki.js 로드됨");

// 4) 강제 호출은 '정의 뒤'에서만 수행
if (window.__PAGE_ID__) {
  console.log("📄 강제 initWiki 실행, PAGE_ID:", window.__PAGE_ID__);
  initWiki(window.__PAGE_ID__);
}

// 5) 로그인 이벤트에서 다시 호출 (정상 플로우)
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
      console.log("📄 로그인 후 initWiki 실행, PAGE_ID:", window.__PAGE_ID__);
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

// 필요하면 외부 모듈에서 import할 수 있게 export
export { initWiki };
