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

    console.log("🚀 [System] Supabase 서비스 초기화 중...");

    // 인증 상태 감지
    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔑 [Auth Event] ${event}`, session?.user?.email || "세션 없음");
      if (session?.user) {
        await this.updateUserData(session.user);
      } else {
        this.currentUser = null;
        this.userData = null;
      }
      this._authResolved = true;
    });

    SupabaseService.instance = this;
  }

  // 인증 대기용
  async waitForAuth() {
    if (this._authResolved) return;
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (this._authResolved) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  async updateUserData(user) {
    this.currentUser = user;
    try {
      // 테이블명이 profiles인지 users인지 확인이 필요할 수 있습니다. (기존 index.html 등에서 profiles 사용)
      const { data, error } = await this.client
        .from("users") 
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        this.userData = data;
        console.log("👤 [User] 데이터 로드 성공:", data.nickname);
      } else {
        console.warn("⚠️ [User] 유저 테이블에 정보가 없습니다. 기본값 사용.");
        this.userData = { id: user.id, nickname: user.email.split("@")[0], role: "user" };
      }
    } catch (err) {
      console.error("❌ [User] 데이터 로드 실패:", err);
    }
  }

  /* =========================
     인증 기능 (Sign In / Up / Out)
  ========================== */
  async signIn(email, password) {
    console.log("Attempting Login:", email);
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async signUp(email, password, nickname) {
    console.log("Attempting Sign Up:", email);
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };
    
    // 유저 테이블 기록
    await this.client.from("users").insert([{ id: data.user.id, email, nickname, role: 'user' }]);
    return { success: true, data };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    return error ? { success: false, error: error.message } : { success: true };
  }

  /* =========================
     게시글 기능 (CRUD)
  ========================== */
  async createPost(title, content, images = []) {
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };
    console.log("📝 [Create] 글 등록 시도:", title);

    try {
      const { data, error } = await this.client
        .from("wiki_posts")
        .insert([{
          title,
          content,
          images,
          uid: this.currentUser.id,
          author: this.userData?.nickname || this.currentUser.email.split("@")[0],
          time: new Date().toISOString(),
          deleted: false
        }])
        .select().single();

      if (error) throw error;
      console.log("✅ [Create] 등록 완료 ID:", data.id);
      return { success: true, data };
    } catch (err) {
      console.error("❌ [Create] 에러:", err.message);
      return { success: false, error: err.message };
    }
  }

  async getPosts() {
    console.log("📂 [Read] 목록 요청...");
    const { data, error } = await this.client
      .from("wiki_posts")
      .select("*")
      .eq("deleted", false)
      .order("time", { ascending: false });
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async getPost(id) {
    const { data, error } = await this.client.from("wiki_posts").select("*").eq("id", id).single();
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  /* =========================
     댓글 기능
  ========================== */
  async addComment(postId, content) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    const { data, error } = await this.client.from("wiki_comments").insert([{
      post_id: postId,
      content,
      uid: this.currentUser.id,
      author: this.userData?.nickname || this.currentUser.email.split("@")[0],
      time: new Date().toISOString()
    }]).select().single();
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async getComments(postId) {
    const { data, error } = await this.client.from("wiki_comments").select("*").eq("post_id", postId).order("time", { ascending: false });
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  /* =========================
     유틸리티
  ========================== */
  isLoggedIn() { return !!this.currentUser; }
  isAdmin() { return this.userData?.role === "admin"; }
  getCurrentUser() { return { user: this.currentUser, data: this.userData }; }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
