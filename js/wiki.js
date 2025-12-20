import { supabase } from "./supabase.js";

// 1) initWiki 함수 선언
function initWiki(pageId) {
  console.log("✅ initWiki 실행됨, pageId:", pageId);

  // 좋아요 버튼 이벤트
  const likeBtn = document.getElementById("likeBtn");
  if (likeBtn) {
    console.log("✅ likeBtn 요소 찾음");
    likeBtn.onclick = async () => {
      console.log("❤️ 좋아요 버튼 클릭됨");

      try {
        // 이미 좋아요 눌렀는지 확인
        const { data: existing, error: checkError } = await supabase
          .from("wiki_likes")
          .select("id")
          .eq("post_id", pageId)
          .eq("user_id", currentUser.id)
          .single();

        if (checkError) console.error("❌ 좋아요 확인 오류:", checkError);

        if (existing) {
          console.log("⚠️ 이미 좋아요 누름");
          return alert("이미 좋아요를 눌렀습니다");
        }

        // 좋아요 삽입
        const { data, error } = await supabase.from("wiki_likes").insert([
          { post_id: pageId, user_id: currentUser.id }
        ]);

        if (error) {
          console.error("❌ 좋아요 삽입 오류:", error);
        } else {
          console.log("✅ 좋아요 삽입 성공, data:", data);
        }

        // 좋아요 수 증가
        const { error: rpcError } = await supabase.rpc("increment_likes", { post_id: pageId });
        if (rpcError) {
          console.error("❌ 좋아요 RPC 오류:", rpcError);
        } else {
          console.log("✅ 좋아요 RPC 호출 완료");
        }

        document.getElementById("likeMsg").textContent = "좋아요가 반영되었습니다!";
      } catch (e) {
        console.error("❌ 좋아요 처리 중 예외:", e);
      }
    };
  } else {
    console.log("❌ likeBtn 요소 못 찾음");
  }

  // 기여 버튼 이벤트
  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    console.log("✅ addBtn 요소 찾음");
    addBtn.onclick = async () => {
      console.log("✍️ 기여 버튼 클릭됨");

      const text = document.getElementById("content").value.trim();
      if (!text) {
        console.log("⚠️ 입력 없음");
        return;
      }
      if (BAD_WORDS.some((w) => text.includes(w))) {
        console.log("🚫 욕설 감지");
        return alert("욕설/비속어는 금지입니다");
      }

      const now = Date.now();
      if (now - (userData.lastPostAt ?? 0) < POST_COOLDOWN) {
        console.log("⏳ 도배 방지 발동");
        return alert("도배 방지: 잠시 후 다시 시도해 주세요.");
      }

      try {
        // DB 삽입
        const { data, error } = await supabase.from("wiki_contributions").insert([{
          post_id: pageId,
          uid: currentUser.id,
          user: userData.nickname,
          text,
          reports: 0,
          time: new Date().toISOString()
        }]);

        if (error) {
          console.error("❌ 기여 삽입 오류:", error);
        } else {
          console.log("✅ 기여 삽입 성공, data:", data);
        }

        userData.lastPostAt = now;
        document.getElementById("content").value = "";
      } catch (e) {
        console.error("❌ 기여 처리 중 예외:", e);
      }
    };
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

// 4) 강제 호출 (테스트용)
if (window.__PAGE_ID__) {
  console.log("📄 강제 initWiki 실행, PAGE_ID:", window.__PAGE_ID__);
  initWiki(window.__PAGE_ID__);
}

// 5) 로그인 이벤트
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

export { initWiki };
