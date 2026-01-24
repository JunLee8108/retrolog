// ==================== Supabase Client ====================

const SUPABASE_URL = "https://beqyfjxpvkfpawlrmxjp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlcXlmanhwdmtmcGF3bHJteGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQwMjIsImV4cCI6MjA4NDg0MDAyMn0.0lULOVKEi4fZLB17i662W0ymtKZ65XlZ4aZBN3iL-EY";

// window.supabase = CDN 라이브러리 객체
// supabaseClient = 프로젝트 클라이언트 인스턴스
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);
