import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('genai');
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return generateContentMetadata('genai', params.slug);
}

export default function GenAIContentPage({ params }: { params: { slug: string } }) {
  return <GeneralizedContentPage section="genai" slug={params.slug} />;
}
