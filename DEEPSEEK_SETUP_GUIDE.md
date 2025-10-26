# DeepSeek API Setup Guide

## What is DeepSeek?

DeepSeek is a Chinese AI company that provides large language models optimized for Chinese language understanding. Their DeepSeek V3 model offers:

- **Native Chinese Language Support**: Better than GPT-4o for Chinese content generation
- **90% Cost Savings**: $0.28/M input tokens vs GPT-4o's $2.50/M
- **OpenAI-Compatible API**: Drop-in replacement, uses same SDK

---

## Step 1: Create DeepSeek Account

1. Visit **https://platform.deepseek.com/**
2. Click "Sign Up" or "Get Started" (注册)
3. Register with:
   - Email + Password, OR
   - GitHub OAuth, OR
   - Google OAuth

4. **Verify your email** if required

---

## Step 2: Add Credits (If Required)

DeepSeek may require you to add credits before using the API:

1. Go to **Account → Billing** (账户 → 计费)
2. Click "Add Credits" or "Recharge" (充值)
3. Minimum amount: Usually $5-10 USD
4. Payment methods:
   - Credit/Debit Card
   - Alipay (支付宝)
   - WeChat Pay (微信支付)

**Note**: Check if they offer free trial credits for new users.

---

## Step 3: Generate API Key

1. After login, navigate to **API Keys** section (usually in left sidebar)
   - URL: `https://platform.deepseek.com/api_keys`

2. Click **"Create API Key"** or **"+ New API Key"** button

3. Fill in details:
   - **Name**: `kindlewood-studio-production`
   - **Permissions**: Select "All" or "Read + Write"
   - **Expiration**: Set to "Never expire" or "1 year"

4. Click **"Create"** or **"Generate"**

5. **IMPORTANT**: Copy the API key immediately!
   - Format: `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - It will only be shown once
   - Store it securely (password manager recommended)

---

## Step 4: Add API Key to Your Project

### Local Development (`.env.local`)

1. Open your terminal
2. Navigate to the `storyme-app` directory:
   ```bash
   cd /home/gulbrand/Feifei/StoryMe/storyme-app
   ```

3. Create or edit `.env.local`:
   ```bash
   nano .env.local
   ```

4. Add the DeepSeek API key:
   ```bash
   # DeepSeek API (for Chinese story generation)
   DEEPSEEK_API_KEY=sk-your-actual-api-key-here
   ```

5. Save and exit (Ctrl+O, Enter, Ctrl+X)

6. Restart your development server:
   ```bash
   npm run dev
   ```

---

### Production (Vercel Environment Variables)

1. Go to **Vercel Dashboard**: https://vercel.com/dashboard

2. Select your project: **storyme-app** or **kindlewood-studio**

3. Go to **Settings** → **Environment Variables**

4. Click **"Add New"** button

5. Fill in the form:
   - **Name**: `DEEPSEEK_API_KEY`
   - **Value**: `sk-your-actual-api-key-here` (paste your API key)
   - **Environments**: Check all three:
     - ☑ Production
     - ☑ Preview
     - ☑ Development

6. Click **"Save"**

7. **Redeploy your application**:
   - Go to **Deployments** tab
   - Click **"..."** menu on latest deployment
   - Click **"Redeploy"**
   - Or push a new commit to trigger automatic deployment

---

## Step 5: Verify API Key Works

### Option 1: Test with curl (Command Line)

Run this command in your terminal:

```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "system", "content": "你是一个专业的儿童故事作家。"},
      {"role": "user", "content": "请为3-5岁儿童写一个关于小兔子找朋友的简短场景描述。"}
    ],
    "temperature": 0.7
  }'
