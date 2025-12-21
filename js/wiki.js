// wiki.js (revised, original features preserved)
// - Keeps add/edit/delete contributions, likes, cooldown, profanity filter
// - Adds robust error logging and defensive checks
// - Ensures correct ordering and rendering even if time column is missing
// - Shows loading states and handles empty UI safely

import { supabaseService, supabase } from "./supabase.js";

const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"];
const POST_COOLDOWN = 30000; // 30초
let lastPostAt = 0;

// Small helpers
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getContribListEl() {
  const el = document.getElementById("contribList");
  if (!el) {
    console.warn("⚠️ contribList 요소를 찾지 못했습니다. HTML에 <tbody id='contribList'></tbody>가 있어야 합니다.");
  }
  return el;
}

function getContentInputEl() {
  const el = document.getElementById("content");
  if (!el) {
    console.warn("⚠️ content 입력 요소를 찾지 못했습니다. HTML에 <input id='content' /> 또는 <textarea id='content'></textarea>가 있어야 합니다.");
  }
  return el;
}

function getLikeBtnEl() {
  const el = document.getElementById("likeBtn");
  if (!el) {
    console.warn("⚠️ likeBtn 요소를 찾지 못했습니다. HTML에 <button id='likeBtn'></button>가 있어야 합니다.");
  }
  return el;
}

