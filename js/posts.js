import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Supabase 초기화
const supabaseUrl = "https://cpaikpjzlzzujwfgnanb.supabase.co";
const supabaseKey = "sb_publishable_-dZ6xDssPQs29A_hHa2Irw_WxZ24NxB";
const supabase = createClient(supabaseUrl, supabaseKey);

// Quill 에디터 초기화
const quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'header': [1,2,3,4,5,6,false] }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'image']   // 이미지 아이콘 유지
    ]
  },
  placeholder: "내용을 입력하세요..."
});

// ✅ 이미지 클릭 시 크기 선택 메뉴
quill.root.addEventListener("click", (e) => {
  if (e.target.tagName === "IMG") {
    const img = e.target;

    // 기존 메뉴 제거
    const oldMenu = document.getElementById("img-size-menu");
    if (oldMenu) oldMenu.remove();

    // 메뉴 생성
    const sizes = [200, 250, 300, 400, 450, 500];
    const menu = document.createElement("div");
    menu.id = "img-size-menu";
    menu.style.position = "absolute";
    menu.style.background = "#fff";
    menu.style.border = "1px solid #ccc";
    menu.style.padding = "5px";
    menu.style.zIndex = "1000";

    sizes.forEach(size => {
      const btn = document.createElement("button");
      btn.textContent = size + "px";
      btn.style.margin = "2px";
      btn.onclick = () => {
        img.style.width = size + "px";
        img.style.height = "auto";
        menu.remove();
      };
      menu.appendChild(btn);
    });

    // 이미지 위치 기준으로 메뉴 띄우기
    const rect = img.getBoundingClientRect();
    menu.style.left = rect.left + "px";
    menu.style.top = rect.bottom + "px";

    document.body.appendChild(menu);

    // 다른 곳 클릭하면 메뉴 닫기
    document.addEventListener("click", function closeMenu(ev) {
      if (!menu.contains(ev.target) && ev.target !== img) {
        if (document.body.contains(menu)) {
          menu.remove();
        }
        document.removeEventListener("click", closeMenu);
      }
    });
  }
});

// 글 목록 불러오기
async function initPosts() {
  const { data, error } = await supabase
    .from("wiki_posts")
    .select("*")
    .order("time", { ascending: false });

  const list = document.getElementById("postList");
  list.innerHTML = "";

  if (error) {
    list.textContent = "글을 불러오는 중 오류가 발생했습니다.";
    console.error("글 불러오기 실패:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    list.textContent = "아직 작성된 글이 없습니다.";
    return;
  }

  data.forEach(p => {
    const div = document.createElement("div");
    div.className = "post-card";

    let imgHtml = "";
    if (p.images && Array.isArray(p.images)) {
      imgHtml = p.images.map(url => `<img src="${url}" style="width:300px;height:auto;margin:5px;">`).join("");
    }

    const plainText = p.content?.replace(/<[^>]+>/g, "") ?? "";
    const shortText = plainText.length > 100 ? plainText.substring(0, 100) + "..." : plainText;

    div.innerHTML = `
      <h3><a href="post.html?id=${p.id}">${p.title}</a></h3>
      <p>${shortText}</p>
      ${imgHtml}
      <a href="post.html?id=${p.id}">자세히 보기 →</a><br>
      <small>작성자: ${p.author ?? "익명"} | ${new Date(p.time).toLocaleString()}</small>
    `;
    list.appendChild(div);
  });
}

// 글 등록 버튼
document.getElementById("postBtn").addEventListener("click", async () => {
  const title = document.getElementById("postTitle").value.trim();
  const content = quill.root.innerHTML;

  if (!title || !content) {
    alert("제목과 내용을 입력하세요");
    return;
  }

  // 현재 로그인 사용자 가져오기
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    alert("로그인이 필요합니다");
    return;
  }

  // 글 등록
  const { data, error: insertError } = await supabase
    .from("wiki_posts")
    .insert([{
      id: crypto.randomUUID(),
      title,
      content,
      author: user.email ?? "익명",
      time: new Date().toISOString(),
      images: [] // 파일 업로드 버튼 제거 → 빈 배열 저장
    }])
    .select();

  if (insertError) {
    console.error("글 등록 실패:", insertError.message);
    alert("글 등록 실패: " + insertError.message);
    return;
  }

  if (data?.length) {
    alert("글이 게시되었습니다!");
    window.location.href = `post.html?id=${data[0].id}`;
  }
});

// 글쓰기 취소 버튼
document.getElementById("cancelBtn").addEventListener("click", () => {
  if (confirm("작성 중인 글을 취소하고 메인으로 돌아가시겠습니까?")) {
    window.location.href = "index.html";
  }
});

// 미리보기 버튼
document.getElementById("previewBtn").addEventListener("click", () => {
  const title = document.getElementById("postTitle").value.trim();
  const content = quill.root.innerHTML;

  const previewArea = document.getElementById("previewArea");
  previewArea.style.display = "block";
  previewArea.innerHTML = `
    <h3>${title || "(제목 없음)"}</h3>
    <div>${content || "(내용 없음)"}</div>
  `;
});

// 페이지 로드 시 글 목록 불러오기
initPosts();
