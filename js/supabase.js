import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   Supabase Config
========================== */
const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

/* =========================
   Debug Logger
========================== */
class DebugLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 40;
    this.createUI();
  }

  createUI() {
    const box = document.createElement("div");
    box.style.cssText = `
      position:fixed; bottom:10px; right:10px;
      width:420px; max-height:380px;
      background:#000; color:#0f0;
      border:2px solid #0f0;
      z-index:99999; font-family:monospace;
      font-size:11px;
    `;

    box.innerHTML = `
      <div style="background:#0f0;color:#000;padding:6px;font-weight:bold">
        Debug Log
        <button id="dbgClear" style="float:right">Clear</button>
      </div>
      <div id="dbgBody" style="padding:6px;overflow:auto;max-height:340px"></div>
    `;

    document.body.appendChild(box);
    document.getElementById("dbgClear").onclick = () => {
      this.logs = [];
      this.render();
    };
  }

  log(msg) {
    const t = new Date().toLocaleTimeString();
    this.logs.push(`[${t}] ${msg}`);
    if (this.logs.length > this.maxLogs) this.logs.shift();
    console.log(msg);
    this.render();
  }

  render() {
    const body = document.getElementById("dbgBody");
    if (!body) return;
    body.innerHTML = this.logs.map(l => `<div>${l}</div>`).join("");
    body.scrollTop = body.scrollHeight;
  }
}

const debugLog = new DebugLogger();

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
     인증 초기화
  ========================== */
  async init() {
    debugLog.log("🚀 Supabase 초기화");

    try {
      const { data, error } = await this.client.auth.getSession();
      
      if (error) {
        debugLog.log("⚠️ 세션 오류 발생, 로컬 스토리지 클리어");
        await this.client.auth.signOut();
        this._completeAuth();
        return;
      }
      
      if (data?.session?.user) {
        await this._setUser(data.session.user);
      } else {
        this._completeAuth();
      }
    } catch (e) {
      debugLog.log(`❌ 세션 확인 실패: ${e.message}`);
      await this.client.auth.signOut();
      this._completeAuth();
    }

    this.client.auth.onAuthStateChange(async (event, session) => {
      debugLog.log(`🔑 Auth 이벤트: ${event}`);
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
    debugLog.log("✅ 인증 완료");
  }

  async waitForAuth() {
    if (this._authResolved) return;
    return this._authPromise;
  }

  async _setUser(user) {
    debugLog.log(`👤 로그인: ${user.email}`);
    this.currentUser = user;

    this.userData = {
      id: user.id,
      nickname: user.email.split("@")[0],
      role: "user"
    };

    this._completeAuth();
    this._loadProfile(user.id);
  }

  async _loadProfile(uid) {
    const { data } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();

    if (data) {
      this.userData = data;
      debugLog.log(`👤 프로필 로드: ${data.nickname}`);
    }
  }

  /* =========================
     인증 메서드
  ========================== */
  async signUp(email, password, nickname) {
    debugLog.log(`📝 회원가입 시도: ${email}`);
    
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          nickname: nickname || email.split("@")[0]
        }
      }
    });

    if (error) {
      debugLog.log(`❌ 회원가입 실패: ${error.message}`);
      return { success: false, error: error.message };
    }

    debugLog.log("✅ 회원가입 성공");
    
    // 프로필 테이블에도 저장
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
    debugLog.log(`🔑 로그인 시도: ${email}`);
    
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      debugLog.log(`❌ 로그인 실패: ${error.message}`);
      return { success: false, error: error.message };
    }

    debugLog.log("✅ 로그인 성공");
    return { success: true, data };
  }

  async signOut() {
    debugLog.log("👋 로그아웃");
    const { error } = await this.client.auth.signOut();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    this.currentUser = null;
    this.userData = null;
    return { success: true };
  }

  /* =========================
     상태 확인
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

  /* =========================
     게시글
  ========================== */
  async createPost(title, content, imageUrls = []) {
    if (!this.isLoggedIn()) {
      return { success: false, error: "로그인 필요" };
    }

    const postData = {
      title,
      content,
      uid: this.currentUser.id,
      author: this.userData.nickname,
      time: new Date().toISOString(),
      deleted: false,
      images: imageUrls || []
    };

    debugLog.log("📝 게시글 등록 시도");
    debugLog.log(JSON.stringify(postData, null, 2));

    const { data, error } = await this.client
      .from("wiki_posts")
      .insert(postData)
      .select()
      .single();

    if (error) {
      debugLog.log(`❌ 게시글 실패: ${error.message}`);
      return { success: false, error: error.message };
    }

    debugLog.log(`✅ 게시글 생성 ID: ${data.id}`);
    return { success: true, data };
  }

  async updatePost(id, title, content, imageUrls = []) {
    const { data, error } = await this.client
      .from("wiki_posts")
      .update({
        title,
        content,
        images: imageUrls || [],
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async getPosts() {
    return await this.client
      .from("wiki_posts")
      .select("*")
      .eq("deleted", false)
      .order("time", { ascending: false });
  }

  /* =========================
     댓글
  ========================== */
  async addComment(postId, content) {
    if (!this.isLoggedIn()) {
      return { success: false, error: "로그인 필요" };
    }

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
    return await this.client
      .from("wiki_comments")
      .select("*")
      .eq("post_id", postId)
      .order("time", { ascending: false });
  }

  /* =========================
     좋아요
  ========================== */
  async toggleLike(postId) {
    if (!this.isLoggedIn()) {
      return { success: false, error: "로그인 필요" };
    }

    const { data } = await this.client
      .from("wiki_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("uid", this.currentUser.id)
      .maybeSingle();

    if (data) {
      await this.client.from("wiki_likes").delete().eq("id", data.id);
      return { success: true, liked: false };
    } else {
      await this.client.from("wiki_likes").insert({
        post_id: postId,
        uid: this.currentUser.id
      });
      return { success: true, liked: true };
    }
  }
}

/* =========================
   Export
========================== */
export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
