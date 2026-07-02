import { supabase } from './supabase';
import type { Sentiment, ReviewStatus } from '../types';

export type SyncResult = { synced: number; error?: string };

function ratingToSentiment(r: number): Sentiment {
  if (r >= 5) return 'very_positive';
  if (r >= 4) return 'positive';
  if (r >= 3) return 'neutral';
  return 'critical';
}

function toInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'FB';
}

interface FBRating {
  reviewer?: { name?: string; id?: string };
  rating?: number;
  review_text?: string;
  created_time?: string;
}

export async function syncFacebookReviews(
  businessId: string,
  pageId: string,
  accessToken: string,
): Promise<SyncResult> {
  if (!pageId?.trim() || !accessToken?.trim()) return { synced: 0, error: 'no_credentials' };

  try {
    const url =
      `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/ratings` +
      `?fields=reviewer,rating,review_text,created_time&limit=50` +
      `&access_token=${encodeURIComponent(accessToken)}`;

    const res = await fetch(url);
    const json = await res.json();

    if (!res.ok || json.error) {
      return { synced: 0, error: json.error?.message ?? `Facebook API ${res.status}` };
    }

    const data: FBRating[] = json.data ?? [];
    if (!data.length) return { synced: 0 };

    const rows = data.map((r) => {
      const rating = r.rating ?? 3;
      return {
        business_id:       businessId,
        platform:          'facebook' as const,
        external_id:       `fb_${r.reviewer?.id ?? 'anon'}_${r.created_time ?? Date.now()}`,
        reviewer_name:     r.reviewer?.name ?? 'אנונימי',
        reviewer_initials: toInitials(r.reviewer?.name ?? 'FB'),
        rating,
        content:           r.review_text ?? '',
        sentiment:         ratingToSentiment(rating),
        status:            'pending' as ReviewStatus,
        reply_text:        null,
        created_at:        r.created_time ?? new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from('reviews')
      .upsert(rows, { onConflict: 'external_id' });

    if (error) return { synced: 0, error: error.message };
    return { synced: rows.length };
  } catch (e) {
    return { synced: 0, error: (e as Error).message };
  }
}
