import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Public runtime configuration.
 *
 * The browser needs the Supabase URL and anon key to sign users in, but
 * `NEXT_PUBLIC_*` values are inlined at BUILD time — and the production Docker
 * build does not receive them. Serving them at runtime keeps the built image
 * environment-agnostic and lets auth work without a rebuild-time env.
 *
 * Both values are public by design (the anon key is shipped to every browser);
 * row-level security is what protects the data.
 */
export async function GET() {
  return NextResponse.json(
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
