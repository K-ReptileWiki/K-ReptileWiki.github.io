import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   Supabase Config
========================== */
const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"};

/* =========================
   Supabase Service
========================== */
class SupabaseService {
  constructor() {
    if (SupabaseService.instance) return SupabaseService.instance;

    this.client = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.key
    );

    this.currentUser = null;
    this.userData = null;

    this._authResolved = false;
    this._authPromise = new Promise(res => {
      this._resolveAuth = res;
    });

    this.init();
    SupabaseService.instance = this;
  }

  /* =========================
     Auth Init
  ========================== */
  async init() {
    const { data } = await this.client.auth.getSession();

    if (data?.session?.user) {
      await this._setUser(data.session.user);
    } else {
      this._completeAuth();
    }

    this.client.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        await this._setUser(session.user);
      }

      if (event === "SIGNED_OUT") {
        this.currentUser = null;
        this.userData = null;
      }
    });
  }

  _completeAuth() {
    if (this._authResolved) return;
    this._authResolved = true;
    this._resolveAuth();
  }

  async waitForAuth() {
    if (this._authResolved) return;
    return this._authPromise;
  }

  /* =========================
     User / Profile
  ========================== */
  async _setUser(user) {
    this.currentUser = user;

    const { data } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    this.userData = data || {
      id: user.id,
      nickname: user.email.split("@")[0],
      role: "user"
    };

    this._completeAuth();
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  isAdmin() {
    return this.userData?.role === "admin";
  }

  getCurrentUser() {
    return {
      user: this.currentUser,
      profile: this.userData
    };
  }

  /* =========================
     Auth APIs
  ========================== */
  async signUp(email, password, nickname) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password
    });

    if (error) return { success: false, error: error.message };

    await this.client.from("profiles").insert({
      id: data.user.id,
      nickname: nickname || email.split("@")[0],
      role: "user"
    });

    return { success: true, data };
  }

  async signIn(email, password) {
    const { data, error } =
      await this.client.auth.signInWithPassword({ email, password });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async signOut() {
    await this.client.auth.signOut();
    this.currentUser = null;
    this.userData = null;
  }

  /* =========================
     Posts
  ========================== */
  async createPost(title, content, imageUrls = []) {
    if (!this.isLoggedIn()) {
      return { success: false, error: "로그인 필요" };
    }

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
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async updatePost(id, title, content, imageUrls = []) {
    const cleanUrls = imageUrls
      .map(u => typeof u === "string" ? u.replace(/^["']|["']$/g, "").trim() : u)
      .filter(Boolean);

    const { data, error } = await this.client
      .from("wiki_posts")
      .update({
        title,
        content,
        images: cleanUrls,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async getPosts(includeDeleted = false) {
    let q = this.client
      .from("wiki_posts")
      .select("*")
      .order("time", { ascending: false });

    if (!includeDeleted) q = q.eq("deleted", false);

    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async deletePost(id) {
    await this.client
      .from("wiki_posts")
      .update({ deleted: true })
      .eq("id", id);
  }

  async restorePost(id) {
    await this.client
      .from("wiki_posts")
      .update({ deleted: false })
      .eq("id", id);
  }

  /* =========================
     Comments
  ========================== */
  async addComment(postId, content) {
    const { data, error } = await this.client
      .from("wiki_comments")
      .insert({
        post_id: postId,
        content,
        uid: this.currentUser.id,
        author: this.userData.nickname,
        time: new Date().toISOString()
      })
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

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async updateComment(id, content) {
    const { data, error } = await this.client
      .from("wiki_comments")
      .update({
        content,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async deleteComment(id) {
    await this.client
      .from("wiki_comments")
      .delete()
      .eq("id", id);
  }

  /* =========================
     Likes
  ========================== */
  async toggleLike(postId) {
    const { data } = await this.client
      .from("wiki_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("uid", this.currentUser.id)
      .maybeSingle();

    if (data) {
      await this.client.from("wiki_likes").delete().eq("id", data.id);
      return { liked: false };
    }

    await this.client.from("wiki_likes").insert({
      post_id: postId,
      uid: this.currentUser.id
    });

    return { liked: true };
  }
}

/* =========================
   Export
========================== */
export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
