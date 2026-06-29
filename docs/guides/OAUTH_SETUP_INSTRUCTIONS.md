# OAuth Setup Instructions for StoryMe

Follow these instructions to set up OAuth authentication with Google, Microsoft, and Facebook.

## Prerequisites
- Supabase project (you already have this)
- Access to Google Cloud Console, Microsoft Azure Portal, Facebook Developers

---

## 1. Google OAuth Setup

### Step 1: Create OAuth App
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure consent screen if prompted:
   - User Type: **External**
   - App name: **StoryMe**
   - User support email: Your email
   - Authorized domains: Add your domain
   - Developer contact: Your email

### Step 2: Configure OAuth Client
- Application type: **Web application**
- Name: **StoryMe Web App**
- Authorized JavaScript origins:
  ```
  http://localhost:3005
  https://your-production-domain.com
  ```
- Authorized redirect URIs:
  ```
  http://localhost:3005/auth/callback
  https://your-production-domain.com/auth/callback
  https://your-supabase-project.supabase.co/auth/v1/callback
  ```

### Step 3: Get Credentials
- Copy **Client ID** and **Client Secret**
- Save for Supabase configuration

---

## 2. Microsoft OAuth Setup

### Step 1: Register App
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
   - Name: **StoryMe**
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI:
     - Platform: **Web**
     - URI: `https://your-supabase-project.supabase.co/auth/v1/callback`

### Step 2: Configure Authentication
1. Go to **Authentication** in left sidebar
2. Add additional redirect URIs:
   ```
   http://localhost:3005/auth/callback
   https://your-production-domain.com/auth/callback
   ```
3. Under **Implicit grant and hybrid flows**, enable:
   - ✅ ID tokens

### Step 3: Create Client Secret
1. Go to **Certificates & secrets**
2. Click **New client secret**
   - Description: **StoryMe Web App**
   - Expires: **24 months** (or as needed)
3. Copy the secret **immediately** (it won't be shown again)

### Step 4: Get Application ID
1. Go to **Overview**
2. Copy **Application (client) ID**
3. Copy **Directory (tenant) ID**

---

## 3. Facebook OAuth Setup

### Step 1: Create App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Choose **Consumer** as app type
4. App Display Name: **StoryMe**
5. App Contact Email: Your email

### Step 2: Add Facebook Login
1. In app dashboard, click **Add Product**
2. Find **Facebook Login** → Click **Set Up**
3. Choose **Web** platform
4. Site URL: `https://your-production-domain.com`

### Step 3: Configure OAuth Settings
1. Go to **Facebook Login** → **Settings**
2. Valid OAuth Redirect URIs:
   ```
   http://localhost:3005/auth/callback
   https://your-production-domain.com/auth/callback
   https://your-supabase-project.supabase.co/auth/v1/callback
   ```
3. Save changes

### Step 4: Get App Credentials
1. Go to **Settings** → **Basic**
2. Copy **App ID**
3. Click **Show** on **App Secret** and copy it

### Step 5: Make App Public
1. Toggle app status from **Development** to **Live**
2. Add Privacy Policy URL (required for live apps)

---

## 4. Configure Supabase

### Step 1: Add Providers in Supabase Dashboard
1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** → **Providers**

### Step 2: Enable Google
1. Find **Google** in the list
2. Toggle **Enable Sign in with Google**
3. Enter:
   - **Client ID**: (from Google Cloud Console)
   - **Client Secret**: (from Google Cloud Console)
4. Copy the **Callback URL** shown (for your redirect URIs)
5. Save

### Step 3: Enable Microsoft
1. Find **Azure** in the list
2. Toggle **Enable Sign in with Azure**
3. Enter:
   - **Client ID**: (Application ID from Azure)
   - **Client Secret**: (from Azure)
   - **Azure Tenant**: (Directory ID from Azure, or "common" for personal accounts)
4. Save

### Step 4: Enable Facebook
1. Find **Facebook** in the list
2. Toggle **Enable Sign in with Facebook**
3. Enter:
   - **Client ID**: (App ID from Facebook)
   - **Client Secret**: (App Secret from Facebook)
4. Save

---

## 5. Environment Variables

Add these to your `.env.local` file:

```env
# Supabase (you already have these)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# The OAuth redirect URL (for reference)
NEXT_PUBLIC_SITE_URL=http://localhost:3005
```

**Note**: Supabase handles OAuth credentials internally, so you don't need to add provider keys to your `.env.local`.

---

## 6. Testing OAuth Flow

### Local Testing:
1. Start your dev server: `npm run dev`
2. Navigate to login page
3. Click "Continue with Google/Microsoft/Facebook"
4. Complete OAuth flow
5. Verify you're redirected back and logged in

### Production Testing:
1. Update all redirect URIs to use your production domain
2. Deploy to Vercel
3. Test each OAuth provider
4. Verify sessions persist correctly

---

## Troubleshooting

### Common Issues:

**"Redirect URI mismatch"**
- Verify all redirect URIs are added to OAuth provider settings
- Check for trailing slashes (some providers are strict)
- Ensure protocol matches (http vs https)

**"OAuth provider not configured"**
- Verify Supabase provider is enabled
- Check credentials are entered correctly
- Look for typos in Client ID/Secret

**"Invalid client"**
- Microsoft: Check tenant ID is correct ("common" for personal accounts)
- Facebook: Ensure app is in Live mode (not Development)
- Google: Verify OAuth consent screen is published

**Session not persisting**
- Check Supabase session configuration
- Verify cookies are enabled in browser
- Check redirect URL after OAuth callback

---

## Security Best Practices

1. **Keep secrets secure**: Never commit OAuth secrets to git
2. **Use environment variables**: Store credentials in Vercel environment variables for production
3. **Restrict redirect URIs**: Only add domains you control
4. **Enable HTTPS**: Always use HTTPS in production
5. **Rotate secrets**: Periodically rotate OAuth client secrets

---

## Next Steps After Setup

Once OAuth is configured:
1. Test each provider in local development
2. Add environment variables to Vercel
3. Test in production
4. Monitor auth logs in Supabase dashboard
5. Set up error tracking for auth failures

---

## Support Links

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft OAuth Setup](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Facebook OAuth Setup](https://developers.facebook.com/docs/facebook-login/web)
