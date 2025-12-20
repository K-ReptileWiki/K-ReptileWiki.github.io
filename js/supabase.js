// supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 프로젝트 URL과 anon 키
const supabaseUrl = "https://cpaikpjzlzzujwfgnanb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // anon(public) 키

// export 한 번만!
export const supabase = createClient(supabaseUrl, supabaseKey);
