import GeneralizedContentPage, {
  generateContentMetadata,
  generateContentStaticParams,
} from '@/components/content/GeneralizedContentPage';

export function generateStaticParams() {
  return generateContentStaticParams('case-studies');
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return generateContentMetadata('case-studies', params.slug);
}

export default function CaseStudyContentPage({ params }: { params: { slug: string } }) {
  return <GeneralizedContentPage section="case-studies" slug={params.slug} />;
}
