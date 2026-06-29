# How to Rename the Podcast

**Current Name**: KindleWood Stories
**Difficulty**: Easy (5 minutes)
**Impact**: Changes appear on Spotify within 1-6 hours

---

## Step 1: Update RSS Feed Metadata

**File**: `src/app/api/podcast/feed.xml/route.ts`

Find the `generatePodcastRSS()` function and update:

```typescript
function generatePodcastRSS(publications: any[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" ...>
      <channel>
        <!-- CHANGE THESE -->
        <title>Your New Podcast Name</title>
        <description>Your new podcast description...</description>
        <itunes:author>Your Author Name</itunes:author>
        <itunes:title>Your New Podcast Name</itunes:title>
        <itunes:summary>Your new podcast summary...</itunes:summary>

        <!-- Keep these the same -->
        <language>en-us</language>
        <link>https://kindlewood.com</link>
        <itunes:category text="Kids &amp; Family"/>
        ...
      </channel>
    </rss>`;
}
```

---

## Step 2: Update User-Facing Messages

### File 1: `src/app/api/projects/[id]/publish-spotify/route.ts`

Find the success message:

```typescript
return NextResponse.json({
  success: true,
  message: 'Your story has been published to [NEW NAME]!',  // ← Update
  publicationId: newPublication.id,
});
```

### File 2: `src/app/(dashboard)/projects/[id]/page.tsx`

Find the confirmation dialog:

```typescript
const confirmed = confirm(
  'Publish to Spotify?\n\n' +
  'Your story will be published as an episode on [NEW NAME]. ' +  // ← Update
  'It will appear on Spotify within 1-6 hours.\n\n' +
  'Make sure you have generated audio for all scenes first.\n\n' +
  'Continue?'
);
```

And the success alert:

```typescript
alert(`✅ ${data.message}`);  // Uses API response, already updated
```

---

## Step 3: Deploy Changes

```bash
cd /home/gulbrand/Feifei/StoryMe/storyme-app
git add .
git commit -m "Rename podcast to [NEW NAME]"
vercel --prod
```

---

## Step 4: Wait for Spotify to Update

- **Timeline**: 1-6 hours (next time Spotify polls your RSS feed)
- **What Updates**: Podcast name, description, author in Spotify app
- **What Stays Same**: All existing episodes, subscriber count, RSS feed URL

---

## Optional: Update Podcast Cover Art

If rebranding completely:

1. Create new 3000x3000px cover art with new podcast name
2. Replace: `storyme-app/public/podcast-cover-art.jpg`
3. Update RSS feed to reference new image:
   ```typescript
   <itunes:image href="https://yourdomain.com/podcast-cover-art-new.jpg"/>
   ```
4. Deploy changes
5. Spotify updates cover art within 1-6 hours

---

## Example Rename Scenarios

### Scenario 1: Minor Tweak
**From**: "KindleWood Stories"
**To**: "KindleWood Tales"
**Why**: Sounds more magical/storytelling-focused

### Scenario 2: Add "Kids" Branding
**From**: "KindleWood Stories"
**To**: "KindleWood Kids Stories"
**Why**: Clearer target audience for parents

### Scenario 3: Emphasize User-Generated
**From**: "KindleWood Stories"
**To**: "Stories by KindleWood Kids"
**Why**: Highlights that kids create the stories

### Scenario 4: Broader Appeal
**From**: "KindleWood Stories"
**To**: "The KindleWood Podcast"
**Why**: Room to expand beyond just stories (interviews, tips, etc.)

---

## What NOT to Change

Keep these the same to avoid breaking existing setup:

- ✅ **RSS Feed URL**: `/api/podcast/feed.xml` (Spotify knows this URL)
- ✅ **Database Structure**: `publications` table, `platform='spotify'`
- ✅ **Spotify Account**: Keep same podcasters.spotify.com account
- ✅ **GUID Format**: `spotify-story-{projectId}` (uniquely identifies episodes)

---

## Frequently Asked Questions

**Q: Will subscribers be notified of the name change?**
A: No automatic notification. The name just updates in their Spotify app.

**Q: Do I need to re-submit to Spotify for approval?**
A: No! Name changes via RSS feed are automatic.

**Q: Will existing episodes disappear?**
A: No, all episodes stay. Only the podcast name/description changes.

**Q: Can I change it multiple times?**
A: Yes, but avoid frequent changes (confuses subscribers). Pick a good name and stick with it.

**Q: Will the RSS feed URL change?**
A: No, URL stays the same: `https://yourdomain.com/api/podcast/feed.xml`

**Q: What if I want a completely different podcast?**
A: Create a new RSS feed endpoint and submit as a separate podcast to Spotify.

---

## Rollback (If You Change Your Mind)

Just revert the code changes and redeploy:

```bash
git revert HEAD
vercel --prod
```

Spotify will pick up the old name within 1-6 hours.

---

## Current Name References (Search These)

To find all instances of the current podcast name:

```bash
cd /home/gulbrand/Feifei/StoryMe/storyme-app
grep -r "KindleWood Stories" src/
grep -r "KindleWood podcast" src/
```

**Files to Update**:
1. `src/app/api/podcast/feed.xml/route.ts` (RSS feed metadata)
2. `src/app/api/projects/[id]/publish-spotify/route.ts` (success message)
3. `src/app/(dashboard)/projects/[id]/page.tsx` (confirmation dialog)

---

## Best Practices

1. **Choose Once**: Pick a name you'll keep for at least 6-12 months
2. **Test Locally**: Update code, test RSS feed at `http://localhost:3002/api/podcast/feed.xml`
3. **Validate RSS**: Use https://castfeedvalidator.com/ to ensure still valid
4. **Deploy Off-Peak**: Change during low-traffic hours
5. **Monitor**: Check Spotify after 6 hours to confirm changes appeared

---

## Timeline

| Action | Time Required |
|--------|---------------|
| Update code | 5 minutes |
| Deploy to production | 2 minutes |
| Spotify polls RSS feed | 1-6 hours (automatic) |
| Name appears on Spotify | Immediately after poll |
| All users see new name | Next time they open Spotify |

---

**Bottom Line**: Renaming is easy, safe, and reversible. Don't stress about the name now - you can always change it later! 🎙️
