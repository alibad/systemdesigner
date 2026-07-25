export default function AppGlyph({ size = 18, className }: { size?: number; className?: string }) {
  const props = className ? { className } as any : { width: size, height: size } as any;
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7.5 L12 16 M16 7.5 L12 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}


