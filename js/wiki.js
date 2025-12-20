console.log("🚀 wiki.js 로드됨");

// 테스트: 로그인과 상관없이 바로 initWiki 실행
if (window.__PAGE_ID__) {
  console.log("📄 강제 initWiki 실행, PAGE_ID:", window.__PAGE_ID__);
  initWiki(window.__PAGE_ID__);
}
