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

    this._authPromise = new Promise((resolve) => {
      this._resolveAuth = resolve;
    });

    console.log("🚀 [System] Supabase 서비스 초기화 중...");

    this.client.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        this.updateUserData(session.user);
      } else {
        this._completeAuth();
      }
    });

    this.client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await this.updateUserData(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.userData = null;
        this._completeAuth();
      }
    });

    SupabaseService.instance = this;
  }

  _completeAuth() {
    if (this._authResolved) return;
    this._authResolved = true;
    if (this._resolveAuth) this._resolveAuth();
    console.log("✅ [System] 인증 완료");
  }

  async waitForAuth() {
    if (this._authResolved) return Promise.resolve();
    return this._authPromise;
  }

  async updateUserData(user) {
    this.currentUser = user;
    
    // 기본 데이터로 먼저 설정하고 즉시 완료 처리
    this.userData = { 
      id: user.id, 
      nickname: user.email.split("@")[0], 
      role: "user" 
    };
    
    this._completeAuth();
    
    // 프로필 조회는 백그라운드에서 시도
    this.loadProfileInBackground(user.id);
  }

  async loadProfileInBackground(userId) {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('타임아웃')), 3000)
      );
      
      const queryPromise = this.client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.warn("⚠️ [Profile] 조회 실패:", error.message);
        return;
      }
      
      if (data) {
        this.userData = data;
        console.log("👤 [Profile] 업데이트 완료:", data.nickname);
      }
      
    } catch (err) {
      console.warn("⚠️ [Profile] 조회 생략:", err.message);
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
    console.log("📥 createPost images:", images, Array.isArray(images));

    const { data, error } = await this.client
      .from("wiki_posts")
      .insert({
        title,
        content,
        image: images, // ✅ 여기
        uid: this.currentUser.id,
        author: this.userData?.nickname || this.currentUser.email,
        time: new Date().toISOString(),
        deleted: false
      })
      .select()
      .single();

    if (error) throw error;

    console.log("✅ [Post] 등록 성공:", data.id);
    return { success: true, data };

  } catch (err) {
    console.error("❌ [Post] 등록 실패:", err);
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
    const { error } = await this.client
      .from("wiki_posts")
      .update({ deleted: true })
      .eq("id", id);
    return error ? { success: false, error: error.message } : { success: true };
  }

  /* =========================
     댓글 기능 (wiki_comments)
  ========================== */
  async addComment(postId, content) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    try {
      const { data, error } = await this.client
        .from("wiki_comments")
        .insert({
          post_id: postId, 
          content,
          uid: this.currentUser.id,
          author: this.userData?.nickname || this.currentUser.email,
          time: new Date().toISOString()
        })
        .select()
        .single();
      
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
     기여 (wiki_contributions)
  ========================== */
  async addContribution(postId, content, summary) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    const { error } = await this.client
      .from("wiki_contributions")
      .insert({
        post_id: postId, 
        uid: this.currentUser.id,
        author: this.userData?.nickname || this.currentUser.email,
        content, 
        summary, 
        time: new Date().toISOString()
      });
    return error ? { success: false, error: error.message } : { success: true };
  }

  /* =========================
     유틸리티
  ========================== */
  isLoggedIn() { 
    return !!this.currentUser; 
  }
  
  isAdmin() { 
    return this.userData?.role === "admin"; 
  }
  
  getCurrentUser() {
    return { 
      user: this.currentUser, 
      data: this.userData, 
      profile: this.userData 
    };
  }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;