```

**Expected Response** (Success):
```json
{
  "id": "chatcmpl-xxxxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepseek-chat",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "小兔子蹦蹦跳跳地穿过绿色的草地，它看到一只小松鼠在树上玩耍..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 50,
    "total_tokens": 75
  }
}
```

**Common Errors**:
- **401 Unauthorized**: API key is incorrect or missing
- **403 Forbidden**: Account not activated or insufficient credits
- **429 Too Many Requests**: Rate limit exceeded (upgrade plan or wait)
- **503 Service Unavailable**: DeepSeek API is down (temporary)

---

### Option 2: Test in Your Application

After adding the API key, test it in your StoryMe app:

1. Start your dev server:
   ```bash
   cd /home/gulbrand/Feifei/StoryMe/storyme-app
   npm run dev
   ```

2. Open http://localhost:3002 (or your configured port)

3. Create a new story:
   - Add a character
   - Select **"Chinese Story / 中文故事"** 🇨🇳
   - Write a scene in Chinese: `小兔子在森林里找朋友`
   - Click **"Enhance Scenes"**

4. Check the console logs:
   ```
   Enhancing 1 scenes with reading level 5, playful tone, and zh language
   Using DeepSeek V3 for Chinese content generation...
   ✓ Enhanced 1 scenes successfully
   ```

5. If successful, you'll see Chinese captions generated by DeepSeek!

---

## Step 6: Monitor Usage and Costs

### View API Usage
1. Go to https://platform.deepseek.com/usage
2. View metrics:
   - Total tokens used
   - Cost breakdown by date
   - Requests per second

### Set Spending Limits (Recommended)
1. Go to **Account → Billing → Spending Limits**
2. Set a monthly budget (e.g., $50/month)
3. Enable alerts at 50%, 75%, and 90% of budget

---

## Pricing Information (as of October 2025)

**DeepSeek V3 Model**:
- Input: **$0.28 per 1M tokens**
- Output: **$1.10 per 1M tokens** (verify on their website)
- Cache hits: **Free**

**Example Cost Calculation** (15-scene story):
```
Input tokens:  2,000 tokens × $0.28/M = $0.00056
Output tokens: 4,000 tokens × $1.10/M = $0.00440
Total:         $0.00496 ≈ $0.005 per story
```

Compare to GPT-4o:
```
Input tokens:  1,500 tokens × $2.50/M = $0.00375
Output tokens: 3,000 tokens × $10.00/M = $0.03000
Total:         $0.03375 ≈ $0.034 per story
```

**Savings**: ~85% cost reduction for Chinese stories! 🎉

---

## Troubleshooting

### Error: "API key is invalid"
- **Solution**: Double-check you copied the entire key (starts with `sk-`)
- Regenerate a new key if needed

### Error: "Insufficient credits"
- **Solution**: Add credits to your DeepSeek account
- Check balance at https://platform.deepseek.com/billing

### Error: "Model not found"
- **Solution**: Ensure you're using `"model": "deepseek-chat"` (not "deepseek-v3")
- Check their docs for correct model name

### API is slow or times out
- **Solution**: DeepSeek servers are in China, expect 1-3 second latency from US/Europe
- Increase timeout in your API calls to 30-60 seconds

### Chinese characters display as "???"
- **Solution**: Ensure your database/terminal supports UTF-8 encoding
- Set `Content-Type: application/json; charset=utf-8` in HTTP headers

---

## Fallback Strategy (Recommended)

If DeepSeek API fails, your app should automatically fall back to GPT-4o:

```typescript
// In enhance-scenes/route.ts
try {
  const client = language === 'zh' ? deepseek : openai;
  const model = language === 'zh' ? 'deepseek-chat' : 'gpt-4o';

  const completion = await client.chat.completions.create({...});
} catch (error) {
  if (language === 'zh') {
    console.warn('DeepSeek failed, falling back to GPT-4o for Chinese');
    // Retry with OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [...] // Same Chinese prompt
    });
  }
}
```

---

## Support & Documentation

- **Official Docs**: https://platform.deepseek.com/docs
- **API Reference**: https://platform.deepseek.com/api-docs
- **Status Page**: https://status.deepseek.com
- **Support Email**: support@deepseek.com (check their website for current contact)

---

## Security Best Practices

1. ✅ **Never commit API keys** to Git/GitHub
2. ✅ **Use environment variables** (`.env.local`, Vercel)
3. ✅ **Rotate keys** every 3-6 months
4. ✅ **Set spending limits** to prevent unexpected charges
5. ✅ **Monitor usage** regularly for anomalies
6. ✅ **Revoke unused keys** immediately

---

## Next Steps

After setting up DeepSeek:

1. ✅ Run the database migration: `20251025_add_bilingual_support.sql`
2. ✅ Test the language selection UI in Studio
3. ⏳ Implement backend API updates (enhance-scenes, generate-cover, etc.)
4. ⏳ Test end-to-end Chinese story creation
5. ⏳ Deploy to production

---

**Need help?** Contact the KindleWood Studio development team or refer to the main implementation summary in `IMPLEMENTATION_SUMMARY.md`.
