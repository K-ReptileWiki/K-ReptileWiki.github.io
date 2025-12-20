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
      ['link']
    ]
  },
  placeholder: "내용을 입력하세요..."
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
      imgHtml = p.images.map(url => `<img src="${url}" style="max-width:150px;margin:5px;">`).join("");
    }

    const plainText = p.content.replace(/<[^>]+>/g, "");
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

// 글 작성 버튼
document.getElementById("postBtn").addEventListener("click", async () => {
  const title = document.getElementById("postTitle").value.trim();
  const content = quill.root.innerHTML;
  const files = document.getElementById("images").files;

  if (!title || !content) return alert("제목과 내용을 입력하세요");
  if (files.length > 3) return alert("사진은 최대 3장까지 첨부 가능합니다");

  const imageUrls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("image").upload(fileName, file);
    if (error) {
      alert("이미지 업로드 실패: " + error.message);
      return;
    }
    const { data: publicUrl } = supabase.storage.from("image").getPublicUrl(fileName);
    imageUrls.push(publicUrl.publicUrl);
  }

// 현재 로그인 사용자 가져오기
const { data: { user } } = await supabase.auth.getUser();

const { error: insertError } = await supabase
  .from("wiki_posts")
  .insert([{ 
    title, 
    content, 
    author: user?.email ?? "익명",   // 작성자 이메일 또는 익명
    uid: user?.id ?? null,          // ✅ 작성자 UID 저장
    time: new Date().toISOString(), 
    images: imageUrls 
  }]);


  if (insertError) {
    alert("글 등록 실패: " + insertError.message);
  } else {
    alert("글이 게시되었습니다!");
    window.location.href = "index.html";
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
  const files = document.getElementById("images").files;

  let imgHtml = "";
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const url = URL.createObjectURL(file);
    imgHtml += `<img src="${url}" style="max-width:200px;margin:5px;">`;
  }

  const previewArea = document.getElementById("previewArea");
  previewArea.style.display = "block";
  previewArea.innerHTML = `
    <h3>${title || "(제목 없음)"}</h3>
    <div>${content || "(내용 없음)"}</div>
    ${imgHtml}
  `;
});

// 페이지 로드 시 글 목록 불러오기
initPosts();
