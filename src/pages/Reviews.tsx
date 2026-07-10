import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import type { Platform, Sentiment, ReviewStatus, Review } from '../types';
import AIReplyModal from '../components/reviews/AIReplyModal';
import { useReviews } from '../hooks/useReviews';
import { useBusiness } from '../context/business-context';
import { syncGoogleReviews } from '../lib/googleBusinessAPI';
import { syncFacebookReviews } from '../lib/facebookReviewsAPI';
import { useAuth } from '../context/auth-context';

const SENTIMENT_LABELS: Record<Sentiment, string> = {
  very_positive: 'חיובי מאוד',
  positive:      'חיובי',
  neutral:       'ניטרלי',
  critical:      'ביקורתי',
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending:  'ממתין לתגובה',
  replied:  'טופל',
  ignored:  'התעלמות',
};

function exportToExcel(reviews: Review[]) {
  const rows = reviews.map((r) => ({
    'שם לקוח':    r.reviewer_name,
    'פלטפורמה':   r.platform,
    'דירוג':      r.rating,
    'סנטימנט':    SENTIMENT_LABELS[r.sentiment] ?? r.sentiment,
    'תוכן ביקורת': r.content ?? '',
    'סטטוס':      STATUS_LABELS[r.status] ?? r.status,
    'תאריך':      new Date(r.created_at).toLocaleDateString('he-IL'),
    'תגובה שנשלחה': r.reply_text ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  // RTL direction for the sheet
  ws['!cols'] = [
    { wch: 20 }, { wch: 14 }, { wch: 8 }, { wch: 14 },
    { wch: 50 }, { wch: 16 }, { wch: 12 }, { wch: 50 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ביקורות');

  const date = new Date().toLocaleDateString('he-IL').replace(/\//g, '-');
  XLSX.writeFile(wb, `ביקורות_RatePulse_${date}.xlsx`);
}

const PLATFORM_OPTIONS: { value: Platform | 'all'; label: string }[] = [
  { value: 'all', label: 'כל הפלטפורמות' },
  { value: 'google', label: 'Google' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tripadvisor', label: 'TripAdvisor' },
];

const SENTIMENT_OPTIONS: { value: Sentiment | 'all'; label: string }[] = [
  { value: 'all', label: 'כל הסנטימנטים' },
  { value: 'very_positive', label: 'חיובי מאוד' },
  { value: 'positive', label: 'חיובי' },
  { value: 'neutral', label: 'ניטרלי' },
  { value: 'critical', label: 'ביקורתי' },
];

const STATUS_OPTIONS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'כל הסטטוסים' },
  { value: 'pending', label: 'ממתין לתגובה' },
  { value: 'replied', label: 'טופל' },
  { value: 'ignored', label: 'התעלמות' },
];

const SENTIMENT_STYLES: Record<Sentiment, { bg: string; text: string; label: string }> = {
  very_positive: { bg: '#dcfce7', text: '#166534', label: 'חיובי מאוד' },
  positive:      { bg: '#dbeafe', text: '#1e40af', label: 'חיובי' },
  neutral:       { bg: '#fef9c3', text: '#854d0e', label: 'ניטרלי' },
  critical:      { bg: '#fee2e2', text: '#991b1b', label: 'ביקורתי' },
};

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`material-symbols-outlined text-[16px] ${i < rating ? 'icon-filled' : ''}`}
          style={{ color: i < rating ? '#f59e0b' : '#c5c6d2' }}
        >
          star
        </span>
      ))}
    </div>
  );
}

