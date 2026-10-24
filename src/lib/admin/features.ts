import { createServiceSupabase } from '@/lib/supabase/server';

export interface PlatformFeatures {
  whatsappIngestion: boolean;
  studentUploads: boolean;
  expertScoring: boolean;
  publicLeaderboard: boolean;
  autoAuditSampling: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export const FEATURE_LABELS: Record<keyof Omit<PlatformFeatures, 'updatedAt' | 'updatedBy'>, {
  label: string;
  description: string;
}> = {
  whatsappIngestion: {
    label: 'WhatsApp submissions',
    description: 'Accept activity evidence sent in through the club WhatsApp channel.',
  },
  studentUploads: {
    label: 'Student web uploads',
    description: 'Allow students to log activities directly from the club dashboard.',
  },
  expertScoring: {
    label: 'Expert panel scoring',
    description: 'Let the national panel score large transactions and run random audits.',
  },
  publicLeaderboard: {
    label: 'Public leaderboard',
    description: 'Show the cross-school rankings to signed-out visitors.',
  },
  autoAuditSampling: {
    label: 'Random 10% audits',
    description: 'Automatically sample approved small transactions for expert review.',
  },
};

const DEFAULTS: PlatformFeatures = {
  whatsappIngestion: true,
  studentUploads: true,
  expertScoring: true,
  publicLeaderboard: true,
  autoAuditSampling: true,
  updatedAt: new Date(0).toISOString(),
};

const globalForFeatures = globalThis as unknown as {
  __I2I_PLATFORM_FEATURES__?: PlatformFeatures;
};

export function getFeatures(): PlatformFeatures {
  if (!globalForFeatures.__I2I_PLATFORM_FEATURES__) {
    globalForFeatures.__I2I_PLATFORM_FEATURES__ = { ...DEFAULTS };
  }
  return globalForFeatures.__I2I_PLATFORM_FEATURES__;
}

/**
 * Persists the feature set. Writes to Supabase when a service key is
 * configured and the `platform_features` table exists; the in-memory copy is
 * authoritative for the running process either way.
 */
export async function updateFeatures(
  patch: Partial<PlatformFeatures>,
  updatedBy: string
): Promise<PlatformFeatures> {
  const current = getFeatures();
  const next: PlatformFeatures = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  globalForFeatures.__I2I_PLATFORM_FEATURES__ = next;

  const supabase = createServiceSupabase();
  if (supabase) {
    try {
      await supabase.from('platform_features').upsert({
        id: 1,
        features: next,
        updated_at: next.updatedAt,
        updated_by: updatedBy,
      });
    } catch {
      // Table not migrated yet — in-memory state still applies.
    }
  }

  return next;
}

/** Reads persisted features on first use of a fresh process. */
export async function hydrateFeatures(): Promise<PlatformFeatures> {
  const current = getFeatures();
  if (current.updatedAt !== DEFAULTS.updatedAt) return current;

  const supabase = createServiceSupabase();
  if (!supabase) return current;

  try {
    const { data } = await supabase
      .from('platform_features')
      .select('features')
      .eq('id', 1)
      .maybeSingle();

    if (data?.features) {
      globalForFeatures.__I2I_PLATFORM_FEATURES__ = {
        ...DEFAULTS,
        ...data.features,
      };
    }
  } catch {
    // ignore — defaults apply
  }

  return getFeatures();
}
