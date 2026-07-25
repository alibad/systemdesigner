import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // For admin routes, we'll rely on client-side protection
  // since Firebase auth tokens are handled client-side
  // The actual security is enforced in the component with useAuth
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
}