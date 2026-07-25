import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('reference');
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return generateContentMetadata('reference', params.slug);
}

export default function ReferenceContentPage({ params }: { params: { slug: string } }) {
  return <GeneralizedContentPage section="reference" slug={params.slug} />;
}
