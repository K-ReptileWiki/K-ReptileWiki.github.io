import { supabase } from "./supabase.js";

// 상태 변수
let currentUser = null;
let userData = { nickname: "익명", role: "user", lastPostAt: 0 };
const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"];
const POST_COOLDOWN = 30000;

// 초기화 함수
function initWiki(pageId) {
  console.log("✅ initWiki 실행됨, pageId:", pageId);

  // 좋아요 버튼
  const likeBtn = document.getElementById("likeBtn");
  if (likeBtn) {
    likeBtn.onclick = async () => {
      console.log("❤️ 좋아요 버튼 클릭됨");
      try {
        const { data: existing, error: checkError } = await supabase
          .from("wiki_likes")
          .select("id")
          .eq("post_id", pageId)
          .eq("user_id", currentUser?.id)
          .single();

        if (checkError) console.error("❌ 좋아요 확인 오류:", checkError);
        if (existing) return alert("이미 좋아요를 눌렀습니다");

        const payload = { post_id: pageId, user_id: currentUser.id };
        console.log("🔍 좋아요 삽입 값:", payload);

        const { data, error } = await supabase.from("wiki_likes").insert([payload]).select();
        if (error) {
          console.error("❌ 좋아요 삽입 오류:", error);
          return alert("좋아요 처리 중 오류 발생");
        }
        console.log("✅ 좋아요 삽입 성공:", data);

        await supabase.rpc("increment_likes", { post_id: pageId });
        document.getElementById("likeMsg").textContent = "좋아요가 반영되었습니다!";
      } catch (e) {
        console.error("❌ 좋아요 처리 중 예외:", e);
        alert("예외 발생: " + (e.message || "알 수 없는 오류"));
      }
    };
  }

  // 기여 버튼
  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      console.log("✍️ 기여 버튼 클릭됨");

      const text = document.getElementById("content").value.trim();
      if (!text) return console.log("⚠️ 입력 없음");
      if (BAD_WORDS.some((w) => text.includes(w))) return alert("욕설/비속어는 금지입니다");

      const now = Date.now();
      if (now - (userData.lastPostAt ?? 0) < POST_COOLDOWN) return alert("도배 방지: 잠시 후 다시 시도해 주세요.");

      try {
        const payload = {
          post_id: pageId,
          uid: currentUser.id,
          username: userData.nickname,
          text,
          reports: 0,
          time: new Date().toISOString()
        };
        console.log("🔍 기여 삽입 값:", payload);

        const { data, error } = await supabase.from("wiki_contributions").insert([payload]).select();
        if (error) {
          console.error("❌ 기여 삽입 오류:", error);
          return alert("기여 처리 중 오류 발생: " + error.message);
        }
        if (!data || data.length === 0) {
          console.warn("⚠️ 삽입은 성공했지만 반환된 행 없음");
        } else {
          console.log("✅ 기여 삽입 성공:", data);
          alert("기여가 성공적으로 반영되었습니다!");
        }

        userData.lastPostAt = now;
        document.getElementById("content").value = "";
      } catch (e) {
        console.error("❌ 기여 처리 중 예외:", e);
        alert("예외 발생: " + (e.message || "알 수 없는 오류"));
      }
    };
  }
}

// 모듈 로드 확인
console.log("🚀 wiki.js 로드됨");

// 강제 호출 (테스트용)
if (window.__PAGE_ID__) {
  initWiki(window.__PAGE_ID__);
}

// 로그인 이벤트
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

    if (error) console.error("❌ users 조회 오류:", error);

    if (snap) {
      userData = { nickname: "익명", role: "user", lastPostAt: 0, ...snap };
      console.log("✅ 유저 데이터:", userData);
    } else {
      console.log("ℹ️ 신규 유저, users 테이블에 삽입");
      await supabase.from("users").insert([{ id: currentUser.id, ...userData }]);
    }

    if (window.__PAGE_ID__) initWiki(window.__PAGE_ID__);
  } else {
    console.log("🚫 로그인 안 됨");
    currentUser = null;
    userData = null;
  }
});

export { initWiki };
