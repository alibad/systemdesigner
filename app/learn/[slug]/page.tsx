import { notFound } from 'next/navigation';

// Nothing is served at /learn/<slug>: sessions open inside /learn. Answer a real 404 instead of an
// empty page, which search engines report as a soft 404.
export default function LessonPage() {
  notFound();
}
