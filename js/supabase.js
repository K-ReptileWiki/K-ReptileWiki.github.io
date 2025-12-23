import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

/* =========================
   디버그 UI 로거
========================== */
class DebugLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 30;
    this.visible = true;
    this.createUI();
  }

  createUI() {
    // 로그 컨테이너
    const container = document.createElement('div');
    container.id = 'debug-logger';
    container.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      width: 450px;
      max-height: 400px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #0f0;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      z-index: 99999;
      box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
    `;

    // 헤더
    const header = document.createElement('div');
    header.style.cssText = `
      background: #0f0;
      color: #000;
      padding: 8px 12px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 6px 6px 0 0;
    `;
    header.innerHTML = `
      <span>🔍 System Debug Log</span>
      <div>
        <button id="debug-clear" style="margin-right: 5px; padding: 2px 8px; border: none; background: #000; color: #0f0; border-radius: 3px; cursor: pointer; font-size: 10px;">Clear</button>
        <button id="debug-close" style="padding: 2px 8px; border: none; background: #f00; color: #fff; border-radius: 3px; cursor: pointer; font-weight: bold;">✕</button>
      </div>
    `;

    // 로그 영역
    const logArea = document.createElement('div');
    logArea.id = 'debug-log-area';
    logArea.style.cssText = `
      padding: 10px;
      max-height: 340px;
      overflow-y: auto;
      color: #0f0;
      line-height: 1.4;
    `;

    container.appendChild(header);
    container.appendChild(logArea);
    document.body.appendChild(container);

    // 이벤트 리스너
    document.getElementById('debug-close').onclick = () => {
      container.style.display = 'none';
      this.visible = false;
    };

    document.getElementById('debug-clear').onclick = () => {
      this.logs = [];
      this.render();
    };

    // 더블클릭으로 다시 보이기
    document.addEventListener('dblclick', (e) => {
      if (e.ctrlKey && !this.visible) {
        container.style.display = 'block';
        this.visible = true;
      }
    });
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: '#0f0',
      success: '#0ff',
      warn: '#ff0',
      error: '#f00'
    };

    this.logs.push({ message, type, timestamp, color: colors[type] || colors.info });
    
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    console.log(`[${timestamp}] ${message}`);
    this.render();
  }

  render() {
    const logArea = document.getElementById('debug-log-area');
    if (!logArea) return;

    logArea.innerHTML = this.logs.map(log => 
      `<div style="color: ${log.color}; margin: 3px 0;">[${log.timestamp}] ${log.message}</div>`
    ).join('');

    logArea.scrollTop = logArea.scrollHeight;
  }
}

const debugLog = new DebugLogger();

/* =========================
   Supabase Service
========================== */
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

    debugLog.log("🚀 Supabase 서비스 초기화 중...", 'info');

    this.client.auth.getSession().then(({ data: { session } }) => {
      debugLog.log(`🔍 초기 세션: ${session?.user?.email || "세션 없음"}`, 'info');
      if (session?.user) {
        this.updateUserData(session.user);
      } else {
        debugLog.log("🔓 비로그인 상태, 인증 완료 처리", 'info');
        this._completeAuth();
      }
    });

    this.client.auth.onAuthStateChange(async (event, session) => {
      debugLog.log(`🔑 Auth Event: ${event} (${session?.user?.email || "없음"})`, 'info');
      
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
    debugLog.log(`🔍 _completeAuth 호출 (_authResolved: ${this._authResolved})`, 'info');
    
    if (this._authResolved) {
      debugLog.log("⚠️ 이미 완료됨 (중복 호출 방지)", 'warn');
      return;
    }

    this._authResolved = true;
    
    if (this._resolveAuth) {
      this._resolveAuth();
      debugLog.log("✅ Promise resolved!", 'success');
    }
    
    debugLog.log("🏁 인증 완료", 'success');
  }

  async waitForAuth() {
    debugLog.log(`⏳ waitForAuth 호출 (_authResolved: ${this._authResolved})`, 'info');
    
    if (this._authResolved) {
      debugLog.log("✅ 이미 완료, 즉시 반환", 'success');
      return Promise.resolve();
    }
    
    debugLog.log("⏳ 인증 대기 중...", 'warn');
    return this._authPromise;
  }

  async updateUserData(user) {
    debugLog.log(`📝 updateUserData 시작: ${user.email}`, 'info');
    this.currentUser = user;
    
    this.userData = { 
      id: user.id, 
      nickname: user.email.split("@")[0], 
      role: "user" 
    };
    
    debugLog.log("💡 기본 데이터 설정 완료, _completeAuth 호출", 'info');
    this._completeAuth();
    
    this.loadProfileInBackground(user.id);
  }

  async loadProfileInBackground(userId) {
    try {
      debugLog.log("🔍 백그라운드 프로필 조회 시작", 'info');
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('타임아웃')), 3000)
      );
      
      const queryPromise = this.client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        debugLog.log(`⚠️ 프로필 조회 실패: ${error.message}`, 'warn');
        return;
      }
      
      if (data) {
        this.userData = data;
        debugLog.log(`👤 프로필 업데이트: ${data.nickname} (${data.role})`, 'success');
      } else {
        debugLog.log("📋 프로필 데이터 없음 (기본값 유지)", 'info');
      }
      
    } catch (err) {
      debugLog.log(`⚠️ 프로필 조회 생략: ${err.message}`, 'warn');
    }
  }

  /* =========================
     인증 기능
  ========================== */
  async signIn(email, password) {
    debugLog.log(`🔐 로그인 시도: ${email}`, 'info');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    
    if (error) {
      debugLog.log(`❌ 로그인 실패: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
    
    debugLog.log("✅ 로그인 성공", 'success');
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

  /* =========================
     게시글 기능
  ========================== */
  async createPost(title, content, images = []) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    
    try {
      debugLog.log(`📝 게시글 생성: "${title}" (이미지 ${images.length}개)`, 'info');
      
      const { data, error } = await this.client
        .from("wiki_posts")
        .insert({
          title,
          content,
          image: images,
          uid: this.currentUser.id,
          author: this.userData?.nickname || this.currentUser.email,
          time: new Date().toISOString(),
          deleted: false
        })
        .select()
        .single();
      
      if (error) throw error;
      
      debugLog.log(`✅ 게시글 등록 성공: ID ${data.id}`, 'success');
      return { success: true, data };
      
    } catch (err) {
      debugLog.log(`❌ 게시글 등록 실패: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  }

  async getPosts() {
    const { data, error } = await this.client
      .from("wiki_posts")
      .select("*")
      .eq("deleted", false)
      .order("time", { ascending: false });
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async getPost(id) {
    const { data, error } = await this.client
      .from("wiki_posts")
      .select("*")
      .eq("id", id)
      .single();
    return error ? { success: false, error: error.message } : { success: true, data };
  }

  async updatePost(id, title, content, images = []) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    
    try {
      const { data, error } = await this.client
        .from("wiki_posts")
        .update({
          title,
          content,
          image: images,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
      
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async deletePost(id) {
    const { error } = await this.client
      .from("wiki_posts")
      .update({ deleted: true })
      .eq("id", id);
    return error ? { success: false, error: error.message } : { success: true };
  }

  /* =========================
     댓글 기능
  ========================== */
  async addComment(postId, content) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    
    try {
      const { data, error } = await this.client
        .from("wiki_comments")
        .insert({
          post_id: postId, 
          content,
          uid: this.currentUser.id,
          author: this.userData?.nickname || this.currentUser.email,
          time: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
      
    } catch (err) { 
      return { success: false, error: err.message }; 
    }
  }

  async getComments(postId) {
    const { data, error } = await this.client
      .from("wiki_comments")
      .select("*")
      .eq("post_id", postId)
      .order("time", { ascending: false });
    return error ? { success: false, error: error.message } : { success: true, data: data || [] };
  }

  async deleteComment(commentId) {
    const { error } = await this.client
      .from("wiki_comments")
      .delete()
      .eq("id", commentId);
    return error ? { success: false, error: error.message } : { success: true };
  }

  /* =========================
     기여/좋아요/검색
  ========================== */
  async addContribution(postId, content, summary) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    
    const { error } = await this.client
      .from("wiki_contributions")
      .insert({
        post_id: postId, 
        uid: this.currentUser.id,
        author: this.userData?.nickname || this.currentUser.email,
        content, 
        summary, 
        time: new Date().toISOString()
      });
    
    return error ? { success: false, error: error.message } : { success: true };
  }

  async getContributions(postId) {
    const { data, error } = await this.client
      .from("wiki_contributions")
      .select("*")
      .eq("post_id", postId)
      .order("time", { ascending: false });
    
    return error ? { success: false, error: error.message } : { success: true, data: data || [] };
  }

  async toggleLike(postId) {
    if (!this.currentUser) return { success: false, error: "로그인 필요" };
    
    try {
      const { data: existing } = await this.client
        .from("wiki_likes")
        .select("*")
        .eq("post_id", postId)
        .eq("uid", this.currentUser.id)
        .maybeSingle();
      
      if (existing) {
        const { error } = await this.client
          .from("wiki_likes")
          .delete()
          .eq("id", existing.id);
        
        if (error) throw error;
        return { success: true, liked: false };
      } else {
        const { error } = await this.client
          .from("wiki_likes")
          .insert({
            post_id: postId,
            uid: this.currentUser.id
          });
        
        if (error) throw error;
        return { success: true, liked: true };
      }
      
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getLikeCount(postId) {
    const { count, error } = await this.client
      .from("wiki_likes")
      .select("*", { count: 'exact', head: true })
      .eq("post_id", postId);
    
    return error ? { success: false, error: error.message } : { success: true, count: count || 0 };
  }

  async isLiked(postId) {
    if (!this.currentUser) return { success: true, liked: false };
    
    const { data, error } = await this.client
      .from("wiki_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("uid", this.currentUser.id)
      .maybeSingle();
    
    return error ? { success: false, error: error.message } : { success: true, liked: !!data };
  }

  async searchPosts(keyword) {
    const { data, error } = await this.client
      .from("wiki_posts")
      .select("*")
      .eq("deleted", false)
      .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
      .order("time", { ascending: false });
    
    return error ? { success: false, error: error.message } : { success: true, data: data || [] };
  }

  /* =========================
     유틸리티
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
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;