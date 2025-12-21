import { supabaseService, supabase } from "./supabase.js";

const BAD_WORDS = ["시발", "병신", "ㅅㅂ", "ㅂㅅ", "애미", "애미 뒤짐"];
const POST_COOLDOWN = 30000; // 30초

let lastPostAt = 0;

function initWiki(pageId) {
  console.log("✅ initWiki 실행됨:", pageId);

  // 기여 목록 불러오기
  async function loadContributions() {
    const { data, error } = await supabase
      .from("wiki_contributions")
      .select("*")
      .eq("post_id", pageId)
      .order("time", { ascending: false });

    if (error) {
      console.error("❌ 기여 조회 오류:", error);
      return;
    }

    const list = document.getElementById("contribList");
    if (!list) return;

    list.innerHTML = "";
    
    if (!data || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4" style="text-align:center;">아직 기여가 없습니다</td>`;
      list.appendChild(tr);
      return;
    }

    data.forEach((row) => {
      const tr = document.createElement("tr");
      
      // 수정/삭제 버튼은 작성자만 보이게
      const isAuthor = supabaseService.isLoggedIn() && 
                      supabaseService.getCurrentUser().user.id === row.uid;
      const isAdmin = supabaseService.isAdmin();
      
      tr.innerHTML = `
        <td>${row.username ?? "익명"}</td>
        <td>${row.text}</td>
        <td>${new Date(row.time).toLocaleString()}</td>
        <td>
          ${isAuthor || isAdmin 
            ? `<button onclick="deleteContribution('${row.id}')">삭제</button>
               ${isAuthor ? `<button onclick="editContribution('${row.id}', '${row.text.replace(/'/g, "\\'")}')">수정</button>` : ""}`
            : "권한 없음"
          }
        </td>
      `;
      list.appendChild(tr);
    });
  }

  // 기여 삭제
  window.deleteContribution = async (id) => {
    if (!supabaseService.isLoggedIn()) {
      alert("로그인 후 삭제할 수 있습니다");
      return;
    }

    if (!confirm("정말 삭제하시겠습니까?")) return;

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
  };

  // 기여 수정
  window.editContribution = async (id, oldText) => {
    if (!supabaseService.isLoggedIn()) {
      alert("로그인 후 수정할 수 있습니다");
      return;
    }

    const newText = prompt("새로운 내용 입력:", oldText);
    if (!newText || newText === oldText) return;

    // 욕설 필터
    if (BAD_WORDS.some(word => newText.includes(word))) {
      alert("욕설은 사용할 수 없습니다");
      return;
    }

    const { user } = supabaseService.getCurrentUser();
    const { error } = await supabase
      .from("wiki_contributions")
      .update({ 
        text: newText, 
        time: new Date().toISOString() 
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

      const contentInput = document.getElementById("content");
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
      if (BAD_WORDS.some(word => text.includes(word))) {
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

      const { user, data } = supabaseService.getCurrentUser();
      const nickname = data?.nickname || user.email.split("@")[0];

      const payload = {
        id: crypto.randomUUID(),
        post_id: pageId,
        uid: user.id,
        username: nickname,
        text,
        reports: 0,
        time: new Date().toISOString()
      };

      console.log("📦 삽입할 payload:", payload);

      const { error } = await supabase
        .from("wiki_contributions")
        .insert([payload]);
      
      if (error) {
        console.error("❌ 기여 실패:", error);
        alert("기여 실패: " + error.message);
        return;
      }

      console.log("✅ 기여 삽입 성공");
      lastPostAt = now;
      contentInput.value = "";
      alert("기여가 추가되었습니다!");
      loadContributions();
    };
  }

  // 좋아요 버튼
  const likeBtn = document.getElementById("likeBtn");
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

      const { user } = supabaseService.getCurrentUser();

      // 이미 좋아요 눌렀는지 확인
      const { data: existing } = await supabase
        .from("wiki_likes")
        .select("id")
        .eq("post_id", pageId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        alert("이미 좋아요를 눌렀습니다");
        return;
      }

      // 좋아요 추가
      const { error } = await supabase
        .from("wiki_likes")
        .insert([{ 
          post_id: pageId, 
          user_id: user.id 
        }]);
      
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
    };
  }

  // 좋아요 수 업데이트
  async function updateLikeCount() {
    const likeBtn = document.getElementById("likeBtn");
    if (!likeBtn) return;

    const { count, error } = await supabase
      .from("wiki_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", pageId);

    if (!error) {
      likeBtn.textContent = `❤️ ${count || 0}`;
    }
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
