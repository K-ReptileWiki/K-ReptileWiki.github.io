// js/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

class SupabaseService {
  constructor() {
    if (SupabaseService.instance) return SupabaseService.instance;

    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    
    this.currentUser = null;
    this.userData = null;
    this._authResolved = false;
    this._authPromise = new Promise(res => { this._resolveAuth = res; });
    this._settingUser = false;
    this._initialCheckDone = false;

    this.init();
    SupabaseService.instance = this;
  }

  async init() {
    console.log("🔧 Supabase 초기화 시작");

    // ✅ 먼저 현재 세션 확인 (초기 로드 시 한 번만)
    try {
      const { data } = await this.client.auth.getSession();
      console.log("📦 초기 세션:", data?.session ? "있음" : "없음");
      
      if (data?.session?.user) {
        await this._setUser(data.session.user);
      } else {
        this._completeAuth();
      }
      
      this._initialCheckDone = true;
    } catch(e) {
      console.error("❌ 세션 확인 실패:", e);
      this._completeAuth();
      this._initialCheckDone = true;
    }

    // ✅ 인증 상태 변경 리스너 (초기 체크 후에만 동작)
    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log("🔔 Auth 이벤트:", event);
      
      // 초기 로드가 완료된 후에만 처리
      if (!this._initialCheckDone) return;

      if (event === 'SIGNED_IN' && session?.user) {
        await this._setUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.userData = null;
        this._completeAuth();
      }
    });
  }

  async _setUser(user) {
    if (this._settingUser) {
      console.log("⏸️ 이미 사용자 설정 중...");
      return;
    }
    
    this._settingUser = true;
    console.log("👤 사용자 설정 중:", user.email);

    try {
      this.currentUser = user;

      // 프로필 정보 가져오기
      let { data, error } = await this.client
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // 프로필이 없으면 생성
      if (error || !data) {
        console.log("📝 프로필 생성 중...");
        const nickname = user.email.split("@")[0];
        const insertResp = await this.client
          .from("profiles")
          .insert({ id: user.id, nickname, role: "user" })
          .select()
          .single();
        data = insertResp.data || { nickname, role: "user" };
      }

      this.userData = data;
      console.log("✅ 사용자 설정 완료:", this.userData.nickname);

    } catch(e) {
      console.error("❌ 프로필 로딩 에러:", e);
      this.userData = { 
        nickname: user.email.split("@")[0], 
        role: "user" 
      };
    } finally {
      this._settingUser = false;
      this._completeAuth();
    }
  }

  _completeAuth() {
    if (!this._authResolved) {
      this._authResolved = true;
      this._resolveAuth();
      console.log("✅ 인증 초기화 완료");
    }
  }

  async waitForAuth() {
    if (this._authResolved) return;
    console.log("⏳ 인증 대기 중...");
    return this._authPromise;
  }

  isLoggedIn() { return !!this.currentUser; }
  isAdmin() { return this.userData?.role === "admin"; }
  getCurrentUser() { 
    return { 
      user: this.currentUser, 
      profile: this.userData, 
      data: this.userData 
    }; 
  }

  // =========================
  // 인증
  // =========================
  async signUp(email, password, nickname) {
    try {
      const { data, error } = await this.client.auth.signUp({ 
        email, 
        password, 
        options: { data: { nickname } }
      });
      
      if (error) throw error;
      
      if (data.user) {
        // 프로필 생성
        await this.client
          .from("profiles")
          .insert({ 
            id: data.user.id, 
            nickname: nickname || email.split("@")[0], 
            role: "user" 
          });
      }
      
      return { success: true, data };
    } catch(error) {
      console.error("회원가입 실패:", error);
      return { success: false, error: error.message };
    }
  }

  async signIn(email, password) {
    try {
      console.log("🔐 로그인 시도:", email);
      
      const { data, error } = await this.client.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) throw error;
      
      console.log("✅ Supabase 인증 성공");
      
      // 사용자 정보 설정
      if (data.user) {
        await this._setUser(data.user);
      }
      
      return { success: true, data };
    } catch(error) {
      console.error("❌ 로그인 실패:", error);
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
      
      this.currentUser = null;
      this.userData = null;
      
      console.log("👋 로그아웃 완료");
      return { success: true };
    } catch(error) {
      console.error("로그아웃 실패:", error);
      return { success: false, error: error.message };
    }
  }

  // =========================
  // 게시글 CRUD
  // =========================
  async createPost(title, content, imageUrls=[]) {
    if (!this.isLoggedIn()) return { success:false, error:"로그인 필요" };
    const cleanUrls = imageUrls.map(u => typeof u==="string"? u.replace(/^["']|["']$/g,"").trim() : u).filter(Boolean);
    const { data, error } = await this.client.from("wiki_posts").insert({
      title, content, images: cleanUrls, uid:this.currentUser.id,
      author:this.userData.nickname, deleted:false, time:new Date().toISOString()
    }).select("id");
    if (error) return { success:false, error:error.message };
    return { success:true, data:data[0] };
  }

  async getPosts(includeDeleted=false) {
    let query = this.client.from("wiki_posts").select("*").order("time",{ascending:false});
    if (!includeDeleted) query = query.eq("deleted", false);
    const { data, error } = await query;
    if (error) return { success:false, error:error.message, data:[] };
    return { success:true, data:data||[] };
  }

  async getPost(postId) {
    const { data, error } = await this.client.from("wiki_posts").select("*").eq("id", postId).single();
    if (error) return { success:false, error:error.message };
    return { success:true, data };
  }

  async updatePost(id, title, content, imageUrls=[]) {
    const cleanUrls = imageUrls.map(u=>typeof u==="string"? u.replace(/^["']|["']$/g,"").trim():"").filter(Boolean);
    const { data, error } = await this.client.from("wiki_posts").update({ title, content, images:cleanUrls, updated_at:new Date().toISOString() }).eq("id",id).select().single();
    if (error) return { success:false, error:error.message };
    return { success:true, data };
  }

  async deletePost(id) {
    const { data, error } = await this.client.from("wiki_posts").update({ deleted:true, deleted_at:new Date().toISOString() }).eq("id",id).select().single();
    if (error) return { success:false, error:error.message };
    return { success:true, data };
  }

  async restorePost(id) {
    const { data, error } = await this.client.from("wiki_posts").update({ deleted:false, deleted_at:null }).eq("id",id).select().single();
    if (error) return { success:false, error:error.message };
    return { success:true, data };
  }

  // =========================
  // 댓글 CRUD
  // =========================
  async addComment(postId, content) {
    if (!this.isLoggedIn()) return { success:false, error:"로그인 필요" };
    const { data, error } = await this.client.from("wiki_comments").insert({
      post_id: postId, content, uid:this.currentUser.id,
      author:this.userData.nickname, time:new Date().toISOString()
    }).select().single();
    if (error) return { success:false, error:error.message };
    return { success:true, data };
  }

  async getComments(postId) {
    const { data, error } = await this.client.from("wiki_comments").select("*").eq("post_id", postId).order("time",{ascending:false});
    if (error) return { success:false, error:error.message, data:[] };
    return { success:true, data:data||[] };
  }

  async updateComment(id, content) {
    const { data, error } = await this.client.from("wiki_comments").update({ content, updated_at:new Date().toISOString() }).eq("id",id).select().single();
    if (error) return { success:false, error:error.message };
    return { success:true, data };
  }

  async deleteComment(id) {
    const { error } = await this.client.from("wiki_comments").delete().eq("id",id);
    if (error) return { success:false, error:error.message };
    return { success:true };
  }

  // =========================
  // 좋아요
  // =========================
  async toggleLike(postId) {
    if (!this.isLoggedIn()) return { success:false, error:"로그인 필요" };
    const { data } = await this.client.from("wiki_likes").select("*").eq("post_id",postId).eq("uid",this.currentUser.id).maybeSingle();
    if (data) { await this.client.from("wiki_likes").delete().eq("id",data.id); return { success:true, liked:false }; }
    await this.client.from("wiki_likes").insert({ post_id:postId, uid:this.currentUser.id });
    return { success:true, liked:true };
  }

  async getLikeCount(postId) {
    const { data, error } = await this.client.from("wiki_likes").select("*",{count:'exact'}).eq("post_id",postId);
    if (error) return 0;
    return data?.length || 0;
  }

  // =========================
  // 버전 관리
  // =========================
  async getPostVersions(postId) {
    const { data, error } = await this.client.from("wiki_versions").select("*").eq("post_id",postId).order("version_number",{ascending:false});
    if (error) return { success:false, error:error.message, data:[] };
    return { success:true, data:data||[] };
  }

  async getPostVersion(postId, versionNumber) {
    const { data, error } = await this.client.from("wiki_versions").select("*").eq("post_id",postId).eq("version_number",versionNumber).single();
    if (error) return { success:false, error:error.message };
    return { success:true, data };
  }

  async restorePostVersion(postId, versionNumber) {
    const versionResult = await this.getPostVersion(postId, versionNumber);
    if (!versionResult.success) return { success:false, error:"복원할 버전을 찾을 수 없습니다" };
    const version = versionResult.data;
    const { data, error } = await this.client.from("wiki_posts").update({
      title:version.title, content:version.content, images:version.images, updated_at:new Date().toISOString()
    }).eq("id",postId).select().single();
    if (error) return { success:false, error:error.message };
    return { success:true, data };
  }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
