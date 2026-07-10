import { supabase } from './supabase';
import type { Sentiment, ReviewStatus } from '../types';

// ── Internal GBP types ─────────────────────────────────────────────────────────

interface GBPAccount  { name: string; accountName: string }
interface GBPLocation { name: string; title: string }
interface GBPReview {
  reviewId: string;
  reviewer: { displayName: string };
  starRating: string;
  comment?: string;
  createTime: string;
  reviewReply?: { comment: string };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function starToRating(s: string): number {
  return ({ ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as Record<string, number>)[s] ?? 3;
}

function ratingToSentiment(r: number): Sentiment {
  if (r >= 5) return 'very_positive';
  if (r >= 4) return 'positive';
  if (r >= 3) return 'neutral';
  return 'critical';
}

function toInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'GG';
}

async function gbpFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GBP ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Public ─────────────────────────────────────────────────────────────────────

export type SyncResult = { synced: number; error?: string };

export async function syncGoogleReviews(businessId: string): Promise<SyncResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.provider_token;

  if (!token) return { synced: 0, error: 'לא מחובר עם Google — התחבר עם חשבון Google כדי לסנכרן' };

  try {
    const { accounts = [] } = await gbpFetch<{ accounts?: GBPAccount[] }>(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts', token,
    );

    if (!accounts.length) return { synced: 0, error: 'לא נמצאו חשבונות Google Business' };

    let total = 0;

    for (const acc of accounts) {
      const { locations = [] } = await gbpFetch<{ locations?: GBPLocation[] }>(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?readMask=name,title`,
        token,
      );

      for (const loc of locations) {
        const { reviews = [] } = await gbpFetch<{ reviews?: GBPReview[] }>(
          `https://mybusiness.googleapis.com/v4/${loc.name}/reviews?pageSize=50`,
          token,
        );

        if (!reviews.length) continue;

        const rows = reviews.map((r) => {
          const rating = starToRating(r.starRating);
          return {
            business_id:       businessId,
            platform:          'google' as const,
            external_id:       r.reviewId,
            reviewer_name:     r.reviewer.displayName || 'אנונימי',
            reviewer_initials: toInitials(r.reviewer.displayName || 'א'),
            rating,
            content:           r.comment ?? '',
            sentiment:         ratingToSentiment(rating),
            status:            (r.reviewReply ? 'replied' : 'pending') as ReviewStatus,
            reply_text:        r.reviewReply?.comment ?? null,
            created_at:        r.createTime,
          };
        });

        const { error } = await supabase
          .from('reviews')
          .upsert(rows, { onConflict: 'external_id' });

        if (!error) total += rows.length;
      }
    }

    return { synced: total };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('401'))
      return { synced: 0, error: 'פג תוקף החיבור עם Google — התנתק והתחבר מחדש' };
    return { synced: 0, error: msg };
  }
}
