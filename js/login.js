// 방문 기록 저장 함수 (누적 + 로그 강화)
async function trackVisit(user) {
  console.log("▶ trackVisit 실행 시작:", user);

  // 기존 방문 기록 조회
  const { data: existing, error: selectError } = await supabase
    .from("visits")
    .select("id, email, times")
    .eq("id", user.id)
    .maybeSingle();

  console.log("🔎 조회 결과 existing:", existing);
  if (selectError) {
    console.error("❌ 기존 방문 기록 조회 실패:", selectError);
  }

  // 새 방문 시간 배열 생성
  let newTimes = [];
  if (Array.isArray(existing?.times)) {
    // jsonb가 배열로 들어온 경우
    newTimes = [...existing.times, new Date().toISOString()];
  } else if (existing?.times && typeof existing.times === "object") {
    // jsonb가 객체로 들어온 경우 (예: {0: "...", 1: "..."})
    newTimes = [...Object.values(existing.times), new Date().toISOString()];
  } else {
    // row가 없거나 times가 null인 경우
    newTimes = [new Date().toISOString()];
  }
  console.log("🆕 저장할 times:", newTimes);

  // upsert로 저장
  const { data: upsertData, error: upsertError } = await supabase
    .from("visits")
    .upsert({
      id: user.id,
      email: user.email,
      nickname: user.email.split("@")[0],
      times: newTimes
    }, { onConflict: "id" })
    .select();

  if (upsertError) {
    console.error("❌ 방문 기록 저장 실패:", upsertError);
  } else {
    console.log("📌 방문 기록 저장 완료:", user.email);
    console.log("📌 DB에 반영된 row:", upsertData);
  }

  console.log("▶ trackVisit 실행 종료");
}
