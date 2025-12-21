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
    
    // 인증 상태 변화 감지
    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log("🔑 인증 상태 이벤트:", event);
      await this.updateUserData(session?.user);
    });

    SupabaseService.instance = this;
  }

  /**
   * ✅ 핵심 추가: 인증 정보가 복구될 때까지 기다리는 메서드
   * 페이지 로드 직후 호출하여 세션을 안정적으로 가져옵니다.
   */
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
    // 1. .single() 대신 .maybeSingle()을 사용하여 데이터가 없어도 에러를 내지 않게 합니다.
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle(); 
    
    if (error) throw error;

    if (data) {
      // 2. 기존 데이터가 있으면 적용
      this.userData = data;
    } else {
      // 3. 데이터가 없으면 새로 생성 후 적용
      const newUser = {
        id: user.id,
        email: user.email,
        nickname: user.email.split("@")[0],
        role: "user",
        created_at: new Date().toISOString()
      };
      
      const { error: insertError } = await this.client.from("profiles").insert([newUser]);
      if (insertError) throw insertError;
      
      this.userData = newUser;
    }
  } catch (error) {
    console.error("❌ 사용자 데이터 로드 실패:", error);
    
    // 4. [핵심] DB 로드에 실패하더라도 화면이 멈추지 않도록 기본값 강제 할당
    this.userData = {
      id: user.id,
      email: user.email,
      nickname: user.email.split("@")[0],
      role: "user"
    };
  }
}

  // --- 로그인/회원가입 섹션 ---

  async signIn(email, password) {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await this.updateUserData(data.user);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signUp(email, password, nickname) {
    try {
      const { data, error } = await this.client.auth.signUp({ 
        email, 
        password,
        options: { emailRedirectTo: "https://k-reptilewiki.github.io/login.html" }
      });
      if (error && error.message.includes("already registered")) {
        return { success: false, error: "이미 있는 이메일입니다. 로그인을 해주세요." };
      }
      if (error) throw error;
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
      this.currentUser = null;
      this.userData = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // --- 게시글 관리 섹션 ---

  async getPosts(limit = 50, includeDeleted = false) {
    try {
      let query = this.client.from("wiki_posts").select("*").order("time", { ascending: false }).limit(limit);
      if (!includeDeleted) query = query.eq("deleted", false);
      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPost(id) {
    try {
      const { data, error } = await this.client.from("wiki_posts").select("*").eq("id", id).single();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

async createPost(title, content, images = []) {
  await this.waitForAuth(); // 세션 확인
  if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };

  try {
    const { data, error } = await this.client.from("wiki_posts").insert([{
      // id는 DB가 자동으로 생성하므로 제외합니다.
      title: title, 
      content: content,
      // 사진 속 nickname 컬럼이 비어있을 수 있으니 이메일을 백업으로 사용합니다.
      author: this.userData?.nickname || this.currentUser.email.split('@')[0],
      uid: this.currentUser.id,
      time: new Date().toISOString(),
      images: images, // 반드시 배열 형태여야 함
      version: 1,
      deleted: false,
      likes: 0 // 사진 속 기본값이 0이므로 명시해줍니다.
    }]).select();

    if (error) throw error;
    return { success: true, data: data[0] };
  } catch (error) {
    console.error("Post Creation Error:", error.message);
    return { success: false, error: error.message };
  }
}

  async updatePost(id, title, content, images = []) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };
    try {
      const { data, error } = await this.client.from("wiki_posts").update({ title, content, images })
        .eq("id", id).eq("uid", this.currentUser.id).select();
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
      const { error } = await this.client.from("wiki_posts").update({
        deleted: true, deleted_at: new Date().toISOString(), deleted_by: this.currentUser.id
      }).eq("id", id).eq("uid", this.currentUser.id);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // --- 버전 히스토리 섹션 ---

  async getPostVersions(postId) {
    try {
      const { data, error } = await this.client.from("wiki_post_versions").select("*").eq("post_id", postId).order("version_number", { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPostVersion(postId, versionNumber) {
    try {
      const { data, error } = await this.client.from("wiki_post_versions").select("*").eq("post_id", postId).eq("version_number", versionNumber).single();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async restorePostVersion(postId, versionNumber) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };
    try {
      const { data, error } = await this.client.rpc('restore_post_version', {
        p_post_id: postId, p_version_number: versionNumber, p_user_id: this.currentUser.id
      });
      if (error) throw error;
      return data?.success ? { success: true, version: versionNumber } : { success: false, error: data?.error || "복원 실패" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async compareVersions(postId, version1, version2) {
    try {
      const r1 = await this.getPostVersion(postId, version1);
      const r2 = await this.getPostVersion(postId, version2);
      if (!r1.success || !r2.success) return { success: false, error: "버전을 찾을 수 없습니다" };
      return {
        success: true,
        comparison: {
          version1: r1.data, version2: r2.data,
          titleChanged: r1.data.title !== r2.data.title,
          contentChanged: r1.data.content !== r2.data.content,
          imagesChanged: JSON.stringify(r1.data.images) !== JSON.stringify(r2.data.images)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // --- 좋아요/댓글 섹션 ---

  async toggleLike(postId) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };
    try {
      const { data: existing } = await this.client.from("post_likes").select("id").eq("post_id", postId).eq("user_id", this.currentUser.id).maybeSingle();
      if (existing) return { success: false, error: "이미 좋아요를 누르셨습니다" };
      const { error } = await this.client.from("post_likes").insert([{ post_id: postId, user_id: this.currentUser.id }]);
      if (error) throw error;
      const count = await this.getLikeCount(postId);
      return { success: true, count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLikeCount(postId) {
    try {
      const { count, error } = await this.client.from("post_likes").select("*", { count: "exact", head: true }).eq("post_id", postId);
      if (error) throw error;
      return count || 0;
    } catch (error) {
      return 0;
    }
  }

  async getComments(postId) {
    try {
      const { data, error } = await this.client.from("wiki_comments").select("*").eq("post_id", postId).order("time", { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addComment(postId, content) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인이 필요합니다" };
    try {
      const { data, error } = await this.client.from("wiki_comments").insert([{
        post_id: postId, content,
        author: this.userData?.nickname || this.currentUser.email,
        uid: this.currentUser.id,
        time: new Date().toISOString()
      }]).select();
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // --- 유틸리티 섹션 ---

  isLoggedIn() { return !!this.currentUser; }
  isAdmin() { return this.userData?.role === "admin"; }
  getCurrentUser() { return { user: this.currentUser, data: this.userData }; }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
