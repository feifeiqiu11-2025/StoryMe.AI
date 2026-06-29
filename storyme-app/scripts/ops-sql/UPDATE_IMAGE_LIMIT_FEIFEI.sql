-- Update images_limit for feifei_qiu@hotmail.com
-- Run this in Supabase SQL Editor

-- Step 1: Find the user ID for feifei_qiu@hotmail.com
SELECT id, email, images_limit
FROM users
WHERE email = 'feifei_qiu@hotmail.com';

-- Step 2: Update images_limit to 1000
UPDATE users
SET images_limit = 1000
WHERE email = 'feifei_qiu@hotmail.com';

-- Step 3: Verify the update
SELECT id, email, images_limit, updated_at
FROM users
WHERE email = 'feifei_qiu@hotmail.com';

-- Expected result:
-- email: feifei_qiu@hotmail.com
-- images_limit: 1000
-- updated_at: (current timestamp)
