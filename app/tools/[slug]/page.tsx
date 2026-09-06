import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('tools');
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return generateContentMetadata('tools', params.slug);
}

export default async function ToolContentPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <GeneralizedContentPage section="tools" slug={params.slug} />;
}
