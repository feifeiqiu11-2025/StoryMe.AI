-- Quick Fix: Give feifei_qiu@hotmail.com unlimited image generation
-- Run this NOW in Supabase SQL Editor

UPDATE users
SET images_limit = -1
WHERE email = 'feifei_qiu@hotmail.com';

-- Verify
SELECT email, images_limit, images_generated_count, subscription_tier
FROM users
WHERE email = 'feifei_qiu@hotmail.com';

-- Expected: images_limit = -1 (unlimited)
