# TODO - Future Improvements

## Community Stories Page Performance Optimization

**Status**: Deferred (Low priority - current performance is acceptable)
**Date Added**: 2026-02-05
**Pages Affected**:
- `/stories` → `src/app/stories/page.tsx` (public version with LandingNav)
- `/community-stories` → `src/app/(dashboard)/community-stories/page.tsx` (dashboard version)

### Background

The My Stories page (`/projects`) has cache + prefetch + progress indicator optimizations. These could potentially be applied to the Community Stories pages, but there are additional complexities due to filter-based pagination.

### Current State

- Both pages are nearly identical (~450 lines, 99% duplicate code)
- Using `limit = 24` stories per page
- Have tag filtering, search, and sort options
- No client-side caching or prefetch

### Proposed Optimization Plan

#### 1. Cache Key Structure
Unlike My Stories (simple page-based cache), Community Stories needs a composite cache key that includes filter state:

```typescript
const getCacheKey = (sortBy: string, tags: string[], search: string, page: number) => {
  return `${sortBy}|${tags.sort().join(',')}|${search}|${page}`;
};

const pageCache = useRef<Map<string, { stories: PublicStory[], totalCount: number, totalPages: number, timestamp: number }>>(new Map());
```

#### 2. Prefetch Strategy
- Prefetch next page when current page loads
- Clear prefetch when filters change
- Use AbortController to cancel stale requests

```typescript
const prefetchNextPage = async (currentKey: string, nextPage: number) => {
  const nextKey = getCacheKey(sortBy, selectedTags, searchQuery, nextPage);
  if (pageCache.current.has(nextKey)) return;

  // Prefetch in background...
};
```

#### 3. Cache TTL
- Shorter TTL for public data (2-3 minutes) vs My Stories (5 minutes)
- Public data changes more frequently (new stories, view counts)

```typescript
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
```

#### 4. Progress Indicator
- Show loading progress for better UX on slower connections
- Same pattern as My Stories page

### Identified Risks

1. **Cache Key Mismatch**: Filter-based keys are more complex - need to ensure consistent key generation (e.g., sort tags before joining)

2. **Memory Bloat**: Many filter combinations could create many cache entries. Consider:
   - LRU eviction (keep only last N entries)
   - Clear cache when filter changes significantly

3. **Stale Data**: Public stories change more often (new stories, view counts). Shorter TTL or background refresh needed.

4. **Race Conditions**: Multiple filter changes in quick succession need proper abort handling.

5. **Duplicate Code Maintenance**: Two nearly identical pages - any optimization needs to be applied twice. Consider consolidating first.

### Recommendations Before Implementing

1. **Consolidate Duplicate Pages**: Consider creating a shared component/hook that both pages use. This reduces maintenance burden and ensures optimizations apply to both.

2. **Monitor Actual Performance**: If users aren't complaining about speed, this optimization may not be worth the complexity.

3. **Start Simple**: If implementing, start with just cache (no prefetch) and measure impact.

### Reference Implementation

See My Stories page for working cache + prefetch implementation:
- `src/app/(dashboard)/projects/page.tsx`
- Uses `PAGE_SIZE = 12`, `pageCache`, `prefetchNextPage`, progress indicator
