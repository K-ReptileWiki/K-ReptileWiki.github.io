import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   Supabase Config
========================== */
const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
};

/* =========================
   Debug Logger
========================== */
class DebugLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 30;
    this.visible = true;
    this.createUI();
  }

  createUI() {
    const container = document.createElement("div");
    container.style.cssText = `
      position:fixed; bottom:10px; right:10px;
      width:450px; max-height:400px;
      background:#000; color:#0f0;
      border:2px solid #0f0; z-index:99999;
      font-family:monospace; font-size:11px;
    `;

    container.innerHTML = `
      <div style="background:#0f0;color:#000;padding:6px;font-weight:bold">
        Debug Log
        <button id="dbgClear" style="float:right">Clear</button>
      </div>
      <div id="dbgBody" style="padding:8px;overflow:auto;max-height:350px"></div>
    `;

    document.body.appendChild(container);
    document.getElementById("dbgClear").onclick = () => {
      this.logs = [];
      this.render();
    };
  }

  log(msg, type = "info") {
    const time = new Date().toLocaleTimeString();
    this.logs.push(`[${time}] ${msg}`);
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

  async init() {
    debugLog.log("🚀 Supabase 초기화");

    const { data } = await this.client.auth.getSession();
    if (data?.session?.user) {
      await this._setUser(data.session.user);
    } else {
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
    debugLog.log(`👤 로그인 사용자: ${user.email}`);
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
     게시글
  ========================== */
  async createPost(title, content, imageUrls = []) {
    if (!this.currentUser) {
      return { success: false, error: "로그인 필요" };
    }

    const postData = {
      title,
      content,
      uid: this.currentUser.id,
      author: this.userData.nickname,
      time: new Date().toISOString(),
      deleted: false,
      images: imageUrls.length ? imageUrls : [] // ⭐ 핵심 수정
    };

    debugLog.log(`📝 게시글 등록 데이터`);
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
    const updateData = {
      title,
      content,
      images: imageUrls.length ? imageUrls : [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.client
      .from("wiki_posts")
      .update(updateData)
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
    const { data } = await this.client
      .from("wiki_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("uid", this.currentUser.id)
      .maybeSingle();

    if (data) {
      await this.client.from("wiki_likes").delete().eq("id", data.id);
      return { liked: false };
    } else {
      await this.client.from("wiki_likes").insert({
        post_id: postId,
        uid: this.currentUser.id
      });
      return { liked: true };
    }
  }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
