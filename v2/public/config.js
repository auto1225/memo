/* JustANotepad Public Config
   공개 가능한 설정값만. 보안은 Supabase Row Level Security로 보호.
   production에서는 /config.js, v2 dev/preview에서는 이 파일을 읽습니다.
*/
window.SUPABASE_URL = 'https://rbscvtnfveakwjwrteux.supabase.co';
// Legacy JWT anon key — required by Supabase Realtime. This is public; RLS protects data.
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJic2N2dG5mdmVha3dqd3J0ZXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTQwODEsImV4cCI6MjA5MjEzMDA4MX0.qq4MAUs17auTF_ecSj-grrxttQSU9cmCRFecL4FxsXY';
