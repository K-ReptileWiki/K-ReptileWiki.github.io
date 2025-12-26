import { supabaseService, supabase } from "./supabase.js";

/* =========================
   ROLE HELPERS
========================== */
function myRole() {
  return supabaseService.getCurrentUser().data.role;
}
function myId() {
  return supabaseService.getCurrentUser().user.id;
}
function isAdmin() {
  return ["mod","owner"].includes(myRole());
}
function isOwner() {
  return myRole() === "owner";
}

/* =========================
   LOG SYSTEM
========================== */
async function logAction(action, table, id, snapshot = null) {
  await supabase.from("admin_logs").insert({
    admin_id: myId(),
    action,
    target_table: table,
    target_id: id,
    snapshot
  });
}

/* =========================
   USERS
========================== */
export async function updateRole(uid, role) {
  if (!isOwner()) throw new Error("owner만 가능");

  const { data: before } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .single();

  await supabase.from("profiles").update({ role }).eq("id", uid);
  await logAction("ROLE_CHANGE", "profiles", uid, before);
}

/* =========================
   POSTS
========================== */
export async function deletePost(id) {
  if (!isAdmin()) throw new Error("권한 없음");

  const { data } = await supabase
    .from("wiki_posts")
    .select("*")
    .eq("id", id)
    .single();

  await supabase.from("wiki_posts").update({ deleted: true }).eq("id", id);
  await logAction("POST_DELETE", "wiki_posts", id, data);
}

export async function restorePost(id) {
  await supabase.from("wiki_posts").update({ deleted: false }).eq("id", id);
  await logAction("POST_RESTORE", "wiki_posts", id);
}

/* =========================
   COMMENTS
========================== */
export async function deleteComment(id) {
  if (!isAdmin()) throw new Error("권한 없음");

  const { data } = await supabase
    .from("wiki_comments")
    .select("*")
    .eq("id", id)
    .single();

  await supabase.from("wiki_comments").delete().eq("id", id);
  await logAction("COMMENT_DELETE", "wiki_comments", id, data);
}

/* =========================
   UNDO SYSTEM
========================== */
export async function undo(logId) {
  if (!isOwner()) throw new Error("owner만 가능");

  const { data: log } = await supabase
    .from("admin_logs")
    .select("*")
    .eq("id", logId)
    .single();

  if (!log.snapshot) throw new Error("복구 불가");

  await supabase
    .from(log.target_table)
    .upsert(log.snapshot);

  await logAction("UNDO", log.target_table, log.target_id);
}
