# Stripe Setup Guide - Phase 2B

**Time:** 30 minutes
**Required:** Stripe account

---

## Step 1: Create Stripe Account (if needed)

1. Go to https://stripe.com
2. Sign up for a free account
3. Complete verification

---

## Step 2: Get API Keys

1. Go to **Stripe Dashboard** → **Developers** → **API keys**
2. Copy these keys (you'll need both test and live):

**Test Mode (for development):**
- Publishable key: `pk_test_...`
- Secret key: `sk_test_...`

**Live Mode (for production):**
- Publishable key: `pk_live_...`
- Secret key: `sk_live_...`

---

## Step 3: Add Keys to Environment Variables

**Local Development** (`storyme-app/.env.local`):
```bash
# Stripe Keys (Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

**Production** (Vercel):
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the same variables with **Live Mode** keys

---

## Step 4: Create Products in Stripe

Go to **Stripe Dashboard** → **Products** → **Add Product**

### Product 1: Basic

- **Name:** KindleWood Studio - Basic
- **Description:** 20 stories per month with all features
- **Pricing:**
  - Monthly: $8.99 USD (Recurring)
  - Annual: $89 USD (Recurring, yearly)
- **Metadata:**
  - `tier`: `basic`
  - `stories_limit`: `20`

### Product 2: Premium

- **Name:** KindleWood Studio - Premium
- **Description:** Unlimited stories with priority support
- **Pricing:**
  - Monthly: $14.99 USD (Recurring)
  - Annual: $149 USD (Recurring, yearly)
- **Metadata:**
  - `tier`: `premium`
  - `stories_limit`: `-1`

### Product 3: Team

- **Name:** KindleWood Studio - Team
- **Description:** 5 accounts with unlimited stories each
- **Pricing:**
  - Monthly: $59.99 USD (Recurring)
  - Annual: $599 USD (Recurring, yearly)
- **Metadata:**
  - `tier`: `team`
  - `stories_limit`: `-1`
  - `max_members`: `5`

---

## Step 5: Get Price IDs

After creating products:

1. Go to each product in Stripe
2. Click on the price
3. Copy the **Price ID** (starts with `price_...`)

You'll need 6 price IDs total:
- `basic_monthly`: price_...
- `basic_annual`: price_...
- `premium_monthly`: price_...
- `premium_annual`: price_...
- `team_monthly`: price_...
- `team_annual`: price_...

Add to `.env.local`:
```bash
# Stripe Price IDs
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_BASIC_ANNUAL=price_...
STRIPE_PRICE_PREMIUM_MONTHLY=price_...
STRIPE_PRICE_PREMIUM_ANNUAL=price_...
STRIPE_PRICE_TEAM_MONTHLY=price_...
STRIPE_PRICE_TEAM_ANNUAL=price_...
```

---

## Step 6: Set Up Webhook

**For Local Development:**

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe login`
3. Run: `stripe listen --forward-to localhost:3002/api/webhooks/stripe`
4. Copy the webhook signing secret (starts with `whsec_...`)
5. Add to `.env.local`: `STRIPE_WEBHOOK_SECRET=whsec_...`

**For Production:**

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. URL: `https://story-me-ai.vercel.app/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
5. Copy webhook signing secret
6. Add to Vercel environment variables

---

## Step 7: Install Stripe Package

```bash
cd storyme-app
npm install stripe @stripe/stripe-js
```

---

## Step 8: Test Payment Flow

**Use Stripe Test Cards:**

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits

---

## Verification Checklist

- [ ] Stripe account created
- [ ] API keys added to `.env.local`
- [ ] 3 products created in Stripe
- [ ] 6 price IDs copied
- [ ] Price IDs added to `.env.local`
- [ ] Webhook endpoint configured
- [ ] Webhook secret added to `.env.local`
- [ ] `stripe` and `@stripe/stripe-js` installed

---

## Next Steps

Once you've completed the above:

1. I'll create the checkout endpoint
2. I'll create the webhook handler
3. I'll integrate with the pricing page
4. We'll test the full flow

---

**Let me know when you've completed the Stripe setup!**
