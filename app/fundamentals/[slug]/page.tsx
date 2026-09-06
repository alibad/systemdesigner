import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('fundamentals');
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return generateContentMetadata('fundamentals', params.slug);
}

export default async function FundamentalsContentPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <GeneralizedContentPage section="fundamentals" slug={params.slug} />;
}
