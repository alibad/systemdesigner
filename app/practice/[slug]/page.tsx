import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('practice');
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return generateContentMetadata('practice', params.slug);
}

export default function PracticeContentPage({ params }: { params: { slug: string } }) {
  return <GeneralizedContentPage section="practice" slug={params.slug} />;
}