export default function Reviews() {
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [sentiment, setSentiment] = useState<Sentiment | 'all'>('all');
  const [status, setStatus] = useState<ReviewStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [aiTarget, setAiTarget] = useState<Review | null>(null);
  const { business } = useBusiness();
  const { user } = useAuth();
  const { reviews: filtered, updateReview, refetch } = useReviews({
    platform, sentiment, status, search,
  });

  // Auto-sync all connected platforms on page load
  useEffect(() => {
    if (!business?.id || !user?.id) return;
    const bId = business.id;
    const uId = user.id;

    syncGoogleReviews(bId).then(({ synced }) => { if (synced > 0) refetch(); });

    import('../lib/supabase').then(({ supabase }) => {
      supabase
        .from('platform_connections')
        .select('platform, credentials')
        .eq('owner_id', uId)
        .then(({ data }) => {
          data?.forEach((row) => {
            if (row.platform === 'facebook') {
              syncFacebookReviews(bId)
                .then(({ synced }) => { if (synced > 0) refetch(); });
            }
          });
        });
    });
  }, [business?.id, user?.id]);

  const handleReplied = (reviewId: string) => {
    updateReview(reviewId, { status: 'replied' });
  };

  return (
    <div className="min-h-screen px-6 md:px-16 py-8 bg-background">
      <div className="max-w-screen-xl mx-auto">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-primary">ביקורות</h1>
            <p className="text-sm mt-1 text-on-surface-variant">
              {filtered.length} ביקורות נמצאו
            </p>
          </div>
          <button
            onClick={() => exportToExcel(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-opacity hover:opacity-90 bg-secondary text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            ייצוא ביקורות ({filtered.length})
          </button>
        </div>

        {/* Filters bar */}
        <div
          className="rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white border border-outline-variant/30"
          style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}
        >
          <div className="relative sm:col-span-2 lg:col-span-1">
            <span className="material-symbols-outlined text-[18px] absolute right-3 top-1/2 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              type="text"
              placeholder="חיפוש לקוח או תוכן..."
              aria-label="חיפוש לקוח או תוכן"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2.5 rounded-lg text-sm outline-none transition-all bg-surface-container-low border border-outline-variant/40 text-on-surface focus:border-secondary"
            />
          </div>

          {([
            { label: 'פלטפורמה', value: platform, setter: setPlatform, options: PLATFORM_OPTIONS },
            { label: 'סנטימנט',  value: sentiment, setter: setSentiment, options: SENTIMENT_OPTIONS },
            { label: 'סטטוס',    value: status,    setter: setStatus,    options: STATUS_OPTIONS },
          ] as const).map(({ label, value, setter, options }) => (
            <div key={label} className="relative">
              <select
                value={value}
                aria-label={label}
                dir="rtl"
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer bg-surface-container-low border border-outline-variant/40 text-on-surface"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[16px] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">
                expand_more
              </span>
            </div>
          ))}
        </div>

        {/* Review cards grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-[48px] text-outline-variant">search_off</span>
            <p className="mt-3 font-semibold text-on-surface-variant">לא נמצאו ביקורות</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((review) => {
              const s = SENTIMENT_STYLES[review.sentiment];
              const isReplied = review.status === 'replied';

              return (
                <div
                  key={review.id}
                  className={`rounded-2xl p-5 flex flex-col gap-3 transition-shadow hover:shadow-lg bg-white border ${
                    isReplied ? 'border-green-600/25' : 'border-outline-variant/30'
                  }`}
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-secondary/10 text-secondary">
                        {review.reviewer_initials}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">
                          {review.reviewer_name}
                        </p>
                        <p className="text-xs capitalize text-outline">
                          {review.platform}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: s.bg, color: s.text }}
                    >
                      {s.label}
                    </span>
                  </div>

                  <StarDisplay rating={review.rating} />

                  <p className="text-sm leading-relaxed line-clamp-3 text-on-surface-variant">
                    "{review.content}"
                  </p>

                  <p className="text-xs text-outline">
                    {new Date(review.created_at).toLocaleDateString('he-IL')}
                  </p>

                  {/* Replied badge */}
                  {isReplied && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
                      <span className="material-symbols-outlined text-[14px] icon-filled">check_circle</span>
                      טופל — תגובה נשלחה
                    </div>
                  )}

                  {/* Action buttons */}
                  {!isReplied && (
                    <div className="flex gap-2 pt-1">
                      {/* AI Reply — primary */}
                      <button
                        onClick={() => setAiTarget(review)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer text-white"
                        style={{ background: 'linear-gradient(135deg,#002366,#871dd3)' }}
                      >
                        <span className="material-symbols-outlined text-[15px] icon-filled">auto_awesome</span>
                        AI תגובה
                      </button>
                      <button
                        className="px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer bg-surface-container-low text-on-surface-variant"
                        aria-label="אפשרויות נוספות"
                      >
                        <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Reply Modal */}
      {aiTarget && (
        <AIReplyModal
          review={aiTarget}
          onClose={() => setAiTarget(null)}
          onReplied={(id) => { handleReplied(id); setAiTarget(null); }}
        />
      )}
    </div>
  );
}
