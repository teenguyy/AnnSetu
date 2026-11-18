-- After creating your account, copy its UUID from Supabase Auth > Users.
-- Run this once from the Supabase SQL Editor using your own UUID.
update public.profiles set role = 'admin' where id = 'PASTE-YOUR-AUTH-USER-UUID-HERE';
