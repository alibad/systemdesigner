import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('fundamentals');
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return generateContentMetadata('fundamentals', params.slug);
}

export default function FundamentalsContentPage({ params }: { params: { slug: string } }) {
  return <GeneralizedContentPage section="fundamentals" slug={params.slug} />;
}