function initWiki(pageId) {
  console.log("✅ initWiki 실행됨:", pageId);
  if (!pageId || typeof pageId !== "string") {
    console.warn("⚠️ pageId가 유효하지 않습니다:", pageId);
  }

  // 기여 목록 불러오기
  async function loadContributions() {
    const list = getContribListEl();
    if (!list) return;

    // Loading state
    list.innerHTML = `<tr><td colspan="4" style="text-align:center;">불러오는 중...</td></tr>`;

    try {
      // Prefer ordering by 'time' if exists, else fallback to 'created_at'
      // We assume 'time' exists per your schema; if not, change to created_at.
      const { data, error } = await supabase
        .from("wiki_contributions")
        .select("*")
        .eq("post_id", pageId)
        .order("time", { ascending: false });

      if (error) {
        console.error("❌ 기여 조회 오류:", error);
        list.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#c00;">기여를 불러오는 중 오류가 발생했습니다: ${escapeHtml(error.message)}</td></tr>`;
        return;
      }

      list.innerHTML = "";

      if (!data || data.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="4" style="text-align:center;">아직 기여가 없습니다</td>`;
        list.appendChild(tr);
        return;
      }

      data.forEach((row) => {
        const tr = document.createElement("tr");

        const isLoggedIn = supabaseService.isLoggedIn();
        const current = supabaseService.getCurrentUser();
        const isAuthor = isLoggedIn && current?.user?.id === row.uid;
        const isAdmin = supabaseService.isAdmin();

        const username = escapeHtml(row.username ?? "익명");
        const text = escapeHtml(row.text ?? "");
        const timeStr = row.time ? new Date(row.time).toLocaleString() : "-";

        const actions = (isAuthor || isAdmin)
          ? `
            <button onclick="deleteContribution('${row.id}')">삭제</button>
            ${isAuthor ? `<button onclick="editContribution('${row.id}', '${text.replace(/'/g, "\\'")}')">수정</button>` : ""}
          `
          : "권한 없음";

        tr.innerHTML = `
          <td>${username}</td>
          <td>${text}</td>
          <td>${timeStr}</td>
          <td>${actions}</td>
        `;
        list.appendChild(tr);
      });
    } catch (e) {
      console.error("❌ 기여 조회 예외:", e);
      list.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#c00;">기여를 불러오는 중 알 수 없는 오류</td></tr>`;
    }
  }

  // 기여 삭제
  window.deleteContribution = async (id) => {
    if (!supabaseService.isLoggedIn()) {
      alert("로그인 후 삭제할 수 있습니다");
      return;
    }
    if (!id) return;

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
      alert("삭제 중 알 수 없는 오류가 발생했습니다");
    }
  };

  // 기여 수정
  window.editContribution = async (id, oldText) => {
    if (!supabaseService.isLoggedIn()) {
      alert("로그인 후 수정할 수 있습니다");
      return;
    }
    if (!id) return;

    const newText = prompt("새로운 내용 입력:", oldText);
    if (newText == null) return; // cancel
    const trimmed = newText.trim();
    if (!trimmed || trimmed === oldText) return;

    // 욕설 필터
    if (BAD_WORDS.some((word) => trimmed.includes(word))) {
      alert("욕설은 사용할 수 없습니다");
      return;
    }

    try {
      const { user } = supabaseService.getCurrentUser();
      const { error } = await supabase
        .from("wiki_contributions")
        .update({
          text: trimmed,
          time: new Date().toISOString(),
        })
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
      alert("수정 중 알 수 없는 오류가 발생했습니다");
    }
  };

  // 기여 추가 버튼
  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      console.log("✍️ 기여 버튼 클릭됨");

      if (!supabaseService.isLoggedIn()) {
        alert("로그인 후 기여할 수 있습니다");
        location.href = "../login.html";
        return;
      }

      const contentInput = getContentInputEl();
      if (!contentInput) {
        alert("입력 필드를 찾을 수 없습니다");
        return;
      }

      const text = contentInput.value.trim();
      if (!text) {
        alert("내용을 입력하세요");
        return;
      }

      // 욕설 필터
      if (BAD_WORDS.some((word) => text.includes(word))) {
        alert("욕설은 사용할 수 없습니다");
        return;
      }

      // 도배 방지
      const now = Date.now();
      if (now - lastPostAt < POST_COOLDOWN) {
        const remaining = Math.ceil((POST_COOLDOWN - (now - lastPostAt)) / 1000);
        alert(`도배 방지: ${remaining}초 후에 다시 시도해 주세요`);
        return;
      }

      const current = supabaseService.getCurrentUser();
      const user = current?.user;
      const profile = current?.profile;
      if (!user) {
        alert("로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.");
        location.href = "../login.html";
        return;
      }

      const nickname = profile?.nickname || (user.email ? user.email.split("@")[0] : "익명");

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
  const { data, error } = await supabase
    .from("wiki_contributions")
    .insert([payload])
    .select();

  console.log("🔍 삽입 결과:", { data, error }); // 무조건 찍기

  if (error) {
    console.error("❌ 기여 실패:", error.message);
    alert("기여 실패: " + error.message);
    return;
  }

  console.log("✅ 기여 삽입 성공:", data);
  lastPostAt = now;
  contentInput.value = "";
  alert("기여가 추가되었습니다!");
  await loadContributions();
} catch (e) {
  console.error("❌ 기여 삽입 예외:", e);
  alert("기여 중 알 수 없는 오류가 발생했습니다");
}


  // 좋아요 수 업데이트
  async function updateLikeCount() {
    const likeBtn = getLikeBtnEl();
    if (!likeBtn) return;

    try {
      const { count, error } = await supabase
        .from("wiki_likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", pageId);

      if (error) {
        console.error("❌ 좋아요 카운트 조회 실패:", error);
        return;
      }
      likeBtn.textContent = `❤️ ${count || 0}`;
    } catch (e) {
      console.error("❌ 좋아요 카운트 예외:", e);
    }
  }

  // 좋아요 버튼
  const likeBtn = getLikeBtnEl();
  if (likeBtn) {
    // 초기 좋아요 수 표시
    updateLikeCount();

    likeBtn.onclick = async () => {
      console.log("👍 좋아요 버튼 클릭됨");

      if (!supabaseService.isLoggedIn()) {
        alert("로그인 후 좋아요를 누를 수 있습니다");
        location.href = "../login.html";
        return;
      }

      try {
        const { user } = supabaseService.getCurrentUser();
        if (!user) {
          alert("로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.");
          location.href = "../login.html";
          return;
        }

        // 이미 좋아요 눌렀는지 확인
        const { data: existing, error: existErr } = await supabase
          .from("wiki_likes")
          .select("id")
          .eq("post_id", pageId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existErr) {
          console.error("❌ 좋아요 중복 확인 실패:", existErr);
          alert("좋아요 확인 중 오류가 발생했습니다");
          return;
        }

        if (existing) {
          alert("이미 좋아요를 눌렀습니다");
          return;
        }

        // 좋아요 추가
        const { error } = await supabase
          .from("wiki_likes")
          .insert([{ post_id: pageId, user_id: user.id }]);

        if (error) {
          console.error("❌ 좋아요 실패:", error);
          alert("좋아요 실패: " + error.message);
          return;
        }

        // 메시지 표시
        const likeMsg = document.getElementById("likeMsg");
        if (likeMsg) {
          likeMsg.textContent = "좋아요가 반영되었습니다!";
          setTimeout(() => {
            likeMsg.textContent = "";
          }, 3000);
        }

        // 카운트 업데이트
        updateLikeCount();
      } catch (e) {
        console.error("❌ 좋아요 예외:", e);
        alert("좋아요 처리 중 알 수 없는 오류가 발생했습니다");
      }
    };
  }

  // 초기 로드
  loadContributions();
}

// DOM 준비 후 initWiki 실행
document.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 DOMContentLoaded 이벤트 발생");

  // window.__PAGE_ID__가 설정되어 있으면 위키 초기화
  if (window.__PAGE_ID__) {
    initWiki(window.__PAGE_ID__);
  } else {
    console.warn("⚠️ __PAGE_ID__가 설정되지 않았습니다");
  }
});

console.log("🚀 wiki.js 로드됨");

export { initWiki };
