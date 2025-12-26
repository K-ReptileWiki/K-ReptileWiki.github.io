// js/wiki.js
import { supabaseService } from "./supabase.js";

const PAGE_ID = window.__PAGE_ID__;

if (!PAGE_ID) {
  console.error("❌ PAGE_ID가 설정되지 않았습니다!");
}

// =========================
// 좋아요 기능 (종 페이지용)
// =========================
async function loadLikes() {
  try {
    const { data, error } = await supabaseService.client
      .from("species_likes")
      .select("*", { count: 'exact' })
      .eq("species_id", PAGE_ID);

    if (error) throw error;

    const count = data?.length || 0;
    document.getElementById("likeCount").textContent = count;
    console.log(`❤️ 좋아요 ${count}개 로드됨`);

  } catch (error) {
    console.error("좋아요 로드 실패:", error);
    document.getElementById("likeCount").textContent = "0";
  }
}

async function toggleLike() {
  try {
    console.log("👍 좋아요 버튼 클릭됨");

    if (!supabaseService.isLoggedIn()) {
      alert("로그인이 필요합니다");
      location.href = "../login.html";
      return;
    }

    const user = supabaseService.getCurrentUser().user;
    
    // 이미 좋아요 했는지 확인
    const { data: existing } = await supabaseService.client
      .from("species_likes")
      .select("id")
      .eq("species_id", PAGE_ID)
      .eq("uid", user.id)
      .maybeSingle();

    if (existing) {
      // 좋아요 취소
      await supabaseService.client
        .from("species_likes")
        .delete()
        .eq("id", existing.id);
      
      document.getElementById("likeMsg").textContent = "좋아요 취소됨";
      console.log("💔 좋아요 취소");
    } else {
      // 좋아요 추가
      const { error } = await supabaseService.client
        .from("species_likes")
        .insert({
          species_id: PAGE_ID,
          uid: user.id
        });

      if (error) throw error;

      document.getElementById("likeMsg").textContent = "좋아요!";
      console.log("❤️ 좋아요 추가");
    }

    // 메시지 자동 제거
    setTimeout(() => {
      document.getElementById("likeMsg").textContent = "";
    }, 2000);

    // 좋아요 수 갱신
    await loadLikes();

  } catch (error) {
    console.error("❌ 좋아요 실패:", error);
    alert("좋아요 처리 중 오류가 발생했습니다: " + error.message);
  }
}

// =========================
// 기여 기능 (종 페이지용)
// =========================
async function loadContributions() {
  try {
    const { data, error } = await supabaseService.client
      .from("species_contributions")
      .select("*")
      .eq("species_id", PAGE_ID)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const tbody = document.getElementById("contribList");
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">기여 내역이 없습니다</td></tr>';
      return;
    }

    data.forEach(contrib => {
      const row = document.createElement("tr");
      
      const currentUser = supabaseService.getCurrentUser().user;
      const isOwner = currentUser?.id === contrib.uid;
      const isAdmin = supabaseService.isAdmin();

      row.innerHTML = `
        <td>${contrib.author || "익명"}</td>
        <td>${contrib.content}</td>
        <td>${new Date(contrib.created_at).toLocaleString()}</td>
        <td>
          ${(isOwner || isAdmin) ? `
            <button class="editBtn" data-id="${contrib.id}">수정</button>
            <button class="deleteBtn" data-id="${contrib.id}">삭제</button>
          ` : '-'}
        </td>
      `;

      tbody.appendChild(row);
    });

    // 수정/삭제 버튼 이벤트
    document.querySelectorAll(".editBtn").forEach(btn => {
      btn.addEventListener("click", () => editContribution(btn.dataset.id));
    });

    document.querySelectorAll(".deleteBtn").forEach(btn => {
      btn.addEventListener("click", () => deleteContribution(btn.dataset.id));
    });

    console.log(`📝 기여 ${data.length}개 로드됨`);

  } catch (error) {
    console.error("기여 로드 실패:", error);
    const tbody = document.getElementById("contribList");
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;">기여 내역을 불러올 수 없습니다</td></tr>';
  }
}

async function addContribution() {
  try {
    if (!supabaseService.isLoggedIn()) {
      alert("로그인이 필요합니다");
      location.href = "../login.html";
      return;
    }

    const content = document.getElementById("content").value.trim();
    if (!content) {
      alert("내용을 입력해주세요");
      return;
    }

    const user = supabaseService.getCurrentUser();
    const author = user.data?.nickname || user.user.email.split("@")[0];

    const { error } = await supabaseService.client
      .from("species_contributions")
      .insert({
        species_id: PAGE_ID,
        content: content,
        uid: user.user.id,
        author: author
      });

    if (error) throw error;

    document.getElementById("content").value = "";
    alert("기여가 등록되었습니다!");
    await loadContributions();
    console.log("✅ 기여 추가 완료");

  } catch (error) {
    console.error("기여 추가 실패:", error);
    alert("기여 등록 중 오류가 발생했습니다: " + error.message);
  }
}

async function editContribution(id) {
  try {
    const newContent = prompt("수정할 내용을 입력하세요:");
    if (!newContent) return;

    const { error } = await supabaseService.client
      .from("species_contributions")
      .update({ 
        content: newContent,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) throw error;

    alert("수정되었습니다");
    await loadContributions();

  } catch (error) {
    console.error("기여 수정 실패:", error);
    alert("수정 중 오류가 발생했습니다");
  }
}

async function deleteContribution(id) {
  try {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    const { error } = await supabaseService.client
      .from("species_contributions")
      .delete()
      .eq("id", id);

    if (error) throw error;

    alert("삭제되었습니다");
    await loadContributions();

  } catch (error) {
    console.error("기여 삭제 실패:", error);
    alert("삭제 중 오류가 발생했습니다");
  }
}

// =========================
// 초기화
// =========================
async function init() {
  console.log("🚀 wiki.js 초기화 시작");
  console.log("📄 현재 PAGE_ID:", PAGE_ID);

  await supabaseService.waitForAuth();
  console.log("✅ 인증 완료");

  // 좋아요 로드
  await loadLikes();

  // 기여 로드
  await loadContributions();

  // 이벤트 리스너 등록
  const likeBtn = document.getElementById("likeBtn");
  if (likeBtn) {
    likeBtn.addEventListener("click", toggleLike);
  }

  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.addEventListener("click", addContribution);
  }

  console.log("✅ wiki.js 초기화 완료");
}

// 페이지 로드 시 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
