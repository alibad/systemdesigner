import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('technology');
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return generateContentMetadata('technology', params.slug);
}

export default async function TechnologyContentPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <GeneralizedContentPage section="technology" slug={params.slug} />;
}
