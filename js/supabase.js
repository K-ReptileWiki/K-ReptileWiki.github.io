import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   Supabase Config
========================== */
const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

/* =========================
   Supabase Service
========================== */
class SupabaseService {
  constructor() {
    if (SupabaseService.instance) return SupabaseService.instance;

    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    this.currentUser = null;
    this.userData = null;
    this._authResolved = false;
    this._authPromise = new Promise(res => { this._resolveAuth = res; });

    this.init();
    SupabaseService.instance = this;
  }

  /* =========================
     인증 초기화
  =========================== */
  async init() {
    let resolved = false;

    const finish = () => {
      if (!resolved) {
        resolved = true;
        this._completeAuth();
      }
    };

    // 1️⃣ auth 상태 변화 리스너
    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log("🔐 auth event:", event);

      try {
        if (session?.user) {
          await this._setUser(session.user);
        } else {
          this.currentUser = null;
          this.userData = null;
        }
      } catch (e) {
        console.error("auth 처리 실패:", e);
      } finally {
        finish();
      }
    });

    // 2️⃣ 새로고침 시 현재 세션 확인
    try {
      const { data, error } = await this.client.auth.getSession();

      if (error) {
        console.warn("세션 오류:", error.message);
        await this.client.auth.signOut();
        finish();
        return;
      }

      if (data?.session?.user) {
        await this._setUser(data.session.user);
      }

      finish();
    } catch (e) {
      console.error("세션 확인 실패:", e);
      finish();
    }
  }

  /* =========================
     사용자 정보 설정 (_setUser)
  =========================== */
  async _setUser(user) {
    this.currentUser = user;

    try {
      const { data, error } = await this.client
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        console.warn("프로필 정보 로딩 실패:", error?.message);
        this.userData = { nickname: user.email.split("@")[0], role: "user" };
      } else {
        this.userData = data;
      }
    } catch (e) {
      console.error("프로필 정보 로딩 에러:", e);
      this.userData = { nickname: user.email.split("@")[0], role: "user" };
    }
  }

  /* =========================
     Auth 완료 처리
  =========================== */
  _completeAuth() {
    if (this._authResolved) return;
    this._authResolved = true;
    this._resolveAuth();
  }

  /* =========================
     Auth 대기
  =========================== */
  async waitForAuth() {
    if (this._authResolved) return;
    return this._authPromise;
  }

  /* =========================
     상태 확인
  =========================== */
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

  /* =========================
     인증 API
  =========================== */
  async signUp(email, password, nickname) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { nickname: nickname || email.split("@")[0] } }
    });

    if (error) return { success: false, error: error.message };

    if (data.user) {
      await this.client.from("profiles").insert({
        id: data.user.id,
        nickname: nickname || email.split("@")[0],
        role: "user"
      });
    }

    return { success: true, data };
  }

  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) return { success: false, error: error.message };

    if (data.user) {
      await this._setUser(data.user);
    }

    return { success: true, data };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) return { success: false, error: error.message };

    this.currentUser = null;
    this.userData = null;
    return { success: true };
  }

  /* =========================
     게시글 CRUD
  =========================== */
  async createPost(title, content, imageUrls = []) {
    if (!this.isLoggedIn()) return { success: false, error: "로그인 필요" };

    const cleanUrls = imageUrls
      .map(u => typeof u === "string" ? u.replace(/^["']|["']$/g, "").trim() : u)
      .filter(Boolean);

    const { data, error } = await this.client
      .from("wiki_posts")
      .insert({
        title,
        content,
        images: cleanUrls,
        uid: this.currentUser.id,
        author: this.userData.nickname,
        deleted: false,
        time: new Date().toISOString()
      })
      .select("id");

    if (error) return { success: false, error: error.message };
    return { success: true, data: data[0] };
  }

  async getPosts(includeDeleted = false) {
    let query = this.client.from("wiki_posts").select("*").order("time", { ascending: false });
    if (!includeDeleted) query = query.eq("deleted", false);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  }

  async getPost(postId) {
    const { data, error } = await this.client.from("wiki_posts").select("*").eq("id", postId).single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async updatePost(id, title, content, imageUrls = []) {
    const cleanUrls = imageUrls
      .map(u => typeof u === "string" ? u.replace(/^["']|["']$/g, "").trim() : u)
      .filter(Boolean);

    const { data, error } = await this.client
      .from("wiki_posts")
      .update({ title, content, images: cleanUrls, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async deletePost(postId) {
    const { data, error } = await this.client
      .from("wiki_posts")
      .update({ deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", postId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async restorePost(postId) {
    const { data, error } = await this.client
      .from("wiki_posts")
      .update({ deleted: false, deleted_at: null })
      .eq("id", postId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  /* =========================
     댓글
  =========================== */
  async addComment(postId, content) {
    if (!this.isLoggedIn()) return { success: false, error: "로그인 필요" };

    const { data, error } = await this.client
      .from("wiki_comments")
      .insert({ post_id: postId, content, uid: this.currentUser.id, author: this.userData.nickname, time: new Date().toISOString() })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async getComments(postId) {
    const { data, error } = await this.client
      .from("wiki_comments")
      .select("*")
      .eq("post_id", postId)
      .order("time", { ascending: false });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  }

  async updateComment(id, content) {
    const { data, error } = await this.client
      .from("wiki_comments")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async deleteComment(id) {
    const { error } = await this.client.from("wiki_comments").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /* =========================
     좋아요
  =========================== */
  async toggleLike(postId) {
    if (!this.isLoggedIn()) return { success: false, error: "로그인 필요" };

    const { data } = await this.client
      .from("wiki_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("uid", this.currentUser.id)
      .maybeSingle();

    if (data) {
      await this.client.from("wiki_likes").delete().eq("id", data.id);
      return { success: true, liked: false };
    }

    await this.client.from("wiki_likes").insert({ post_id: postId, uid: this.currentUser.id });
    return { success: true, liked: true };
  }

  async getLikeCount(postId) {
    const { data, error } = await this.client
      .from("wiki_likes")
      .select("*", { count: 'exact', head: false })
      .eq("post_id", postId);

    if (error) return 0;
    return data?.length || 0;
  }
}

/* =========================
   Export
========================== */
export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
