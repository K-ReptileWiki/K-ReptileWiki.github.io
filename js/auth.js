<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>K-ReptileWiki 로그인</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>🦎 K-ReptileWiki 로그인</h1>

  <div>
    <label>이메일: <input type="email" id="email"></label><br>
    <label>비밀번호: <input type="password" id="password"></label><br>
    <label>닉네임: <input type="text" id="nickname"></label><br>
    <label>비밀번호 확인: <input type="password" id="confirmPassword"></label><br>
    <button id="loginBtn">로그인</button>
    <button id="registerBtn">회원가입</button>
    <button id="logoutBtn">로그아웃</button>
    <button id="cancelBtn">취소</button>
  </div>

  <p id="userInfo">현재 로그인된 사용자 없음</p>

  <script type="module">
    import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

    const supabase = createClient(
      "https://cpaikpjzlzzujwfgnanb.supabase.co",
      "sb_publishable_-dZ6xDssPQs29A_hHa2Irw_WxZ24NxB"
    );

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const nicknameInput = document.getElementById("nickname");
    const userInfo = document.getElementById("userInfo");

    // 로그인
    document.getElementById("loginBtn").onclick = async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert("로그인 실패: " + error.message);
        console.error("❌ 로그인 실패:", error);
      } else {
        alert("로그인 성공!");
        console.log("✅ 로그인 성공:", data);
        window.location.href = "index.html";
      }
    };

    // 회원가입
    document.getElementById("registerBtn").onclick = async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const confirmPassword = confirmPasswordInput.value.trim();
      const nickname = nicknameInput.value.trim() || email.split("@")[0];

      if (password !== confirmPassword) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        alert("회원가입 실패: " + error.message);
        console.error("❌ 회원가입 실패:", error);
      } else {
        alert("회원가입 성공!");
        console.log("✅ 회원가입 성공:", data);

        // 추가 프로필 정보 저장 (profiles 테이블 필요)
        if (data.user) {
          await supabase.from("profiles").insert({
            id: data.user.id,
            email,
            nickname,
            role: "user", // 기본 권한
            created_at: new Date().toISOString()
          });
          console.log("✅ 프로필 저장 완료");
        }
      }
    };

    // 로그아웃
    document.getElementById("logoutBtn").onclick = async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert("로그아웃 실패: " + error.message);
        console.error("❌ 로그아웃 실패:", error);
      } else {
        alert("로그아웃 완료");
        console.log("✅ 로그아웃 완료");
        window.location.href = "login.html";
      }
    };

    // 취소 → 메인 페이지 이동
    document.getElementById("cancelBtn").onclick = () => {
      window.location.href = "index.html";
    };

    // 로그인 상태 표시
    document.addEventListener("DOMContentLoaded", async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 프로필 테이블에서 추가 정보 가져오기
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (profile) {
          userInfo.textContent = `현재 로그인: ${profile.nickname ?? user.email} (권한: ${profile.role ?? "user"})`;
          console.log("✅ 로그인된 사용자:", profile);
        } else {
          userInfo.textContent = `현재 로그인: ${user.email}`;
          console.warn("❌ 프로필 문서 없음:", user.id);
        }
      } else {
        userInfo.textContent = "현재 로그인된 사용자 없음";
        console.log("ℹ️ 로그인된 사용자 없음");
      }
    });
  </script>
</body>
</html>
