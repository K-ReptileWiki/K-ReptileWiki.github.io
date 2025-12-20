async function trackVisit(user) {
  console.log("▶ trackVisit 실행 시작:", user);

  const { data: existing, error: selectError } = await supabase
    .from("visits")
    .select("times")
    .eq("id", user.id)
    .maybeSingle();

  console.log("🔎 조회 결과 existing:", existing);
  console.log("🔎 조회 에러:", selectError);

  let newTimes = [];
  if (Array.isArray(existing?.times)) {
    newTimes = [...existing.times, new Date().toISOString()];
  } else {
    newTimes = [new Date().toISOString()];
  }
  console.log("🆕 저장할 times:", newTimes);

  const { data: upsertData, error: upsertError } = await supabase
    .from("visits")
    .upsert({
      id: user.id,
      email: user.email,
      nickname: user.email.split("@")[0],
      times: newTimes
    }, { onConflict: "id" })
    .select();

  console.log("📌 upsert 결과:", upsertData);
  console.log("📌 upsert 에러:", upsertError);

  console.log("▶ trackVisit 실행 종료");
}
