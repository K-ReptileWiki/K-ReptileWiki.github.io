const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: import.meta.env.VITE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ✅ 싱글톤 패턴으로 한 번만 초기화
class SupabaseService {
  constructor() {
    if (SupabaseService.instance) {
      return SupabaseService.instance;
    }
    
    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    this.currentUser = null;
    this.userData = null;
    
    // 인증 상태 자동 감지
    this.client.auth.onAuthStateChanged(async (event, session) => {
      console.log("🔑 인증 상태:", event);
      await this.updateUserData(session?.user);
    });
    
    SupabaseService.instance = this;
  }

  async updateUserData(user) {
    if (!user) {
      this.currentUser = null;
      this.userData = null;
      return;
    }

    this.currentUser = user;
    
    try {
      const { data } = await this.client
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (data) {
        this.userData = data;
      } else {
        // 신규 사용자 자동 생성
        const newUser = {
          id: user.id,
          email: user.email,
          nickname: user.email.split("@")[0],
          role: "user",
          created_at: new Date().toISOString()
        };
        await this.client.from("users").insert([newUser]);
        this.userData = newUser;
      }
    } catch (error) {
      console.error("❌ 사용자 데이터 로드 실패:", error);
    }
  }

  // 인증 관련 메서드
  async signIn(email, password) {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signUp(email, password, nickname) {
    try {
      const { data, error } = await this.client.auth.signUp({ 
        email, 
        password 
      });
      
      if (error) throw error;
      
      // 프로필 생성
      if (data.user) {
        await this.client.from("profiles").insert({
          id: data.user.id,
          email,
          nickname: nickname || email.split("@")[0],
          role: "user",
          created_at: new Date().toISOString()
        });
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 게시글 관련 메서드
  async getPosts(limit = 50) {
    try {
      const { data, error } = await this.client
        .from("wiki_posts")
        .select("*")
        .order("time", { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPost(id) {
    try {
      const { data, error } = await this.client
        .from("wiki_posts")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createPost(title, content, images = []) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    try {
      const { data, error } = await this.client
        .from("wiki_posts")
        .insert([{
          id: crypto.randomUUID(),
          title,
          content,
          author: this.userData?.nickname || this.currentUser.email,
          uid: this.currentUser.id,
          time: new Date().toISOString(),
          images
        }])
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deletePost(id) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    try {
      const { error } = await this.client
        .from("wiki_posts")
        .delete()
        .eq("id", id)
        .eq("uid", this.currentUser.id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 좋아요 관련 메서드 (통합)
  async toggleLike(postId) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    try {
      // 기존 좋아요 확인
      const { data: existing } = await this.client
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", this.currentUser.id)
        .maybeSingle();

      if (existing) {
        return { success: false, error: "이미 좋아요를 누르셨습니다" };
      }

      // 좋아요 추가
      const { error } = await this.client
        .from("post_likes")
        .insert([{ post_id: postId, user_id: this.currentUser.id }]);
      
      if (error) throw error;
      
      // 카운트 조회
      const count = await this.getLikeCount(postId);
      return { success: true, count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLikeCount(postId) {
    try {
      const { count, error } = await this.client
        .from("post_likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);
      
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error("좋아요 수 조회 실패:", error);
      return 0;
    }
  }

  // 댓글 관련 메서드
  async getComments(postId) {
    try {
      const { data, error } = await this.client
        .from("wiki_comments")
        .select("*")
        .eq("post_id", postId)
        .order("time", { ascending: false });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addComment(postId, content) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    try {
      const { data, error } = await this.client
        .from("wiki_comments")
        .insert([{
          post_id: postId,
          content,
          author: this.userData?.nickname || this.currentUser.email,
          uid: this.currentUser.id,
          time: new Date().toISOString()
        }])
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 유틸리티 메서드
  isLoggedIn() {
    return !!this.currentUser;
  }

  isAdmin() {
    return this.userData?.role === "admin";
  }

  getCurrentUser() {
    return {
      user: this.currentUser,
      data: this.userData
    };
  }
}

// ✅ 싱글톤 인스턴스 export
export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
