import { supabase } from "./supabase.js";

let currentUser = null;
let userData = { nickname: "익명", role: "user", lastPostAt: 0 };
const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"];
const POST_COOLDOWN = 30000;

function initWiki(pageId) {
  console.log("✅ initWiki 실행됨:", pageId);

  async function loadContributions() {
    const { data, error } = await supabase
      .from("wiki_contributions")
      .select("*")
      .eq("post_id", pageId)
      .order("time", { ascending: false });

    if (error) return console.error("❌ 기여 조회 오류:", error);

    const list = document.getElementById("contribList");
    if (list) {
      list.innerHTML = "";
      data.forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.username}</td>
          <td>${row.text}</td>
          <td>${new Date(row.time).toLocaleString()}</td>
          <td>
            <button onclick="deleteContribution('${row.id}')">삭제</button>
            <button onclick="editContribution('${row.id}', '${row.text}')">수정</button>
          </td>
        `;
        list.appendChild(tr);
      });
    }
  }

  window.deleteContribution = async (id) => {
    if (!currentUser?.id) return alert("로그인 후 삭제할 수 있습니다.");
    const { error } = await supabase
      .from("wiki_contributions")
      .delete()
      .eq("id", id)
      .eq("uid", currentUser.id);
    if (error) return alert("삭제 실패: " + error.message);
    loadContributions();
  };

  window.editContribution = async (id, oldText) => {
    if (!currentUser?.id) return alert("로그인 후 수정할 수 있습니다.");
    const newText = prompt("새로운 내용 입력:", oldText);
    if (!newText) return;
    const { error } = await supabase
      .from("wiki_contributions")
      .update({ text: newText, time: new Date().toISOString() })
      .eq("id", id)
      .eq("uid", currentUser.id);
    if (error) return alert("수정 실패: " + error.message);
    loadContributions();
  };

  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      console.log("✍️ 기여 버튼 클릭됨");

      if (!currentUser?.id) return alert("로그인 후 기여할 수 있습니다.");

      const text = document.getElementById("content").value.trim();
      if (!text) return alert("내용을 입력하세요.");
      if (BAD_WORDS.some((w) => text.includes(w))) return alert("욕설은 금지입니다.");

      const now = Date.now();
      if (now - (userData.lastPostAt ?? 0) < POST_COOLDOWN)
        return alert("도배 방지: 잠시 후 다시 시도해 주세요.");

      const payload = {
        id: crypto.randomUUID(),
        post_id: pageId,
        uid: currentUser.id,
        username: userData.nickname,
        text,
        reports: 0,
        time: new Date().toISOString()
      };

      console.log("📦 삽입할 payload:", payload);

      const { error } = await supabase.from("wiki_contributions").insert([payload]);
      if (error) {
        console.error("❌ 기여 실패:", error);
        return alert("기여 실패: " + error.message);
      }

      console.log("✅ 기여 삽입 성공");
      userData.lastPostAt = now;
      document.getElementById("content").value = "";
      loadContributions();
    };
  }

  const likeBtn = document.getElementById("likeBtn");
  if (likeBtn) {
    likeBtn.onclick = async () => {
      console.log("👍 좋아요 버튼 클릭됨");

      if (!currentUser?.id) return alert("로그인 후 좋아요를 누를 수 있습니다.");

      const { data: existing } = await supabase
        .from("wiki_likes")
        .select("id")
        .eq("post_id", pageId)
        .eq("user_id", currentUser.id)
        .single();

      if (existing) return alert("이미 좋아요를 눌렀습니다.");

      const payload = { post_id: pageId, user_id: currentUser.id };
      const { error } = await supabase.from("wiki_likes").insert([payload]);
      if (error) return alert("좋아요 실패: " + error.message);

      await supabase.rpc("increment_likes", { post_id: pageId });
      document.getElementById("likeMsg").textContent = "좋아요가 반영되었습니다!";
    };
  }

  loadContributions();
}

// 로그인 상태 처리만 담당
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log("🔑 Auth 상태 변경:", event);
  if (session?.user) {
    currentUser = session.user;
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
  } else {
    currentUser = null;
    userData = null;
  }
});

// DOM 준비 후 initWiki 실행
document.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 DOMContentLoaded 이벤트 발생");
  if (window.__PAGE_ID__) initWiki(window.__PAGE_ID__);
});

console.log("🚀 wiki.js 로드됨");

export { initWiki };
