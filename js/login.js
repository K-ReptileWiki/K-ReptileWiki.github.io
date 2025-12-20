// 로그인 버튼 클릭 이벤트
document.getElementById("loginBtn").onclick = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    alert("로그인 실패: " + error.message);
    console.error("❌ 로그인 실패:", error);
  } else {
    const { user } = data;
    console.log("✅ 로그인 성공:", user);

    // 로그인 성공 시 방문 기록 저장
    await trackVisit(user);

    // 메인 페이지로 이동
    location.href = "index.html";
  }
};

// 방문 기록 저장 함수
async function trackVisit(user) {
  await supabase.from("visits").upsert({
    id: user.id,
    email: user.email,
    nickname: user.nickname ?? user.email.split("@")[0],
    times: [new Date().toISOString()]
  }, { onConflict: "id" });

  console.log("📌 방문 기록 저장 완료:", user.email);
}
