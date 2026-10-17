/* Public SEO pages of Community, served from the site root (not /api):
     /community/resources/{slug}/   a resource, for guests and search engines
     /community/authors/{slug}/     an author and what they shared
     /sitemap-community.xml         only addresses that answer 200 and may be indexed
   nginx sends these three paths to the API (ops/nginx/teached.conf). Everything
   comes from lib/seoPages.js's public projection. */
const crypto = require('crypto');
const router = require('express').Router();
const pool = require('../db/pool');
const seo = require('../lib/seoPages');
const mod = require('../lib/communityModeration');

const html = (res, status, body, extra = {}) => {
  res.status(status).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ...extra }).send(body);
};
const gone = res => html(res, 410, seo.renderEnd(410, 'This resource is no longer available', 'It was taken down by its author or by the TeachEd team.'), { 'X-Robots-Tag': 'noindex' });
const missing = res => html(res, 404, seo.renderEnd(404, 'Page not found', 'We could not find this page in Community.'), { 'X-Robots-Tag': 'noindex' });
const slugOk = s => /^[a-z0-9][a-z0-9-]{0,88}$/.test(String(s || ''));
// one canonical form: with a trailing slash, no tracking parameters in the address we send people to
const needsSlash = req => !req.path.endsWith('/');
const withSlash = req => req.path + '/' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');

router.get(['/community/resources/:slug', '/community/resources/:slug/'], async (req, res) => {
  try {
    const slug = String(req.params.slug || '');
    if (!slugOk(slug)) return missing(res);
    if (needsSlash(req)) return res.redirect(301, withSlash(req));
    await seo.backfillSlugs().catch(() => {});
    const r = await seo.resolveResource(slug);
    if (r.status === 301) return res.redirect(301, r.to);
    if (r.status === 410) return gone(res);
    if (r.status !== 200) return missing(res);
    const related = await seo.relatedTo(r.resource, r.resource.kind);
    html(res, 200, seo.renderResource(r.resource, related));
  } catch (err) { console.error('[seo] resource:', err.message); res.status(500).type('text').send('Server error'); }
});

router.get(['/community/authors/:slug', '/community/authors/:slug/'], async (req, res) => {
  try {
    const slug = String(req.params.slug || '');
    if (!slugOk(slug)) return missing(res);
    if (needsSlash(req)) return res.redirect(301, withSlash(req));
    await seo.backfillSlugs().catch(() => {});
    const a = await seo.resolveAuthor(slug);
    if (a.status === 410) return gone(res);
    if (a.status !== 200) return missing(res);
    if (a.canonical !== slug) return res.redirect(301, `/community/authors/${a.canonical}/`);   // renamed author
    html(res, 200, seo.renderAuthor(a));
  } catch (err) { console.error('[seo] author:', err.message); res.status(500).type('text').send('Server error'); }
});

/* A guest's "Report this resource": the moderation queue gets it, the author does
   not hear of it, and it never moves the automatic thresholds (§7.3). */
const reportBurst = new Map();
router.post('/community/resources/:slug/report', require('express').json({ limit: '4kb' }), async (req, res) => {
  try {
    const slug = String(req.params.slug || '');
    if (!slugOk(slug) || !mod.isCategory(req.body && req.body.reason)) return res.status(400).json({ error: 'Choose what is wrong' });
    const who = crypto.createHash('sha256').update(`${process.env.JWT_SECRET || 'seo'}|${req.ip}`).digest('hex').slice(0, 32);
    const { rows: [n] } = await pool.query(`SELECT COUNT(*)::int AS n FROM public_reports WHERE who = $1 AND created_at > NOW() - INTERVAL '1 day'`, [who]);
    if (n.n >= 5) return res.status(429).json({ error: 'Too many reports from this address today' });
    const { rows: [a] } = await pool.query(
      `SELECT a.id, a.user_id, a.version_no, a.title, a.description, a.level, a.skill, a.tags, a.data, u.name AS author_name
         FROM assignments a JOIN users u ON u.id = a.user_id WHERE a.slug = $1 AND a.visibility = 'community'`, [slug]);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const category = mod.normalizeCategory(req.body.reason);
    const note = String((req.body && req.body.note) || '').trim().slice(0, 500);
    let { rows: [kase] } = await pool.query(
      `SELECT id FROM moderation_cases WHERE assignment_id = $1 AND status <> 'resolved' ORDER BY opened_at DESC LIMIT 1`, [a.id]);
    if (!kase) {
      ({ rows: [kase] } = await pool.query(
        `INSERT INTO moderation_cases (assignment_id, author_id, version_no, risk_level, snapshot) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [a.id, a.user_id, a.version_no, mod.isCritical(category, 'normal') ? 'critical' : 'normal',
          { title: a.title, description: a.description, level: a.level, skill: a.skill, tags: a.tags, author_id: a.user_id, author_name: a.author_name,
            version_no: a.version_no, snapshot: a.data && a.data.snapshot || null, taken_at: new Date().toISOString() }]));
    }
    await pool.query('INSERT INTO public_reports (assignment_id, case_id, reason, note, who) VALUES ($1,$2,$3,$4,$5)', [a.id, kase.id, category, note, who]);
    res.json({ ok: true });
  } catch (err) { console.error('[seo] report:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* Only what is public, moderated, has a description and a preview (the same rule
   as the page's own "index"): the sitemap and the page cannot disagree. lastmod is
   the last real change of the content, not of a rebuild. */
router.get('/sitemap-community.xml', async (_req, res) => {
  try {
    await seo.backfillSlugs().catch(() => {});
    const { rows } = await pool.query(`${seo.RESOURCE_SQL}
      WHERE a.visibility = 'community' AND a.hidden_at IS NULL AND a.moderation_state = 'published' AND a.slug IS NOT NULL
      ORDER BY a.published_at DESC NULLS LAST LIMIT 45000`);
    const items = rows.map(seo.project).filter(p => p.indexable);
    const authors = new Map();
    rows.forEach((r, i) => { const p = items.find(x => x.id === r.id); if (!p) return; const cur = authors.get(p.author.slug); const t = Date.parse(r.content_updated_at || r.first_public_at || r.published_at) || 0; if (!cur || t > cur) authors.set(p.author.slug, t); });
    const day = t => new Date(t).toISOString().slice(0, 10);
    const lastmod = r => { const t = Date.parse(r.content_updated_at || r.first_public_at || r.published_at); return Number.isFinite(t) ? `<lastmod>${day(t)}</lastmod>` : ''; };
    const byId = new Map(rows.map(r => [r.id, r]));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
      + items.map(p => `  <url><loc>${seo.abs(`/community/resources/${p.slug}/`)}</loc>${lastmod(byId.get(p.id))}</url>`).join('\n')
      + '\n' + [...authors].map(([slug, t]) => `  <url><loc>${seo.abs(`/community/authors/${slug}/`)}</loc>${t ? `<lastmod>${day(t)}</lastmod>` : ''}</url>`).join('\n')
      + '\n</urlset>\n';
    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' }).send(xml);
  } catch (err) { console.error('[seo] sitemap:', err.message); res.status(500).type('text').send('Server error'); }
});

module.exports = router;
