import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* =========================
   Supabase 설정
========================= */
const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "YOUR_ANON_KEY" // ← anon key
};

/* =========================
   Supabase Service
========================= */
class SupabaseService {
  constructor() {
    if (SupabaseService.instance) {
      return SupabaseService.instance;
    }

    this.client = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.key
    );

    this.currentUser = null;
    this.userData = null;

    /* ✅ 인증 상태 변경 (v2) */
    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log("🔑 인증 상태:", event);
      await this.updateUserData(session?.user);
    });

    /* ✅ 새로고침 시 로그인 유지 */
    this.client.auth.getSession().then(({ data }) => {
      this.updateUserData(data.session?.user);
    });

    SupabaseService.instance = this;
  }

  /* =========================
     사용자 데이터
  ========================= */
  async updateUserData(user) {
    if (!user) {
      this.currentUser = null;
      this.userData = null;
      return;
    }

    this.currentUser = user;

    try {
      const { data, error } = await this.client
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

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

        await this.client.from("users").insert([newUser]);
        this.userData = newUser;
      }
    } catch (err) {
      console.error("❌ 사용자 데이터 로드 실패:", err);
    }
  }

  /* =========================
     인증
  ========================= */
  async signIn(email, password) {
    try {
      const { data, error } =
        await this.client.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async signUp(email, password, nickname) {
    try {
      const { data, error } =
        await this.client.auth.signUp({
          email,
          password
        });

      if (error) throw error;

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
      return { success: false, error: err.message };
    }
  }

  async signOut() {
    try {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /* =========================
     게시글
  ========================= */
  async getPosts(limit = 50, includeDeleted = false) {
    try {
      let query = this.client
        .from("wiki_posts")
        .select("*")
        .order("time", { ascending: false })
        .limit(limit);

      if (!includeDeleted) {
        query = query.eq("deleted", false);
      }

      const { data, error } = await query;
      if (error) throw error;

      return { success: true, data };
    } catch (err) {
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
      return { success: false, error: err.message };
    }
  }

  async deletePost(id) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    try {
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
      return { success: false, error: err.message };
    }
  }

  /* =========================
     버전 히스토리
  ========================= */
  async getPostVersions(postId) {
    const { data, error } = await this.client
      .from("wiki_post_versions")
      .select("*")
      .eq("post_id", postId)
      .order("version_number", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async restorePostVersion(postId, versionNumber) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    const { data, error } = await this.client.rpc(
      "restore_post_version",
      {
        p_post_id: postId,
        p_version_number: versionNumber,
        p_user_id: this.currentUser.id
      }
    );

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  /* =========================
     좋아요
  ========================= */
  async toggleLike(postId) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

    const { data: existing } = await this.client
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", this.currentUser.id)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "이미 좋아요를 눌렀습니다" };
    }

    await this.client.from("post_likes").insert([{
      post_id: postId,
      user_id: this.currentUser.id
    }]);

    const count = await this.getLikeCount(postId);
    return { success: true, count };
  }

  async getLikeCount(postId) {
    const { count } = await this.client
      .from("post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    return count || 0;
  }

  /* =========================
     댓글
  ========================= */
  async getComments(postId) {
    const { data, error } = await this.client
      .from("wiki_comments")
      .select("*")
      .eq("post_id", postId)
      .order("time", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async addComment(postId, content) {
    if (!this.currentUser) {
      return { success: false, error: "로그인이 필요합니다" };
    }

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

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  /* =========================
     유틸
  ========================= */
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

/* =========================
   Export
========================= */
export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
