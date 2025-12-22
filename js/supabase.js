import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

class SupabaseService {
  constructor() {
    if (SupabaseService.instance) return SupabaseService.instance;

    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    this.currentUser = null;
    this.userData = null;
    this._authResolved = false;

    // 인증 완료 보장 Promise
    this._authPromise = new Promise((resolve) => {
      this._resolveAuth = resolve;
    });

    console.log("🚀 [System] Supabase 서비스 초기화 중...");

    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔑 [Auth Event] ${event}`, session?.user?.email || "세션 없음");
      
      if (session?.user) {
        await this.updateUserData(session.user);
      } else {
        this.currentUser = null;
        this.userData = null;
        this._completeAuth();
      }
    });

    SupabaseService.instance = this;
  }

  _completeAuth() {
    this._authResolved = true;
    if (this._resolveAuth) this._resolveAuth();
    console.log("🏁 [System] 인증 및 프로필 로드 완료");
  }

  async waitForAuth() {
    if (this._authResolved) return Promise.resolve();
    return this._authPromise;
  }

  async updateUserData(user) {
  this.currentUser = user;
  try {
    console.log("🔍 [System] 프로필 조회 중...");
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    this.userData = data || { id: user.id, nickname: user.email.split("@")[0], role: "user" };
    console.log("👤 [User] 데이터 로드 성공:", this.userData.nickname);
  } catch (err) {
    console.error("❌ [User] 데이터 로드 실패:", err.message);
    this.userData = { id: user.id, nickname: user.email.split("@")[0], role: "user" };
  } finally {
    this._completeAuth(); // ✅ 성공/실패 상관없이 항상 호출
  }
}

  /* =========================
     인증 기능
  ========================== */
  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async signUp(email, password, nickname) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };
    if (data?.user) {
      await this.client.from("profiles").insert([{ 
        id: data.user.id, email, nickname: nickname || email.split("@")[0], role: 'user' 
      }]);
    }
    return { success: true, data };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    return error ? { success: false, error: error.message } : { success: true };
  }

  /* =========================
     게시글 기능 (wiki_posts)
  ========================== */
  async createPost(title, content, images = []) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    try {
      const { data, error } = await this.client.from("wiki_posts").insert([{
        title, content, images,
        uid: this.currentUser.id,
        author: this.userData?.nickname || this.currentUser.email,
        time: new Date().toISOString(),
        deleted: false
      }]).select().single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) { return { success: false, error: err.message }; }
  }

  async getPosts() {
    const { data, error } = await this.client.from("wiki_posts").select("*").eq("deleted", false).order("time", { ascending: false });
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async getPost(id) {
    const { data, error } = await this.client.from("wiki_posts").select("*").eq("id", id).single();
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async deletePost(id) {
    const { error } = await this.client.from("wiki_posts").update({ deleted: true }).eq("id", id);
    return error ? { success: false, error: error.message } : { success: true };
  }

  /* =========================
     댓글 기능 (wiki_comments)
  ========================== */
  async addComment(postId, content) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    try {
      const { data, error } = await this.client.from("wiki_comments").insert([{
        post_id: postId, content,
        uid: this.currentUser.id,
        author: this.userData?.nickname || this.currentUser.email,
        time: new Date().toISOString()
      }]).select().single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) { return { success: false, error: err.message }; }
  }

  async getComments(postId) {
    const { data, error } = await this.client.from("wiki_comments").select("*").eq("post_id", postId).order("time", { ascending: false });
    return error ? { success: false, error: error.message } : { success: true, data: data || [] };
  }

  /* =========================
     기여 및 좋아요 (wiki.js 호환)
  ========================== */
  async addContribution(postId, content, summary) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    const { error } = await this.client.from("wiki_contributions").insert([{
      post_id: postId, uid: this.currentUser.id,
      author: this.userData?.nickname || this.currentUser.email,
      content, summary, time: new Date().toISOString()
    }]);
    return error ? { success: false, error: error.message } : { success: true };
  }

  /* =========================
     유틸리티
  ========================== */
  isLoggedIn() { return !!this.currentUser; }
  isAdmin() { return this.userData?.role === "admin"; }
  getCurrentUser() {
    return { user: this.currentUser, data: this.userData, profile: this.userData };
  }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
