import { supabase } from './supabase';

export type SyncResult = { synced: number; error?: string };

export async function syncFacebookReviews(businessId: string): Promise<SyncResult> {
  if (!businessId) return { synced: 0, error: 'no_credentials' };

  const { data, error } = await supabase.functions.invoke('sync-facebook-reviews', {
    body: { business_id: businessId },
  });

  if (error) return { synced: 0, error: error.message };
  return { synced: data?.synced ?? 0, error: data?.error };
}
