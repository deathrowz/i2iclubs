import { NextRequest, NextResponse } from 'next/server';
import { AuthError, requireSuperAdmin } from '@/lib/auth/guards';
import { saveClub } from '@/lib/store/club-repository';
import { getPlatformStore, updateSchoolClub } from '@/lib/store/platform-store';
import { getSupabasePublicUrl, getSupabaseServiceClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const BUCKET = 'school-logos';
const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/** Public URL of an object in the logo bucket, reachable from a browser. */
function publicUrlFor(objectName: string): string {
  return `${getSupabasePublicUrl()}/storage/v1/object/public/${BUCKET}/${objectName}`;
}

/** The bucket is created on first upload so a fresh deployment needs no setup. */
async function ensureBucket(supabase: ReturnType<typeof getSupabaseServiceClient>) {
  if (!supabase) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(ALLOWED_TYPES),
  });
  // "already exists" is the normal path after the first upload.
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Could not prepare logo storage: ${error.message}`);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await ctx.params;

    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: 'File storage is not configured on this deployment.' },
        { status: 503 }
      );
    }

    const club = getPlatformStore().clubs.find((c) => c.id === id);
    if (!club) {
      return NextResponse.json({ ok: false, error: 'Club not found.' }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get('logo');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Choose an image to upload.' }, { status: 400 });
    }

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) {
      return NextResponse.json(
        { ok: false, error: 'Use a PNG, JPG, WebP or SVG file.' },
        { status: 415 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'Images must be 2 MB or smaller.' }, { status: 413 });
    }

    await ensureBucket(supabase);

    // Timestamped name so a replacement is never served from cache.
    const objectName = `${club.school_code.toLowerCase()}-${Date.now()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectName, bytes, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: `Upload failed: ${uploadError.message}` },
        { status: 502 }
      );
    }

    const logoUrl = publicUrlFor(objectName);
    const updated = updateSchoolClub(id, { logoUrl });
    await saveClub(updated);

    // Drop the file this one replaces; failures here must not undo the upload.
    if (club.logo_url && club.logo_url.includes(`/${BUCKET}/`)) {
      const previous = club.logo_url.split(`/${BUCKET}/`)[1];
      if (previous && previous !== objectName) {
        await supabase.storage.from(BUCKET).remove([previous]).catch(() => undefined);
      }
    }

    return NextResponse.json({ ok: true, logoUrl, uploadedBy: actor.email });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 422;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Could not save that logo' },
      { status }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await ctx.params;

    const club = getPlatformStore().clubs.find((c) => c.id === id);
    if (!club) {
      return NextResponse.json({ ok: false, error: 'Club not found.' }, { status: 404 });
    }

    const existing = club.logo_url;
    const updated = updateSchoolClub(id, { logoUrl: null });
    await saveClub(updated);

    const supabase = getSupabaseServiceClient();
    if (supabase && existing && existing.includes(`/${BUCKET}/`)) {
      const objectName = existing.split(`/${BUCKET}/`)[1];
      if (objectName) await supabase.storage.from(BUCKET).remove([objectName]).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 422;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Could not remove that logo' },
      { status }
    );
  }
}
