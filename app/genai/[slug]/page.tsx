import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('genai');
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return generateContentMetadata('genai', params.slug);
}

export default async function GenAIContentPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <GeneralizedContentPage section="genai" slug={params.slug} />;
}
