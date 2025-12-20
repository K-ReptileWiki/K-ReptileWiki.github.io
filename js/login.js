// 방문 기록 저장 함수 (로그 강화 + 디버깅용)
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
    console.log("🔎 기존 방문 기록 raw:", existing);
    console.log("🔎 기존 times 타입:", typeof existing?.times, "값:", existing?.times);
  }

  // 새 방문 시간 배열 생성
  let newTimes = [];
  if (Array.isArray(existing?.times)) {
    newTimes = [...existing.times, new Date().toISOString()];
  } else {
    newTimes = [new Date().toISOString()];
  }
  console.log("🆕 저장할 times 배열:", newTimes);

  // upsert로 저장
  const { data: upsertData, error: upsertError } = await supabase.from("visits").upsert({
    id: user.id,
    email: user.email,
    nickname: user.email.split("@")[0],
    times: newTimes
  }, { onConflict: "id" }).select();

  if (upsertError) {
    console.error("❌ 방문 기록 저장 실패:", upsertError);
  } else {
    console.log("📌 방문 기록 저장 완료:", user.email);
    console.log("📌 DB에 반영된 row:", upsertData);
  }

  console.log("▶ trackVisit 실행 종료");
}
