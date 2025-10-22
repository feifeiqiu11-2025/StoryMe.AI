-- Verify feifei_qiu@hotmail.com has unlimited images
-- Run this in Supabase SQL Editor to check current status

SELECT
    email,
    subscription_tier,
    trial_status,
    images_limit,
    images_generated_count,
    created_at,
    updated_at
FROM users
WHERE email = 'feifei_qiu@hotmail.com';

-- Expected result:
-- images_limit: -1 (unlimited)
-- If not -1, run this:

UPDATE users
SET images_limit = -1
WHERE email = 'feifei_qiu@hotmail.com'
RETURNING email, images_limit, updated_at;
