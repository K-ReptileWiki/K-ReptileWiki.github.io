import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   Supabase 설정
========================= */
const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWlrcGp6bHp6dWp3ZmduYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDEwMzIsImV4cCI6MjA4MTcxNzAzMn0.u5diz_-p8Hh1FtkVO1CsDSUbz9fbSN2zXAIIP2637sc"
};

/* =========================
   Supabase Service 클래스
========================= */
class SupabaseService {
  constructor() {
    // 싱글톤 패턴
    if (SupabaseService.instance) {
      return SupabaseService.instance;
    }

    // Supabase 클라이언트 생성
    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

    // 사용자 상태
    this.currentUser = null;
    this.userData = null;

    // Auth 초기화 상태
    this._authResolved = false;
    this._authPromise = null;
    this._resolveAuth = null;

    // 인증 상태 변경 리스너
    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log("🔑 인증 상태:", event, session?.user?.email || "없음");
      await this.updateUserData(session?.user);

      // Auth 초기화 완료 표시
      if (!this._authResolved) {
        this._authResolved = true;
        if (this._resolveAuth) this._resolveAuth();
      }
    });

    // 페이지 로드 시 세션 복원
    this.client.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        this.updateUserData(data.session.user).then(() => {
          if (!this._authResolved) {
            this._authResolved = true;
            if (this._resolveAuth) this._resolveAuth();
          }
        });
      } else {
        // 로그인 안 된 상태도 초기화 완료로 표시
        if (!this._authResolved) {
          this._authResolved = true;
          if (this._resolveAuth) this._resolveAuth();
        }
      }
    });

    SupabaseService.instance = this;
  }

  /* =========================
     Auth 대기 (옵션)
  ========================== */
  async waitForAuth(timeout = 5000) {
    if (this._authResolved) return;
    
    if (!this._authPromise) {
      this._authPromise = new Promise((resolve) => {
        this._resolveAuth = resolve;
        
        // 타임아웃 설정
        setTimeout(() => {
          if (!this._authResolved) {
            console.warn("⚠️ Auth 초기화 타임아웃");
            this._authResolved = true;
            resolve();
          }
        }, timeout);
      });
    }
    
    return this._authPromise;
  }

  /* =========================
     사용자 데이터 업데이트
  ========================== */
  async updateUserData(user) {
    if (!user) {
      this.currentUser = null;
      this.userData = null;
      return;
    }

    this.currentUser = user;

    try {
      // users 테이블에서 사용자 정보 조회
      const { data, error } = await this.client
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      // 에러 무시 (PGRST116 = 데이터 없음)
      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        // 기존 사용자
        this.userData = data;
      } else {
        // 신규 사용자 생성
        const newUser = {
          id: user.id,
          email: user.email,
          nickname: user.email.split("@")[0],
          role: "user",
          created_at: new Date().toISOString()
        };
        
        const { error: insertError } = await this.client
          .from("users")
          .insert([newUser]);

        if (insertError) {
          console.error("사용자 생성 실패:", insertError);
        } else {
          this.userData = newUser;
        }
      }
    } catch (err) {
      console.error("❌ 사용자 데이터 로드 실패:", err);
      // 실패해도 기본 정보는 설정
      this.userData = {
        id: user.id,
        email: user.email,
        nickname: user.email.split("@")[0],
        role: "user"
      };
    }
  }

  /* =========================
     인증 메서드
  ========================== */
  async signIn(email, password) {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({ 
        email, 
        password 
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error("로그인 실패:", err);
      return { success: false, error: err.message };
    }
  }

  async signUp(email, password, nickname) {
    try {
      const { data, error } = await this.client.auth.signUp({ 
        email, 
        password 
      });
      if (error) throw error;

      // 사용자 프로필 생성
      if (data.user) {
        await this.client.from("users").insert([{
          id: data.user.id,
          email,
          nickname: nickname || email.split("@")[0],
          role: "user",
          created_at: new Date().toISOString()
        }]);
      }

      return { success: true, data };
    } catch (err) {
      console.error("회원가입 실패:", err);
      return { success: false, error: err.message };
    }
  }

  async signOut() {
    try {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
      
      // 상태 초기화
      this.currentUser = null;
      this.userData = null;
      
      return { success: true };
    } catch (err) {
      console.error("로그아웃 실패:", err);
      return { success: false, error: err.message };
    }
  }

  /* =========================
     게시글 메서드
  ========================== */
  async getPosts(limit = 50, includeDeleted = false) {
    try {
      let query = this.client
        .from("wiki_posts")
        .select("*")
        .order("time", { ascending: false })
        .limit(limit);
      
      // 삭제된 글 제외 (기본)
      if (!includeDeleted) {
        query = query.eq("deleted", false);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error("글 목록 조회 실패:", err);
      return { success: false, error: err.message };
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
    } catch (err) {
      console.error("글 조회 실패:", err);
      return { success: false, error: err.message };
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
          images,
          uid: this.currentUser.id,
          author: this.userData?.nickname || this.currentUser.email,
          time: new Date().toISOString(),
          version: 1,
          deleted: false
        }])
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error("글 작성 실패:", err);
      return { success: false, error: err.message };
    }
  }

  async updatePost(id, title, content, images = []) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    try {
      const { data, error } = await this.client
        .from("wiki_posts")
        .update({ title, content, images })
        .eq("id", id)
        .eq("uid", this.currentUser.id)
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error("글 수정 실패:", err);
      return { success: false, error: err.message };
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
    } catch (err) {
      console.error("글 삭제 실패:", err);
      return { success: false, error: err.message };
    }
  }

  /* =========================
     버전 히스토리
  ========================== */
  async getPostVersions(postId) {
    try {
      const { data, error } = await this.client
        .from("wiki_post_versions")
        .select("*")
        .eq("post_id", postId)
        .order("version_number", { ascending: false });
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error("버전 조회 실패:", err);
      return { success: false, error: err.message };
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
    } catch (err) {
      console.error("특정 버전 조회 실패:", err);
      return { success: false, error: err.message };
    }
  }

  async restorePostVersion(postId, versionNumber) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    try {
      const { data, error } = await this.client.rpc("restore_post_version", {
        p_post_id: postId,
        p_version_number: versionNumber,
        p_user_id: this.currentUser.id
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error("버전 복원 실패:", err);
      return { success: false, error: err.message };
    }
  }

  async compareVersions(postId, version1, version2) {
    try {
      const r1 = await this.getPostVersion(postId, version1);
      const r2 = await this.getPostVersion(postId, version2);
      
      if (!r1.success || !r2.success) {
        return { success: false, error: "버전을 찾을 수 없습니다" };
      }
      
      return {
        success: true,
        comparison: {
          version1: r1.data,
          version2: r2.data,
          titleChanged: r1.data.title !== r2.data.title,
          contentChanged: r1.data.content !== r2.data.content,
          imagesChanged: JSON.stringify(r1.data.images) !== JSON.stringify(r2.data.images)
        }
      };
    } catch (err) {
      console.error("버전 비교 실패:", err);
      return { success: false, error: err.message };
    }
  }

  /* =========================
     좋아요
  ========================== */
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
        return { success: false, error: "이미 좋아요를 눌렀습니다" };
      }

      // 좋아요 추가
      const { error } = await this.client
        .from("post_likes")
        .insert([{ 
          post_id: postId, 
          user_id: this.currentUser.id 
        }]);
      
      if (error) throw error;

      const count = await this.getLikeCount(postId);
      return { success: true, count };
    } catch (err) {
      console.error("좋아요 실패:", err);
      return { success: false, error: err.message };
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
    } catch (err) {
      console.error("좋아요 수 조회 실패:", err);
      return 0;
    }
  }

  /* =========================
     댓글
  ========================== */
  async getComments(postId) {
    try {
      const { data, error } = await this.client
        .from("wiki_comments")
        .select("*")
        .eq("post_id", postId)
        .order("time", { ascending: false });
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error("댓글 조회 실패:", err);
      return { success: false, error: err.message };
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
          uid: this.currentUser.id,
          author: this.userData?.nickname || this.currentUser.email,
          time: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error("댓글 작성 실패:", err);
      return { success: false, error: err.message };
    }
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
      profile: this.userData  // 호환성을 위해 추가
    };
  }
}

/* =========================
   Export
========================= */
export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;