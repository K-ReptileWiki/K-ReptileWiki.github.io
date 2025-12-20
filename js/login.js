// 방문 기록 저장 함수 (누적)
async function trackVisit(user) {
  // 기존 방문 기록 가져오기
  const { data: existing } = await supabase
    .from("visits")
    .select("times")
    .eq("id", user.id)
    .maybeSingle();

  let newTimes = existing?.times
    ? [...existing.times, new Date().toISOString()]
    : [new Date().toISOString()];

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
    console.log("📌 방문 기록 저장 완료:", user.email);
  }
}
