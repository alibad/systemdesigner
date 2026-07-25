import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('tools');
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return generateContentMetadata('tools', params.slug);
}

export default function ToolContentPage({ params }: { params: { slug: string } }) {
  return <GeneralizedContentPage section="tools" slug={params.slug} />;
}
