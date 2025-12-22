
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

// 화면에 로그를 표시하는 유틸리티
class VisualLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 20;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push({ message, type, timestamp });
    if (this.logs.length > this.maxLogs) this.logs.shift();
    this.render();
    console.log(message); // 콘솔에도 출력
  }

  render() {
    let logDiv = document.getElementById('visual-debug-log');
    if (!logDiv) {
      logDiv = document.createElement('div');
      logDiv.id = 'visual-debug-log';
      logDiv.style.cssText = `
        position: fixed; bottom: 10px; right: 10px; 
        width: 400px; max-height: 300px; overflow-y: auto;
        background: rgba(0,0,0,0.9); color: #0f0; 
        font-family: monospace; font-size: 11px;
        padding: 10px; border-radius: 5px; z-index: 9999;
        box-shadow: 0 0 10px rgba(0,255,0,0.3);
      `;
      document.body.appendChild(logDiv);
    }

    logDiv.innerHTML = this.logs.map(log => {
      const color = log.type === 'error' ? '#f00' : 
                    log.type === 'success' ? '#0f0' : 
                    log.type === 'warn' ? '#ff0' : '#0f0';
      return `<div style="color: ${color}; margin: 2px 0;">[${log.timestamp}] ${log.message}</div>`;
    }).join('');
    
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  clear() {
    this.logs = [];
    this.render();
  }
}

const vlog = new VisualLogger();

class SupabaseService {
  constructor() {
    if (SupabaseService.instance) return SupabaseService.instance;

    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    this.currentUser = null;
    this.userData = null;
    this._authResolved = false;

    this._authPromise = new Promise((resolve) => {
      this._resolveAuth = resolve;
    });

    vlog.log("🚀 Supabase 서비스 초기화 중...", 'info');

    // 초기 세션 확인
    this.client.auth.getSession().then(({ data: { session } }) => {
      vlog.log(`🔍 초기 세션: ${session?.user?.email || "세션 없음"}`, 'info');
      if (session?.user) {
        this.updateUserData(session.user);
      } else {
        this._completeAuth();
      }
    });

    this.client.auth.onAuthStateChange(async (event, session) => {
      vlog.log(`🔑 Auth Event: ${event} (${session?.user?.email || "세션 없음"})`, 'info');

      if (event === 'SIGNED_IN' && session?.user) {
        await this.updateUserData(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.userData = null;
        this._completeAuth();
      }
    });

    SupabaseService.instance = this;
  }

  _completeAuth() {
    if (this._authResolved) {
      vlog.log("⚠️ 인증이 이미 완료됨 (중복 호출)", 'warn');
      return;
    }
    this._authResolved = true;
    if (this._resolveAuth) {
      this._resolveAuth();
      vlog.log("✅ _resolveAuth() 호출됨", 'success');
    }
    vlog.log("🏁 인증 및 프로필 로드 완료", 'success');
  }

  async waitForAuth() {
    vlog.log(`⏳ waitForAuth 호출, _authResolved: ${this._authResolved}`, 'info');
    if (this._authResolved) {
      vlog.log("✅ 이미 인증 완료, 즉시 반환", 'success');
      return Promise.resolve();
    }
    vlog.log("⏳ 인증 대기 중...", 'warn');
    return this._authPromise;
  }

  async updateUserData(user) {
    vlog.log(`📝 updateUserData 시작: ${user.email}`, 'info');
    this.currentUser = user;
    try {
      vlog.log("🔍 프로필 조회 중...", 'info');
      const { data, error } = await this.client
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        vlog.log(`⚠️ DB Error: ${error.message}`, 'error');
        throw error;
      }
      
      this.userData = data || { id: user.id, nickname: user.email.split("@")[0], role: "user" };
      vlog.log(`👤 데이터 로드 성공: ${this.userData.nickname}`, 'success');
    } catch (err) {
      vlog.log(`❌ 데이터 로드 실패: ${err.message}`, 'error');
      this.userData = { id: user.id, nickname: user.email.split("@")[0], role: "user" };
    } finally {
      vlog.log("🔚 updateUserData finally 블록 실행", 'info');
      this._completeAuth();
    }
  }

  async signIn(email, password) {
    vlog.log(`🔐 로그인 시도: ${email}`, 'info');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      vlog.log(`❌ 로그인 실패: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
    vlog.log("✅ 로그인 성공", 'success');
    return { success: true, data };
  }

  async signUp(email, password, nickname) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };
    if (data?.user) {
      await this.client.from("profiles").insert([{ 
        id: data.user.id, email, nickname: nickname || email.split("@")[0], role: 'user' 
      }]);
    }
    return { success: true, data };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    return error ? { success: false, error: error.message } : { success: true };
  }

  async createPost(title, content, images = []) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    try {
      const { data, error } = await this.client.from("wiki_posts").insert([{
        title, content, images,
        uid: this.currentUser.id,
        author: this.userData?.nickname || this.currentUser.email,
        time: new Date().toISOString(),
        deleted: false
      }]).select().single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) { return { success: false, error: err.message }; }
  }

  async getPosts() {
    const { data, error } = await this.client.from("wiki_posts").select("*").eq("deleted", false).order("time", { ascending: false });
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async getPost(id) {
    const { data, error } = await this.client.from("wiki_posts").select("*").eq("id", id).single();
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async deletePost(id) {
    const { error } = await this.client.from("wiki_posts").update({ deleted: true }).eq("id", id);
    return error ? { success: false, error: error.message } : { success: true };
  }

  async addComment(postId, content) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    try {
      const { data, error } = await this.client.from("wiki_comments").insert([{
        post_id: postId, content,
        uid: this.currentUser.id,
        author: this.userData?.nickname || this.currentUser.email,
        time: new Date().toISOString()
      }]).select().single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) { return { success: false, error: err.message }; }
  }

  async getComments(postId) {
    const { data, error } = await this.client.from("wiki_comments").select("*").eq("post_id", postId).order("time", { ascending: false });
    return error ? { success: false, error: error.message } : { success: true, data: data || [] };
  }

  async addContribution(postId, content, summary) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    const { error } = await this.client.from("wiki_contributions").insert([{
      post_id: postId, uid: this.currentUser.id,
      author: this.userData?.nickname || this.currentUser.email,
      content, summary, time: new Date().toISOString()
    }]);
    return error ? { success: false, error: error.message } : { success: true };
  }

  isLoggedIn() { return !!this.currentUser; }
  isAdmin() { return this.userData?.role === "admin"; }
  getCurrentUser() {
    return { user: this.currentUser, data: this.userData, profile: this.userData };
  }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;