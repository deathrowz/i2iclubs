import { Club, UserProfile } from '@/types/domain';
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
let usersHydrated = false;

const SEED_KEY = 'clubs_seeded';
const USERS_SEED_KEY = 'users_seeded';

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


/* --------------------------------------------------------------------------
 * USER PROFILES
 * ------------------------------------------------------------------------ */

/**
 * Loads profiles from Postgres, seeding once from the built-in personas.
 * Also re-applies club membership so a hydrated user carries their club.
 */
export async function ensureUsersHydrated(): Promise<void> {
  if (usersHydrated) return;

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    usersHydrated = true;
    return;
  }

  const store = getPlatformStore();

  try {
    const { data: marker, error: markerError } = await supabase
      .from('platform_meta')
      .select('value')
      .eq('key', USERS_SEED_KEY)
      .maybeSingle();

    if (markerError) throw markerError;

    if (!marker) {
      const rows = store.users.map((user) => ({ id: user.id, data: user }));
      if (rows.length > 0) {
        const { error: seedError } = await supabase
          .from('users_store')
          .upsert(rows, { onConflict: 'id' });
        if (seedError) throw seedError;
      }
      await supabase
        .from('platform_meta')
        .upsert({ key: USERS_SEED_KEY, value: new Date().toISOString() }, { onConflict: 'key' });
    }

    const { data: userRows, error: usersError } = await supabase.from('users_store').select('data');
    if (usersError) throw usersError;
    if (Array.isArray(userRows) && userRows.length > 0) {
      store.users = userRows.map((row: { data: UserProfile }) => row.data);
    }

    usersHydrated = true;
  } catch (err) {
    console.warn('[users] hydration failed, continuing from memory:', err);
    usersHydrated = true;
  }
}

export async function saveUser(user: UserProfile): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('users_store')
      .upsert({ id: user.id, data: user, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) console.warn('[users] save failed:', error.message);
  } catch (err) {
    console.warn('[users] save threw:', err);
  }
}

export async function deleteUserRow(userId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  try {
    await supabase.from('club_members').delete().eq('user_id', userId);
    const { error } = await supabase.from('users_store').delete().eq('id', userId);
    if (error) console.warn('[users] delete failed:', error.message);
  } catch (err) {
    console.warn('[users] delete threw:', err);
  }
}

/** Hydrates every durable slice of the platform store. */
export async function ensureStoreHydrated(): Promise<void> {
  await ensureClubsHydrated();
  await ensureUsersHydrated();
}

export function invalidateUserCache(): void {
  usersHydrated = false;
}
