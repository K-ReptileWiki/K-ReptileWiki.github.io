import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient("https://cpaikpjzlzzujwfgnanb.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc");
export const supabase = createClient(supabaseUrl, supabaseKey);
let currentUser = null;
let userData = { nickname: "익명", role: "user", lastPostAt: 0 };

const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"];
const POST_COOLDOWN = 30000;

supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    // 유저 데이터는 별도 users 테이블에서 가져오거나 기본값 사용
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
    const { data, error } = await supabase
      .from("wiki_posts")
      .select("likes")
      .eq("id", pageId)
      .single();

    if (!error && data) {
      document.getElementById("likeCount").textContent = data.likes ?? 0;
    }
  }

  loadLikes();

  const likeBtn = document.getElementById("likeBtn");
  if (likeBtn) {
    likeBtn.disabled = false;
    likeBtn.onclick = async () => {
      // 중복 좋아요 확인
      const { data: existing } = await supabase
        .from("wiki_likes")
        .select("id")
        .eq("post_id", pageId)
        .eq("user_id", currentUser.id)
        .single();

      if (existing) {
        alert("이미 좋아요를 눌렀습니다");
        return;
      }

      // 좋아요 기록 추가
      await supabase.from("wiki_likes").insert([
        { post_id: pageId, user_id: currentUser.id }
      ]);

      // 좋아요 수 증가
      const { data, error } = await supabase
        .from("wiki_posts")
        .update({ likes: supabase.rpc("increment_likes", { post_id: pageId }) })
        .eq("id", pageId)
        .select();

      if (error) {
        console.error("좋아요 반영 실패:", error.message);
      } else {
        document.getElementById("likeCount").textContent = data[0].likes;
        document.getElementById("likeMsg").textContent = "좋아요가 반영되었습니다!";
      }
    };
  }

  // 사용자 기여 불러오기
  async function loadContributions() {
    const { data, error } = await supabase
      .from("wiki_contributions")
      .select("*")
      .eq("post_id", pageId)
      .order("time", { ascending: false });

    const ul = document.getElementById("contributions");
    ul.innerHTML = "";

    if (!error && data) {
      data.forEach((p) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <b>${p.user}</b>: ${p.text}
          <button onclick="report('${pageId}','${p.id}')">🚨</button>
          ${(userData.role === "admin" || currentUser.id === p.uid)
            ? `<button onclick="del('${pageId}','${p.id}')">❌</button>` : ""}
        `;
        ul.appendChild(li);
      });
    }
  }

  loadContributions();

  // 기여 추가
  window.addContribution = async () => {
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

  // 신고
  window.report = async (pageId, contribId) => {
    const { error } = await supabase
      .from("wiki_contributions")
      .update({ reports: supabase.rpc("increment_reports", { contrib_id: contribId }) })
      .eq("id", contribId);

    if (!error) alert("신고가 접수되었습니다");
  };

  // 삭제
  window.del = async (pageId, contribId) => {
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
}
