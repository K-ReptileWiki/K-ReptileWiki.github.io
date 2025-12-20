// 방문 기록 저장 함수 (로그 강화)
async function trackVisit(user) {
  console.log("▶ trackVisit 실행 시작:", user);

  // 기존 방문 기록 가져오기
  const { data: existing, error: selectError } = await supabase
    .from("visits")
    .select("times")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("❌ 기존 방문 기록 조회 실패:", selectError);
  } else {
    console.log("🔎 기존 방문 기록:", existing);
  }

  // 새 방문 시간 배열 생성
  let newTimes = [];
  if (Array.isArray(existing?.times)) {
    newTimes = [...existing.times, new Date().toISOString()];
  } else {
    newTimes = [new Date().toISOString()];
  }
  console.log("🆕 저장할 times:", newTimes);

  // upsert로 저장
  const { error: upsertError } = await supabase.from("visits").upsert({
    id: user.id,
    email: user.email,
    nickname: user.email.split("@")[0],
    times: newTimes
  }, { onConflict: "id" });

  if (upsertError) {
    console.error("❌ 방문 기록 저장 실패:", upsertError);
  } else {
    console.log("📌 방문 기록 저장 완료:", user.email, "🆕 times:", newTimes);
  }

  console.log("▶ trackVisit 실행 종료");
}
