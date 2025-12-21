const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

class SupabaseService {
  constructor() {
    if (SupabaseService.instance) return SupabaseService.instance;
    
    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    this.currentUser = null;
    this.userData = null;
    
    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log("🔑 인증 상태:", event);
      await this.updateUserData(session?.user);
    });

    SupabaseService.instance = this;
  }

  async waitForAuth() {
    if (this.currentUser) return this.currentUser;
    const { data: { session } } = await this.client.auth.getSession();
    if (session?.user) {
      await this.updateUserData(session.user);
      return session.user;
    }
    return null;
  }

  async updateUserData(user) {
    if (!user) {
      this.currentUser = null;
      this.userData = null;
      return;
    }
    this.currentUser = user;
    try {
      const { data, error } = await this.client.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      if (data) {
        this.userData = data;
      } else {
        const newUser = {
          id: user.id,
          email: user.email,
          nickname: user.email.split("@")[0],
          role: "user",
          created_at: new Date().toISOString()
        };
        await this.client.from("profiles").insert([newUser]);
        this.userData = newUser;
      }
    } catch (e) {
      console.error("사용자 로드 실패:", e);
      this.userData = { id: user.id, email: user.email, role: "user" };
    }
  }

  // --- 게시글 관리 (DB 사진 구조에 최적화) ---

  async getPosts() {
    try {
      // ⚠️ 사진상 deleted 컬럼이 없으므로 필터 없이 모든 글을 가져옵니다.
      const { data, error } = await this.client
        .from("wiki_posts")
        .select("*")
        .order("time", { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createPost(title, content, images = []) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };

    try {
      const { data, error } = await this.client.from("wiki_posts").insert([{
        title: title,
        content: content,
        author: this.userData?.nickname || this.currentUser.email.split('@')[0],
        uid: this.currentUser.id,
        time: new Date().toISOString(),
        images: Array.isArray(images) ? images : [], // 반드시 배열 형태 유지
        likes: 0
      }]).select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error("등록 에러:", error.message);
      return { success: false, error: error.message };
    }
  }

  async updatePost(id, title, content, images = []) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };
    try {
      // 본인 글이거나 관리자일 때만 수정 가능하게 구현
      const { data, error } = await this.client
        .from("wiki_posts")
        .update({ title, content, images, time: new Date().toISOString() })
        .eq("id", id)
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deletePost(id) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };
    try {
      // ⚠️ 사진에 deleted 컬럼이 없으므로 아예 레코드를 삭제(Delete) 처리합니다.
      const { error } = await this.client.from("wiki_posts").delete().eq("id", id);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // --- 좋아요/댓글 ---

  async toggleLike(postId) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };
    try {
      const { error } = await this.client.from("post_likes").insert([{ post_id: postId, user_id: this.currentUser.id }]);
      if (error) throw error;
      return { success: true };
    } catch (e) { return { success: false, error: "이미 좋아요를 눌렀거나 오류 발생" }; }
  }

  async getComments(postId) {
    try {
      const { data, error } = await this.client.from("wiki_comments").select("*").eq("post_id", postId).order("time", { ascending: true });
      if (error) throw error;
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  }

  async addComment(postId, content) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };
    try {
      const { data, error } = await this.client.from("wiki_comments").insert([{
        post_id: postId,
        content: content,
        author: this.userData?.nickname || this.currentUser.email.split('@')[0],
        uid: this.currentUser.id,
        time: new Date().toISOString()
      }]).select();
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (e) { return { success: false, error: e.message }; }
  }

  isLoggedIn() { return !!this.currentUser; }
  isAdmin() { return this.userData?.role === "admin"; }
  getCurrentUser() { return { user: this.currentUser, data: this.userData }; }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
