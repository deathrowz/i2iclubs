import { Club } from '@/types/domain';
import { getPlatformStore } from '@/lib/store/platform-store';
import { getSupabaseServiceClient } from '@/lib/supabase/client';

/**
 * Durable storage for clubs and their membership.
 *
 * The in-memory platform store stays the read path used by the UI; this module
 * keeps Postgres in step and rehydrates memory on first admin request after a
 * restart. Without a service key it degrades to memory-only, which is what the
 * static build and local development rely on.
 */

let hydrated = false;

const SEED_KEY = 'clubs_seeded';

export function isClubStorageEnabled(): boolean {
  return Boolean(getSupabaseServiceClient());
}

/**
 * Loads clubs and memberships from Postgres into the in-memory store, seeding
 * the table from the built-in clubs the first time it runs.
 */
export async function ensureClubsHydrated(): Promise<void> {
  if (hydrated) return;

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    hydrated = true;
    return;
  }

  const store = getPlatformStore();

  try {
    const { data: marker, error: markerError } = await supabase
      .from('platform_meta')
      .select('value')
      .eq('key', SEED_KEY)
      .maybeSingle();

    if (markerError) throw markerError;

    if (!marker) {
      // First run on this database: copy the built-in clubs across once.
      const rows = store.clubs.map((club) => ({ id: club.id, data: club }));
      if (rows.length > 0) {
        const { error: seedError } = await supabase
          .from('clubs_store')
          .upsert(rows, { onConflict: 'id' });
        if (seedError) throw seedError;
      }
      await supabase
        .from('platform_meta')
        .upsert({ key: SEED_KEY, value: new Date().toISOString() }, { onConflict: 'key' });
    }

    const { data: clubRows, error: clubsError } = await supabase.from('clubs_store').select('data');
    if (clubsError) throw clubsError;
    if (Array.isArray(clubRows) && clubRows.length > 0) {
      store.clubs = clubRows.map((row: { data: Club }) => row.data);
    }

    const { data: memberRows, error: membersError } = await supabase
      .from('club_members')
      .select('user_id, club_id');
    if (membersError) throw membersError;

    if (Array.isArray(memberRows)) {
      const assignments = new Map<string, string | null>(
        memberRows.map((row: { user_id: string; club_id: string | null }) => [row.user_id, row.club_id])
      );

      for (const user of store.users) {
        if (!assignments.has(user.id)) continue;
        const clubId = assignments.get(user.id) ?? null;
        const club = clubId ? store.clubs.find((c) => c.id === clubId) : null;
        user.club_id = club?.id ?? null;
        user.club_name = club?.name;
        if (club) {
          user.school_id = club.school_id;
          user.school_name = club.school_name;
          user.school_code = club.school_code;
        }
      }

      for (const club of store.clubs) {
        club.active_members_count = store.users.filter((u) => u.club_id === club.id).length;
      }
    }

    hydrated = true;
  } catch (err) {
    console.warn('[clubs] hydration failed, continuing from memory:', err);
    hydrated = true;
  }
}

/** Resets the hydration flag — used when the caller wants a fresh read. */
export function invalidateClubCache(): void {
  hydrated = false;
}

export async function saveClub(club: Club): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('clubs_store')
      .upsert({ id: club.id, data: club, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) console.warn('[clubs] save failed:', error.message);
  } catch (err) {
    console.warn('[clubs] save threw:', err);
  }
}

export async function deleteClubRow(clubId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  try {
    const { error: memberError } = await supabase.from('club_members').delete().eq('club_id', clubId);
    if (memberError) console.warn('[clubs] membership cleanup failed:', memberError.message);

    const { error } = await supabase.from('clubs_store').delete().eq('id', clubId);
    if (error) console.warn('[clubs] delete failed:', error.message);
  } catch (err) {
    console.warn('[clubs] delete threw:', err);
  }
}

export async function saveMembership(userId: string, clubId: string | null): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('club_members')
      .upsert(
        { user_id: userId, club_id: clubId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (error) console.warn('[clubs] membership save failed:', error.message);
  } catch (err) {
    console.warn('[clubs] membership save threw:', err);
  }
}
