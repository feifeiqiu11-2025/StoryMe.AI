# Quick Start: Stripe Integration

**Time:** 30 minutes
**Goal:** Get Stripe checkout working locally

---

## 1. Get API Keys (5 min)

Visit: https://dashboard.stripe.com/test/apikeys

Copy these 2 keys:
```
Publishable key: pk_test_...
Secret key: sk_test_...
```

---

## 2. Create Products (15 min)

Visit: https://dashboard.stripe.com/test/products

**Create 3 products, each with 2 prices:**

### Product 1: KindleWood Studio - Basic
- Name: `KindleWood Studio - Basic`
- **Monthly Price:** $8.99 USD, Recurring
- **Annual Price:** $89 USD, Recurring yearly
- Metadata:
  - `tier` = `basic`
  - `stories_limit` = `20`

### Product 2: KindleWood Studio - Premium
- Name: `KindleWood Studio - Premium`
- **Monthly Price:** $14.99 USD, Recurring
- **Annual Price:** $149 USD, Recurring yearly
- Metadata:
  - `tier` = `premium`
  - `stories_limit` = `-1`

### Product 3: KindleWood Studio - Team
- Name: `KindleWood Studio - Team`
- **Monthly Price:** $59.99 USD, Recurring
- **Annual Price:** $599 USD, Recurring yearly
- Metadata:
  - `tier` = `team`
  - `stories_limit` = `-1`
  - `max_members` = `5`

**Copy all 6 price IDs** (they look like `price_1A2B3C...`)

---

## 3. Add to .env.local (2 min)

Open `storyme-app/.env.local` and add:

```bash
# Stripe Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE

# Price IDs
STRIPE_PRICE_BASIC_MONTHLY=price_YOUR_BASIC_MONTHLY_ID
STRIPE_PRICE_BASIC_ANNUAL=price_YOUR_BASIC_ANNUAL_ID
STRIPE_PRICE_PREMIUM_MONTHLY=price_YOUR_PREMIUM_MONTHLY_ID
STRIPE_PRICE_PREMIUM_ANNUAL=price_YOUR_PREMIUM_ANNUAL_ID
STRIPE_PRICE_TEAM_MONTHLY=price_YOUR_TEAM_MONTHLY_ID
STRIPE_PRICE_TEAM_ANNUAL=price_YOUR_TEAM_ANNUAL_ID
```

---

## 4. Set Up Webhook (5 min)

**Install Stripe CLI:**
```bash
brew install stripe/stripe-cli/stripe
```

**Start webhook forwarding:**
```bash
stripe login
stripe listen --forward-to localhost:3002/api/webhooks/stripe
```

**Copy the webhook secret** (looks like `whsec_...`) and add to `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

---

## 5. Test It! (3 min)

**Start your app:**
```bash
cd storyme-app
npm run dev
```

**Test checkout:**
1. Go to http://localhost:3002/pricing
2. Click "Choose Basic"
3. Use test card: `4242 4242 4242 4242`
4. Expiry: `12/34`, CVC: `123`, ZIP: `12345`
5. Complete checkout
6. Check `/upgrade` - should show "Basic" tier

**Verify in database:**
```sql
SELECT subscription_tier, stories_limit FROM users WHERE email = 'your@email.com';
```

Should show: `basic` and `20`

---

## ✅ Done!

If checkout worked and database updated → **Stripe is fully integrated!** 🎉

---

## Troubleshooting

**Button does nothing?**
→ Check browser console
→ Restart dev server after adding env vars

**Webhook not working?**
→ Make sure `stripe listen` is running in separate terminal
→ Check webhook secret matches

**Database not updating?**
→ Verify `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local`
→ Check webhook handler logs

---

**Need more help?** See `STRIPE_SETUP_GUIDE.md` for detailed instructions.
