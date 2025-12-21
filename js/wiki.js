import { supabaseService, supabase } from "./supabase.js";

const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"];
const POST_COOLDOWN = 30000;
let lastPostAt = 0;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getContribListEl() { return document.getElementById("contribList"); }
function getContentInputEl() { return document.getElementById("content"); }
function getLikeBtnEl() { return document.getElementById("likeBtn"); }

function initWiki(pageId) {
  console.log("✅ initWiki 실행됨:", pageId);

  // --- 기여 목록 불러오기 ---
  async function loadContributions() {
    const list = getContribListEl();
    if (!list) return;
    list.innerHTML = `<tr><td colspan="4" style="text-align:center;">불러오는 중...</td></tr>`;
    try {
      const { data, error } = await supabase
        .from("wiki_contributions")
        .select("*")
        .eq("post_id", pageId)
        .order("time", { ascending: false });

      if (error) {
        console.error("❌ 기여 조회 오류:", error);
        list.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#c00;">오류: ${escapeHtml(error.message)}</td></tr>`;
        return;
      }

      list.innerHTML = "";
      if (!data || data.length === 0) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center;">아직 기여가 없습니다</td></tr>`;
        return;
      }

      data.forEach((row) => {
        const tr = document.createElement("tr");
        const current = supabaseService.getCurrentUser();
        const isAuthor = current?.user?.id === row.uid;
        const isAdmin = supabaseService.isAdmin();

        const username = escapeHtml(row.username ?? "익명");
        const text = escapeHtml(row.text ?? "");
        const timeStr = row.time ? new Date(row.time).toLocaleString() : "-";

        const actions = (isAuthor || isAdmin)
          ? `<button onclick="deleteContribution('${row.id}')">삭제</button>
             ${isAuthor ? `<button onclick="editContribution('${row.id}', '${text.replace(/'/g, "\\'")}')">수정</button>` : ""}`
          : "권한 없음";

        tr.innerHTML = `<td>${username}</td><td>${text}</td><td>${timeStr}</td><td>${actions}</td>`;
        list.appendChild(tr);
      });
    } catch (e) {
      console.error("❌ 기여 조회 예외:", e);
      list.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#c00;">알 수 없는 오류</td></tr>`;
    }
  }

  // --- 기여 삭제 ---
  window.deleteContribution = async (id) => {
    if (!supabaseService.isLoggedIn()) return alert("로그인 후 삭제할 수 있습니다");
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      const { user } = supabaseService.getCurrentUser();
      const { error } = await supabase
        .from("wiki_contributions")
        .delete()
        .eq("id", id)
        .eq("uid", user.id);
      if (error) {
        console.error("❌ 삭제 실패:", error);
        alert("삭제 실패: " + error.message);
      } else {
        alert("삭제되었습니다");
        loadContributions();
      }
    } catch (e) {
      console.error("❌ 삭제 예외:", e);
      alert("삭제 중 오류 발생");
    }
  };

  // --- 기여 수정 ---
  window.editContribution = async (id, oldText) => {
    if (!supabaseService.isLoggedIn()) return alert("로그인 후 수정할 수 있습니다");
    const newText = prompt("새로운 내용 입력:", oldText)?.trim();
    if (!newText || newText === oldText) return;
    if (BAD_WORDS.some((w) => newText.includes(w))) return alert("욕설은 사용할 수 없습니다");
    try {
      const { user } = supabaseService.getCurrentUser();
      const { error } = await supabase
        .from("wiki_contributions")
        .update({ text: newText, time: new Date().toISOString() })
        .eq("id", id)
        .eq("uid", user.id);
      if (error) {
        console.error("❌ 수정 실패:", error);
        alert("수정 실패: " + error.message);
      } else {
        alert("수정되었습니다");
        loadContributions();
      }
    } catch (e) {
      console.error("❌ 수정 예외:", e);
      alert("수정 중 오류 발생");
    }
  };

  // --- 기여 추가 ---
  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      console.log("✍️ 기여 버튼 클릭됨");
      if (!supabaseService.isLoggedIn()) return location.href = "../login.html";

      const contentInput = getContentInputEl();
      const text = contentInput?.value.trim();
      if (!text) return alert("내용을 입력하세요");
      if (BAD_WORDS.some((w) => text.includes(w))) return alert("욕설은 사용할 수 없습니다");

      const now = Date.now();
      if (now - lastPostAt < POST_COOLDOWN) {
        const remaining = Math.ceil((POST_COOLDOWN - (now - lastPostAt)) / 1000);
        return alert(`도배 방지: ${remaining}초 후에 다시 시도해 주세요`);
      }

      const current = supabaseService.getCurrentUser();
      const user = current?.user;
      const nickname = current?.profile?.nickname || user?.email?.split("@")[0] || "익명";

      const payload = {
        id: crypto.randomUUID(),
        post_id: pageId,
        uid: user.id,
        username: nickname,
        text,
        reports: 0,
        time: new Date().toISOString(),
      };

      console.log("📦 삽입할 payload:", payload);

      try {
        const result = await supabase.from("wiki_contributions").insert([payload]).select();
        console.log("🔍 삽입 결과 전체:", result);
        if (result.error) {
          console.error("❌ 기여 실패:", result.error);
          alert("기여 실패: " + (result.error.message || "알 수 없는 오류"));
          return;
        }
        console.log("✅ 기여 삽입 성공:", result.data);
        lastPostAt = now;
        contentInput.value = "";
        alert("기여가 추가되었습니다!");
        await loadContributions();
      } catch (e) {
        console.error("❌ 기여 삽입 예외:", e);
        alert("삽입 중 오류 발생");
      }
    };
  }

  // --- 좋아요 수 업데이트 ---
  async function updateLikeCount() {
    const likeBtn = getLikeBtnEl();
    if (!likeBtn) return;
    try {
      const { count, error } = await supabase
        .from("wiki_likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", pageId);
      if (!error) likeBtn.textContent = `❤️ ${count || 0}`;
    } catch (e) {
      console.error("❌ 좋아요 카운트 예외:", e);
    }
  }

  // --- 좋아요 버튼 ---
  const likeBtn = getLikeBtnEl();
  if (likeBtn) {
    updateLikeCount();
    likeBtn.onclick = async () => {
      console.log("👍 좋아요 버튼 클릭됨");
      if (!supabaseService.isLoggedIn()) return location.href = "../login.html";
      try {
        const { user } = supabaseService.getCurrentUser();
        const { data: existing } = await supabase
          .from("wiki_likes")
          .select("id")
          .eq("post_id", pageId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) return alert("이미 좋아요를 눌렀습니다");
        const { error } = await supabase
          .from("wiki_likes")
          .insert([{ post_id: pageId, user_id: user.id }]);
        if (error) {
          console.error("❌ 좋아요 실패:", error);
          alert("좋아요 실패: " + error.message);
          return;
        }
        const likeMsg = document.getElementById("likeMsg");
        if (likeMsg) {
          likeMsg.textContent = "좋아요가 반영되었습니다!";
          setTimeout(() => { likeMsg.textContent = ""; }, 3000);
        }
        updateLikeCount();
      } catch (e) {
        console.error("❌ 좋아요 예외:", e);
        alert("좋아요 처리 중 알 수 없는 오류가 발생했습니다");
      }
    };
  }

  // --- 초기 로드 ---
  loadContributions();
}

// DOM 준비 후 initWiki 실행
document.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 DOMContentLoaded 이벤트 발생");

  if (window.__PAGE_ID__) {
    initWiki(window.__PAGE_ID__);
  } else {
    console.warn("⚠️ __PAGE_ID__가 설정되지 않았습니다");
  }
});

console.log("🚀 wiki.js 로드됨");
