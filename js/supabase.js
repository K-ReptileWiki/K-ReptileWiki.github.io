import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   Supabase 설정
========================= */
const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

/* =========================
   Supabase Service 클래스
========================= */
class SupabaseService {
  constructor() {
    // 싱글톤 패턴
    if (SupabaseService.instance) {
      return SupabaseService.instance;
    }

    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    this.currentUser = null;
    this.userData = null;

    // 인증 대기 시스템 (핵심)
    this._authResolved = false;
    this._authPromise = new Promise((resolve) => {
      this._resolveAuth = resolve;
    });

    console.log("🚀 [System] Supabase 서비스 초기화 중...");

    // 인증 상태 변경 리스너
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

  // 인증 및 데이터 로드 완료 신호
  _completeAuth() {
    this._authResolved = true;
    if (this._resolveAuth) this._resolveAuth();
    console.log("🏁 [System] 인증 및 프로필 로드 완료");
  }

  // 페이지 로드 시 "인증 완료"까지 기다리는 함수
  async waitForAuth() {
    if (this._authResolved) return Promise.resolve();
    return this._authPromise;
  }

  // 사용자 상세 데이터(profiles 테이블) 로드
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

      if (data) {
        this.userData = data;
        console.log("👤 [User] 데이터 로드 성공:", data.nickname);
      } else {
        console.warn("⚠️ [User] 프로필 없음. 기본값 설정.");
        this.userData = { 
          id: user.id, 
          nickname: user.email.split("@")[0], 
          role: "user" 
        };
      }
    } catch (err) {
      console.error("❌ [User] 데이터 로드 실패:", err.message);
      this.userData = { id: user.id, nickname: user.email.split("@")[0], role: "user" };
    } finally {
      this._completeAuth();
    }
  }

  /* =========================
     인증 기능 (로그인 / 가입 / 로그아웃)
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
    
    // 가입 시 profiles 테이블에 기록 (닉네임 포함)
    if (data?.user) {
      await this.client.from("profiles").insert([{ 
        id: data.user.id, 
        email: email, 
        nickname: nickname || email.split("@")[0], 
        role: 'user' 
      }]);
    }
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
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getPosts() {
    const { data, error } = await this.client
      .from("wiki_posts")
      .select("*")
      .eq("deleted", false)
      .order("time", { ascending: false });
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async getPost(id) {
    const { data, error } = await this.client
      .from("wiki_posts")
      .select("*")
      .eq("id", id)
      .single();
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async deletePost(id) {
    // 실제 삭제 대신 Soft Delete (플래그 변경)
    const { error } = await this.client
      .from("wiki_posts")
      .update({ deleted: true })
      .eq("id", id);
    return error ? { success: false, error: error.message } : { success: true };
  }

  /* =========================
     댓글 기능
  ========================== */
  async addComment(postId, content) {
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };
    try {
      const { data, error } = await this.client
        .from("wiki_comments")
        .insert([{
          post_id: postId,
          content,
          uid: this.currentUser.id,
          author: this.userData?.nickname || this.currentUser.email.split("@")[0],
          time: new Date().toISOString()
        }])
        .select().single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getComments(postId) {
    const { data, error } = await this.client
      .from("wiki_comments")
      .select("*")
      .eq("post_id", postId)
      .order("time", { ascending: false });
    
    return error ? { success: false, error: error.message } : { success: true, data: data || [] };
  }

  /* =========================
     유틸리티 (기존 index.html/admin.js와 호환)
  ========================== */
  isLoggedIn() { return !!this.currentUser; }
  isAdmin() { return this.userData?.role === "admin"; }
  getCurrentUser() { 
    return { 
      user: this.currentUser, 
      data: this.userData,
      profile: this.userData // index.html 등 다른 파일과의 호환성
    }; 
  }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
