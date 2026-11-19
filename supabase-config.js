window.ANNSETU_SUPABASE_URL = 'https://wwnkyukqiibbzqqbfsxp.supabase.co';
window.ANNSETU_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_WUzn-_25u3USE5u30VyxpA_AZ8-wfkt';

// FastAPI backend (AI review + chatbot). On the deployed site it runs on the same domain under /api.
// Local static servers have no /api, so it stays off there unless you set it yourself.
window.ANNSETU_API_URL = window.ANNSETU_API_URL || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '' : '/api');
