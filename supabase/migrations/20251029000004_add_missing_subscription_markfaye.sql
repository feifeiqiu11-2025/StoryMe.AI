-- Add missing subscription record for markfaye2025@gmail.com
-- User upgraded to basic tier but webhook failed to create subscription record

-- Insert the subscription record with data from Stripe
INSERT INTO subscriptions (
  id,
  user_id,
  stripe_subscription_id,
  stripe_customer_id,
  tier,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at,
  updated_at
) VALUES (
  uuid_generate_v4(),
  'b78a462d-0d0c-4df6-b3ef-b42eabdf4aaf',  -- markfaye2025@gmail.com
  'sub_1SNgZtAg7OQqrjiWEUy3JpUF',
  'cus_TKLGAZE1P39Tt4',
  'basic',
  'active',
  '2025-10-29 21:06:44+00',  -- From billing_cycle_start in users table
  '2025-11-29 21:06:44+00',  -- Next invoice date (monthly cycle)
  false,
  '2025-10-29 21:06:44+00',
  NOW()
)
ON CONFLICT (stripe_subscription_id) DO NOTHING;  -- Prevent duplicate if record somehow exists

-- Verify the insertion
SELECT
  id,
  user_id,
  stripe_subscription_id,
  tier,
  status,
  current_period_start,
  current_period_end
FROM subscriptions
WHERE user_id = 'b78a462d-0d0c-4df6-b3ef-b42eabdf4aaf';

-- Comment for documentation
COMMENT ON TABLE subscriptions IS
  'Migration 4: Added missing subscription record for markfaye2025@gmail.com who upgraded but webhook did not create record';
