import { supabase } from "./supabase.js";

let currentUser = null;
let userData = { nickname: "익명", role: "user", lastPostAt: 0 };

const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"];
const POST_COOLDOWN = 30000;

// 로그인 상태 확인
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;

    // users 테이블에서 유저 데이터 가져오기
    const { data: snap } = await supabase
      .from("users")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (snap) {
      userData = { nickname: "익명", role: "user", lastPostAt: 0, ...snap };
    } else {
      await supabase.from("users").insert([{ id: currentUser.id, ...userData }]);
    }

    if (window.__PAGE_ID__) initWiki(window.__PAGE_ID__);
  } else {
    currentUser = null;
    userData = null;
  }
});

export async function initWiki(pageId) {
  if (!currentUser || !userData) return;

  // 좋아요 불러오기
  async function loadLikes() {
    const { data } = await supabase
      .from("wiki_posts")
      .select("likes")
      .eq("id", pageId)
      .single();

    if (data) {
      document.getElementById("likeCount").textContent = data.likes ?? 0;
    }
  }
  loadLikes();

  // 좋아요 버튼 이벤트
  const likeBtn = document.getElementById("likeBtn");
  if (likeBtn) {
    likeBtn.disabled = false;
    likeBtn.onclick = async () => {
      const { data: existing } = await supabase
        .from("wiki_likes")
        .select("id")
        .eq("post_id", pageId)
        .eq("user_id", currentUser.id)
        .single();

      if (existing) return alert("이미 좋아요를 눌렀습니다");

      await supabase.from("wiki_likes").insert([
        { post_id: pageId, user_id: currentUser.id }
      ]);

      await supabase.rpc("increment_likes", { post_id: pageId });

      document.getElementById("likeMsg").textContent = "좋아요가 반영되었습니다!";
      loadLikes();
    };
  }

  // 사용자 기여 불러오기
  async function loadContributions() {
    const { data } = await supabase
      .from("wiki_contributions")
      .select("*")
      .eq("post_id", pageId)
      .order("time", { ascending: false });

    const ul = document.getElementById("contributions");
    ul.innerHTML = "";

    if (data) {
      data.forEach((p) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <b>${p.user}</b>: ${p.text}
          <button class="reportBtn" data-id="${p.id}">🚨</button>
          ${(userData.role === "admin" || currentUser.id === p.uid)
            ? `<button class="delBtn" data-id="${p.id}">❌</button>` : ""}
        `;
        ul.appendChild(li);
      });

      // 신고 버튼 이벤트
      document.querySelectorAll(".reportBtn").forEach(btn => {
        btn.onclick = async () => {
          const contribId = btn.dataset.id;
          await supabase.rpc("increment_reports", { contrib_id: contribId });
          alert("신고가 접수되었습니다");
          loadContributions();
        };
      });

      // 삭제 버튼 이벤트
      document.querySelectorAll(".delBtn").forEach(btn => {
        btn.onclick = async () => {
          const contribId = btn.dataset.id;
          if (!confirm("정말 삭제하시겠습니까?")) return;
          const { error } = await supabase
            .from("wiki_contributions")
            .delete()
            .eq("id", contribId);

          if (error) {
            console.error("삭제 실패:", error.message);
            alert("삭제 권한이 없거나 오류가 발생했습니다");
          } else {
            alert("삭제되었습니다");
            loadContributions();
          }
        };
      });
    }
  }
  loadContributions();

  // 기여 추가 버튼 이벤트
  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      const text = document.getElementById("content").value.trim();
      if (!text) return;
      if (BAD_WORDS.some((w) => text.includes(w))) return alert("욕설/비속어는 금지입니다");

      const now = Date.now();
      if (now - (userData.lastPostAt ?? 0) < POST_COOLDOWN)
        return alert("도배 방지: 잠시 후 다시 시도해 주세요.");

      await supabase.from("wiki_contributions").insert([{
        post_id: pageId,
        uid: currentUser.id,
        user: userData.nickname,
        text,
        reports: 0,
        time: new Date().toISOString()
      }]);

      userData.lastPostAt = now;
      document.getElementById("content").value = "";
      loadContributions();
    };
  }
}
