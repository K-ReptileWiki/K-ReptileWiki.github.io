const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

class SupabaseService {
  constructor() {
    if (SupabaseService.instance) {
      return SupabaseService.instance;
    }
    
    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    this.currentUser = null;
    this.userData = null;
    
  this.client.auth.onAuthStateChange((event, session) => {
    console.log("🔑 인증 상태:", event);
    this.updateUserData(session?.user);
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
      .from("profiles")   // ✅ users → profiles
      .select("*")
      .eq("id", user.id)
      .single();
    
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
      await this.client.from("profiles").insert([newUser]); // ✅ users → profiles
      this.userData = newUser;
    }
  } catch (error) {
    console.error("❌ 사용자 데이터 로드 실패:", error);
  }
}


// 로그인 메서드
async signIn(email, password) {
  try {
    const { data, error } = await this.client.auth.signInWithPassword({ 
      email, 
      password 
    });
    
    if (error) throw error;

    // ✅ 로그인 성공 시 유저 데이터 갱신
    if (data.user) {
      await this.updateUserData(data.user);
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 회원가입 메서드
async signUp(email, password, nickname) {
  try {
    const { data, error } = await this.client.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: "https://k-reptilewiki.github.io/login.html" // 인증 후 돌아올 페이지
      }
    });
    
    // 이미 등록된 이메일일 경우 사용자 친화적인 메시지 반환
    if (error && error.message.includes("already registered")) {
      return { success: false, error: "이미 있는 이메일입니다. 로그인을 해주세요." };
    }
    
    if (error) throw error;
    
    if (data.user) {
      await this.client.from("profiles").insert({
        id: data.user.id,  // ✅ auth.uid()와 동일해야 RLS 통과
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
  async getPosts(limit = 50, includeDeleted = false) {
    try {
      let query = this.client
        .from("wiki_posts")
        .select("*")
        .order("time", { ascending: false })
        .limit(limit);
      
      // 삭제된 글 제외 (관리자가 아니면)
      if (!includeDeleted) {
        query = query.eq("deleted", false);
      }
      
      const { data, error } = await query;
      
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
          images,
          version: 1,
          deleted: false
        }])
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updatePost(id, title, content, images = []) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    try {
      const { data, error } = await this.client
        .from("wiki_posts")
        .update({
          title,
          content,
          images
        })
        .eq("id", id)
        .eq("uid", this.currentUser.id)
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
      // 소프트 삭제
      const { error } = await this.client
        .from("wiki_posts")
        .update({
          deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: this.currentUser.id
        })
        .eq("id", id)
        .eq("uid", this.currentUser.id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ✅ 버전 히스토리 관련 메서드
  async getPostVersions(postId) {
    try {
      const { data, error } = await this.client
        .from("wiki_post_versions")
        .select("*")
        .eq("post_id", postId)
        .order("version_number", { ascending: false });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPostVersion(postId, versionNumber) {
    try {
      const { data, error } = await this.client
        .from("wiki_post_versions")
        .select("*")
        .eq("post_id", postId)
        .eq("version_number", versionNumber)
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async restorePostVersion(postId, versionNumber) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    try {
      const { data, error } = await this.client.rpc('restore_post_version', {
        p_post_id: postId,
        p_version_number: versionNumber,
        p_user_id: this.currentUser.id
      });
      
      if (error) throw error;
      
      if (data?.success) {
        return { success: true, version: versionNumber };
      } else {
        return { success: false, error: data?.error || "복원 실패" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async compareVersions(postId, version1, version2) {
    try {
      const result1 = await this.getPostVersion(postId, version1);
      const result2 = await this.getPostVersion(postId, version2);
      
      if (!result1.success || !result2.success) {
        return { success: false, error: "버전을 찾을 수 없습니다" };
      }
      
      return {
        success: true,
        comparison: {
          version1: result1.data,
          version2: result2.data,
          titleChanged: result1.data.title !== result2.data.title,
          contentChanged: result1.data.content !== result2.data.content,
          imagesChanged: JSON.stringify(result1.data.images) !== JSON.stringify(result2.data.images)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 좋아요 관련 메서드
  async toggleLike(postId) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    try {
      const { data: existing } = await this.client
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", this.currentUser.id)
        .maybeSingle();

      if (existing) {
        return { success: false, error: "이미 좋아요를 누르셨습니다" };
      }

      const { error } = await this.client
        .from("post_likes")
        .insert([{ post_id: postId, user_id: this.currentUser.id }]);
      
      if (error) throw error;
      
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

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
