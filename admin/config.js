/* =========================================================
   Admin panel config.
   The anon (public) key is safe to ship in frontend code.
   NEVER put the service_role key here.
   ========================================================= */
window.ADMIN_CONFIG = {
  supabaseUrl: "https://fnbrgvpgyllfrnzjolul.supabase.co",
  supabaseAnonKey: "PASTE_ANON_PUBLIC_KEY_HERE",
  bucket: "site-images",
  maxImageBytes: 2 * 1024 * 1024,
  minImageWidth: 400
};
