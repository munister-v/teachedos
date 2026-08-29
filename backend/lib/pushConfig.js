'use strict';

const webpush = require('web-push');

const VAPID_PUBLIC = String(process.env.VAPID_PUBLIC || '').trim();
const VAPID_PRIVATE = String(process.env.VAPID_PRIVATE || '').trim();
const pushConfigured = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);

if (pushConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@teached.tech',
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[push] VAPID_PUBLIC/VAPID_PRIVATE are not configured; push is disabled');
}

module.exports = { webpush, VAPID_PUBLIC, pushConfigured };
