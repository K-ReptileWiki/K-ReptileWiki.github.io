// js/supabase.js
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
    this._authPromise = new Promise(res => { this._resolveAuth = res; });
    this._settingUser = false;

    this.init();
    SupabaseService.instance = this;
  }

  async init() {
    // auth 상태 변화 리스너
    this.client.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) await this._setUser(session.user);
      else { this.currentUser = null; this.userData = null; this._completeAuth(); }
    });

    // 새로고침 시 현재 세션 확인
    try {
      const { data } = await this.client.auth.getSession();
      if (data?.session?.user) await this._setUser(data.session.user);
      else this._completeAuth();
    } catch(e) { console.error("세션 확인 실패:", e); this._completeAuth(); }
  }

  async _setUser(user) {
    if (this._settingUser) return;
    this._settingUser = true;
    try {
      this.currentUser = user;

      let { data, error } = await this.client.from("profiles").select("*").eq("id", user.id).single();

      if (error || !data) {
        const nickname = user.email.split("@")[0];
        const insertResp = await this.client.from("profiles")
          .insert({ id: user.id, nickname, role: "user" })
          .select()
          .single();
        data = insertResp.data || { nickname, role: "user" };
      }

      this.userData = data;
    } catch(e) {
      console.error("프로필 로딩 에러:", e);
      this.userData = { nickname: user.email.split("@")[0], role: "user" };
    } finally {
      this._settingUser = false;
      this._completeAuth();
    }
  }

  _completeAuth() { if (!this._authResolved) { this._authResolved = true; this._resolveAuth(); } }
  async waitForAuth() { if (this._authResolved) return; return this._authPromise; }

  isLoggedIn() { return !!this.currentUser; }
  isAdmin() { return this.userData?.role === "admin"; }
  getCurrentUser() { return { user: this.currentUser, profile: this.userData, data: this.userData }; }

  // =========================
  // 인증
  // =========================
  async signUp(email, password, nickname) {
    const { data, error } = await this.client.auth.signUp({ email, password, options:{ data:{ nickname } }});
    if (error) return { success:false, error:error.message };
    if (data.user) await this.client.from("profiles").insert({ id:data.user.id, nickname:nickname||email.split("@")[0], role:"user" });
    return { success:true, data };
  }

  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) return { success:false, error:error.message };
    if (data.user) await this._setUser(data.user);
    return { success:true, data };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) return { success:false, error:error.message };
    this.currentUser = null;
    this.userData = null;
    return { success:true };
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
