/* JustANotepad Public Config
   공개 가능한 설정값만. 보안은 Supabase Row Level Security로 보호.
   변경하려면 이 파일 수정 후 GitHub에 커밋하면 자동 배포.
*/
window.SUPABASE_URL = 'https://rbscvtnfveakwjwrteux.supabase.co';
// Legacy JWT anon key — required by Supabase Realtime. The newer
// sb_publishable_* key format works for REST/Auth but Realtime rejects it
// (no role claim). This is the public JWT; RLS protects the data.
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJic2N2dG5mdmVha3dqd3J0ZXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTQwODEsImV4cCI6MjA5MjEzMDA4MX0.qq4MAUs17auTF_ecSj-grrxttQSU9cmCRFecL4FxsXY';
