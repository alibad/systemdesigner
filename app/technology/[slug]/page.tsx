import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('technology');
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return generateContentMetadata('technology', params.slug);
}

export default function TechnologyContentPage({ params }: { params: { slug: string } }) {
  return <GeneralizedContentPage section="technology" slug={params.slug} />;
}
