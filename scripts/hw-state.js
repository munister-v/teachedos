/* The four states of a homework card, drawn the same way wherever the card is
   (the cabinet's Homework widget and Assignments tab, homework-do.html):

     NOT_STARTED  assigned, nothing done yet          → Start homework →
     IN_PROGRESS  a draft is saved, part of it done    → Continue →
                  "Task 2 of 3 · Auto-saved at 14:20" (saved on the server, any device)
     SUBMITTED    handed in, not reviewed yet          ⏳ Pending teacher review
     REVIEWED     the teacher published a review       💬 Feedback available
                  (until the student opens it)         → 🎧 Listen to voice feedback / Read review

   window.HwState.of(assignment) - an assignment from /api/homework/my/inbox. */
(function () {
  'use strict';
  if (window.HwState) return;
  const KEY = { assigned: 'NOT_STARTED', in_progress: 'IN_PROGRESS', submitted: 'SUBMITTED', graded: 'REVIEWED' };

  function of(a) {
    a = a || {};
    const key = KEY[a.status] || 'NOT_STARTED';
    const total = Array.isArray(a.required_cards) ? a.required_cards.length : 0;
    const done = Math.min(total, Number(a.done_cards) || 0);
    const pct = total ? Math.round(done / total * 100) : 0;
    const voice = a.voice_ms != null;
    const fresh = key === 'REVIEWED' && !a.feedback_seen_at;
    let badge = null, action, note = '', saved = '';
    if (key === 'NOT_STARTED') action = 'Start homework →';
    else if (key === 'IN_PROGRESS') {
      action = 'Continue →';
      note = total > 1 ? `Task ${Math.min(done + 1, total)} of ${total}` : 'In progress';
      const at = a.last_saved_at ? new Date(a.last_saved_at) : null;
      if (at && !isNaN(at)) {
        const time = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        saved = new Date().toDateString() === at.toDateString() ? `Auto-saved at ${time}`
          : `Auto-saved ${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
      }
    }
    else if (key === 'SUBMITTED') { badge = { cls: 'pending', text: '⏳ Pending teacher review' }; action = 'View my work'; }
    else {
      badge = fresh ? { cls: 'feedback', text: '💬 Feedback available' } : { cls: 'reviewed', text: '✓ Reviewed' };
      action = voice ? '🎧 Listen to voice feedback' : 'Read review';
    }
    const line = [note, saved].filter(Boolean).join(' · ');
    return { key, total, done, pct, voice, fresh, badge, action, note, saved, line, finished: key === 'SUBMITTED' || key === 'REVIEWED' };
  }

  window.HwState = { of };
})();
