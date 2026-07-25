import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('ml-systems');
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return generateContentMetadata('ml-systems', params.slug);
}

export default function MLSystemsContentPage({ params }: { params: { slug: string } }) {
  return <GeneralizedContentPage section="ml-systems" slug={params.slug} />;
}
