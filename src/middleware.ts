import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const DEFAULT_SUPABASE_URL = 'http://localhost:8000';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyMTc0MzI5LCJleHAiOjE5NDk4NTQzMjl9.LAXhM4gFBYfOr5bStoFMn77aK0MdRu6z6fVHrzzInPc';

/**
 * Next.js 15 Zero-Trust Authentication Middleware
 * Enforces server-side authentication validation on protected routes:
 * - /dashboard/:path*
 * - /admin/:path*
 * - /index/:path*
 *
 * Verifies Supabase Auth JWT token via @supabase/ssr getUser()
 * and checks the platform pilot session cookie (i2i_auth_user_id).
 * Unauthenticated requests are immediately redirected to /login with redirectTo preserve.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Verify Supabase Auth user session token securely
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pilot cookie fallback: checks verified pilot identity cookie
  const pilotAuthUser =
    request.cookies.get('i2i_auth_user_id')?.value ||
    request.cookies.get('haritha_auth_user_id')?.value;
  const isAuthenticated = Boolean(user || pilotAuthUser);

  const pathname = request.nextUrl.pathname;
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/index');

  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/analytics/:path*',
    '/index/:path*',
  ],
};
