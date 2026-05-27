// Thin wrapper around Vercel Analytics' custom events. Centralized so we
// can swap the provider, add a debug logger, or no-op in dev without
// touching call sites. All Spec 03 Daily/Share events go through here.

import { track as vercelTrack } from '@vercel/analytics';

export type AnalyticsEvent =
  | 'daily_started'
  | 'daily_completed'
  | 'daily_revisit'
  | 'share_clicked'
  | 'share_method'
  | 'deeplink_opened'
  | 'match_created'
  | 'match_link_opened'
  | 'match_run_submitted'
  | 'match_complete_viewed'
  | 'match_new_match_clicked'
  | 'match_share_clicked';

type EventProps = Record<string, string | number | boolean | null>;

export function track(event: AnalyticsEvent, props?: EventProps): void {
  try {
    vercelTrack(event, props);
  } catch {
    // Analytics must never break the game.
  }
}
