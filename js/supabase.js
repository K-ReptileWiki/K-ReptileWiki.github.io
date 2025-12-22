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
    if (SupabaseService.instance) return SupabaseService.instance;

    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    this.currentUser = null;
    this.userData = null;
    this._authResolved = false;

    // ⭐ 로그인 상태 확인을 보장하는 Promise 시스템
    this._authPromise = new Promise((resolve) => {
      this._resolveAuth = resolve;
    });

    console.log("🚀 [System] Supabase 서비스 초기화 중...");

    // 인증 상태 변화 감지
    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔑 [Auth Event] ${event}`, session?.user?.email || "세션 없음");
      
      if (session?.user) {
        await this.updateUserData(session.user);
      } else {
        this.currentUser = null;
        this.userData = null;
        this._completeAuth(); // 로그아웃 상태일 때도 대기 해제
      }
    });

    SupabaseService.instance = this;
  }

  // 내부 사용: 인증 절차 완료를 알림
  _completeAuth() {
    this._authResolved = true;
    this._resolveAuth();
    console.log("🏁 [System] 인증 및 프로필 로드 완료");
  }

  // 외부 사용: 페이지 로드 시 인증이 끝날 때까지 대기
  async waitForAuth() {
    if (this._authResolved) return Promise.resolve();
    return this._authPromise;
  }

  async updateUserData(user) {
    this.currentUser = user;
    try {
      console.log("🔍 [System] 프로필 조회 중...");
      const { data, error } = await this.client
        .from("profiles") // admin.js와 일치하도록 profiles 테이블 사용
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        this.userData = data;
        console.log("👤 [User] 데이터 로드 성공:", data.nickname);
      } else {
        console.warn("⚠️ [User] 프로필이 없습니다. 기본값 사용.");
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
     인증 기능 (로그인, 가입, 로그아웃)
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
    
    // 회원가입 성공 시 profiles 테이블에 기본 정보 생성
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
      return { success: true, data };
    } catch (err) {
      console.error("❌ [Create] 에러:", err.message);
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
    // 실제 삭제 대신 deleted 플래그를 true로 변경 (Soft Delete)
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
     유틸리티 메서드
  ========================== */
  isLoggedIn() { return !!this.currentUser; }
  isAdmin() { return this.userData?.role === "admin"; }
  getCurrentUser() { 
    return { 
      user: this.currentUser, 
      data: this.userData,
      profile: this.userData // index.html 등 다른 코드와의 호환성 유지
    }; 
  }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
