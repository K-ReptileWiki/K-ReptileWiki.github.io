import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_CONFIG = {
  url: "https://cpaikpjzlzzujwfgnanb.supabase.co",
  key: "⚠️ anon key"
};

class SupabaseService {
  static instance;

  constructor() {
    if (SupabaseService.instance) return SupabaseService.instance;

    this.client = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.key
    );

    this.currentUser = null;
    this.userData = null;

    this.client.auth.onAuthStateChange(async (_, session) => {
      await this._syncUser(session?.user || null);
    });

    SupabaseService.instance = this;
  }

  /* ---------------- 인증 ---------------- */

  async waitForAuth() {
    if (this.currentUser) return this.currentUser;

    const { data } = await this.client.auth.getSession();
    if (data?.session?.user) {
      await this._syncUser(data.session.user);
      return data.session.user;
    }
    return null;
  }

  async _syncUser(user) {
    if (!user) {
      this.currentUser = null;
      this.userData = null;
      return;
    }

    this.currentUser = user;

    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!error && data) {
      this.userData = data;
      return;
    }

    const { data: newProfile } = await this.client
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        nickname: user.email.split("@")[0],
        role: "user"
      })
      .select()
      .single();

    this.userData = newProfile;
  }

  /* ---------------- 게시글 ---------------- */

  async getPosts() {
    const { data, error } = await this.client
      .from("wiki_posts")
      .select(`
        *,
        post_likes(count)
      `)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: data.map(p => ({
        ...p,
        likes: p.post_likes[0]?.count || 0
      }))
    };
  }

  async createPost(title, content, images = []) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인 필요" };

    const { data, error } = await this.client
      .from("wiki_posts")
      .insert({
        title,
        content,
        images,
        uid: this.currentUser.id,
        author: this.userData.nickname
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async updatePost(id, title, content, images = []) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인 필요" };

    const { data, error } = await this.client
      .from("wiki_posts")
      .update({
        title,
        content,
        images,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("uid", this.currentUser.id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async deletePost(id) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인 필요" };

    const { error } = await this.client
      .from("wiki_posts")
      .delete()
      .eq("id", id)
      .eq("uid", this.currentUser.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /* ---------------- 좋아요 ---------------- */

  async toggleLike(postId) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인 필요" };

    const { data: exist } = await this.client
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", this.currentUser.id)
      .maybeSingle();

    if (exist) {
      await this.client
        .from("post_likes")
        .delete()
        .eq("id", exist.id);
      return { success: true, liked: false };
    }

    await this.client
      .from("post_likes")
      .insert({
        post_id: postId,
        user_id: this.currentUser.id
      });

    return { success: true, liked: true };
  }

  /* ---------------- 댓글 ---------------- */

  async getComments(postId) {
    const { data, error } = await this.client
      .from("wiki_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at");

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async addComment(postId, content) {
    await this.waitForAuth();
    if (!this.currentUser) return { success: false, error: "로그인 필요" };

    const { data, error } = await this.client
      .from("wiki_comments")
      .insert({
        post_id: postId,
        content,
        uid: this.currentUser.id,
        author: this.userData.nickname
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  /* ---------------- 상태 ---------------- */

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
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.client;
