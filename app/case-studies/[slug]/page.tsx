import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('case-studies');
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return generateContentMetadata('case-studies', params.slug);
}

export default async function CaseStudyContentPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <GeneralizedContentPage section="case-studies" slug={params.slug} />;
}
