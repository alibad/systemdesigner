import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="6" r="2" stroke="#0ea5e9" strokeWidth="1.8" />
                <circle cx="18" cy="6" r="2" stroke="#0ea5e9" strokeWidth="1.8" />
                <circle cx="12" cy="18" r="2" stroke="#0ea5e9" strokeWidth="1.8" />
                <path d="M8 7.5 L12 16 M16 7.5 L12 16" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M8 6h8" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="text-xl font-bold text-white">
                System Designer
              </span>
            </Link>
            <p className="text-sm text-gray-400 max-w-md">
              Teaching engineers to think like senior engineers. Master design mode thinking and pass L5+ interviews.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <div className="space-y-2">
              <Link href={"/features" as any} className="block hover:text-white transition-colors">
                Features
              </Link>
              <Link href={"/pricing" as any} className="block hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href={"/about" as any} className="block hover:text-white transition-colors">
                About
              </Link>
            </div>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-white font-semibold mb-4">Get Started</h3>
            <div className="space-y-2">
              <Link href={`${APP_URL}/signup` as any} className="block hover:text-white transition-colors">
                Sign Up
              </Link>
              <Link href={`${APP_URL}/login` as any} className="block hover:text-white transition-colors">
                Login
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 pt-8 text-center md:text-left">
          <p className="text-sm">
            © 2025 System Designer. Teaching engineers to think like senior engineers.
          </p>
        </div>
      </div>
    </footer>
  );
}
