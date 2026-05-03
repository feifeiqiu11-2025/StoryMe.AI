/**
 * Shared book-cover tiles used by the landing page and the products page.
 * Keeping a single source so artwork / titles / "coming soon" flags stay in sync.
 */

export type BookTile = {
  key: string;
  title: string;
  image: string | null;
  comingSoon?: boolean;
  tilt: string;
  chipColor: string;
};

export const BOOK_TILES: readonly BookTile[] = [
  {
    key: 'picture',
    title: 'Picture Books',
    image: '/images/book-picture.jpg',
    tilt: '-rotate-2',
    chipColor: 'bg-purple-600',
  },
  {
    key: 'coloring',
    title: 'Coloring Books',
    image: '/images/book-coloring.jpg',
    tilt: 'rotate-1',
    chipColor: 'bg-pink-500',
  },
  {
    key: 'chapter',
    title: 'Chapter Books',
    image: '/images/book-chapter.jpg',
    comingSoon: true,
    tilt: '-rotate-1',
    chipColor: 'bg-amber-500',
  },
  {
    key: 'photo',
    title: 'Photo Storybooks',
    image: '/images/book-photo.jpg',
    tilt: 'rotate-2',
    chipColor: 'bg-emerald-600',
  },
];
