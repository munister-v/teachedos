/* Public SEO pages of Community (ТЗ "SEO Community", 17.10.2026).

   Three things live here: slugs, the PUBLIC PROJECTION of a resource and of an
   author, and the HTML of the page. A page is made only from the projection - a
   short, explicit list of fields - never from the full assignment row, so a
   field that is not listed cannot reach the HTML, the JSON-LD, the Open Graph
   tags or a cached fragment.

   Not here, on purpose (open questions §10 of the ТЗ): the CEFR x Topic x Skill
   landings, pricing blocks on public pages, other languages. */
const pool = require('../db/pool');
const { STATS_SQL, shapeStats } = require('./communityCards');

const BASE = String(process.env.PUBLIC_BASE_URL || 'https://teached.tech').replace(/\/+$/, '');
const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const WITHDRAWN = new Set(['hidden', 'needs_changes', 'removed']);

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const ldJson = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/* ── slugs ─────────────────────────────────────────────────────────────── */
const CYR = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'e', ъ: '' };
function slugify(text, fallback = 'resource', max = 60) {
  const s = String(text || '').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[а-яёіїєґ]/g, c => CYR[c] ?? '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
  return s || fallback;
}
const authorSlug = (name, id) => `${slugify(name, 'teacher', 40)}-${String(id).replace(/-/g, '').slice(0, 8)}`;
const authorIdPrefix = slug => { const m = /-([0-9a-f]{8})$/.exec(String(slug || '')); return m ? m[1] : null; };

/* The slug is made once, the first time a resource is seen public, and never
   changes with the title. A taken one gets the id's first characters. */
async function ensureSlug(db, row) {
  if (row.slug) return row.slug;
  const base = slugify(row.title);
  const tries = [base, `${base}-${String(row.id).replace(/-/g, '').slice(0, 6)}`, `${base}-${String(row.id).replace(/-/g, '').slice(0, 12)}`];
  for (const slug of tries) {
    try {
      const { rowCount } = await db.query('UPDATE assignments SET slug = $2 WHERE id = $1 AND slug IS NULL', [row.id, slug]);
      if (rowCount) return slug;
      const { rows: [cur] } = await db.query('SELECT slug FROM assignments WHERE id = $1', [row.id]);
      if (cur && cur.slug) return cur.slug;
    } catch (e) { if (e.code !== '23505') throw e; }
  }
  return null;
}
/* every public resource that has no slug yet (the old ones, and anything published while this ran) */
async function backfillSlugs(db = pool) {
  const { rows } = await db.query(`SELECT id, title FROM assignments WHERE visibility = 'community' AND slug IS NULL`);
  for (const r of rows) await ensureSlug(db, r);
  return rows.length;
}

/* ── public projection of a resource ───────────────────────────────────── */
const SECTION = { game: 'Interactive Games' };
const sectionOf = kind => SECTION[kind] || 'Lessons & Spaces';
const typeOf = r => (r.kind === 'game' ? 'Game' : r.kind === 'quiz' ? 'Quiz' : r.kind === 'board' || r.kind === 'lesson'
  ? (r.source_frame_id ? 'Lesson' : 'Space') : 'Lesson');

const RESOURCE_SQL = `
  SELECT a.id, a.slug, a.kind, a.title, a.description, a.level, a.skill, a.visibility, a.hidden_at, a.moderation_state,
         a.access_type, a.user_id AS author_id, a.published_at, a.first_public_at, a.content_updated_at,
         (a.image IS NOT NULL) AS has_image,
         COALESCE(NULLIF(a.data->>'source_frame_id', ''), NULLIF(a.data->>'sourceFrameId', '')) AS source_frame_id,
         NULLIF(a.data->>'duration', '') AS duration,
         (a.data->>'allowCopy') IS DISTINCT FROM 'false' AS allow_copy,
         a.data->'preview' AS preview,
         u.name AS author_name,
         ${STATS_SQL}
    FROM assignments a JOIN users u ON u.id = a.user_id`;

/* The few things a stranger may be told about what is inside: how many cards and
   what kinds - never their text (a card can hold anything, a student's name too). */
function insideOf(preview) {
  const n = Number(preview && preview.cardCount) || 0;
  const types = Array.isArray(preview && preview.types) ? preview.types.slice(0, 3)
    .map(t => ({ type: clip(t && t.type, 32), count: Number(t && t.count) || 0 })).filter(t => t.type && t.count) : [];
  return { cards: n, types };
}

function project(r) {
  const level = String(r.level || '').trim().toUpperCase();
  const first = r.first_public_at || r.published_at;
  const upd = r.content_updated_at && first && Date.parse(r.content_updated_at) - Date.parse(first) > 86400000 ? r.content_updated_at : null;
  const p = {
    id: r.id, slug: r.slug, kind: r.kind, authorId: r.author_id, title: clip(r.title, 200), description: String(r.description || '').trim().slice(0, 4000),
    author: { name: clip(r.author_name, 80) || 'A TeachEd teacher', slug: authorSlug(r.author_name, r.author_id) },
    cefr: CEFR.has(level) ? level : null, skill: clip(r.skill, 40) || null,
    section: sectionOf(r.kind), type: typeOf(r), published: first, updated: upd,
    hasImage: !!r.has_image, inside: insideOf(r.preview), duration: clip(r.duration, 20) || null,
    stats: shapeStats(r), paid: r.access_type === 'paid', allowCopy: r.allow_copy !== false,
  };
  const moderated = r.moderation_state === 'published';
  // indexable = public, moderated, and enough to say something about (§2.4)
  p.indexable = r.visibility === 'community' && !r.hidden_at && moderated && !!p.title && p.description.length >= 30
    && (p.hasImage || p.inside.cards > 0);
  return p;
}

/* What a public address answers: a page, a redirect, or the end of one. */
async function resolveResource(slug) {
  const { rows: [r] } = await pool.query(`${RESOURCE_SQL} WHERE a.slug = $1`, [slug]);
  if (r) {
    if (r.visibility !== 'community' || r.hidden_at || WITHDRAWN.has(r.moderation_state)) return { status: 410 };
    return { status: 200, resource: project(r) };
  }
  const { rows: [t] } = await pool.query('SELECT successor_slug FROM public_tombstones WHERE slug = $1', [slug]);
  if (t) return t.successor_slug ? { status: 301, to: `/community/resources/${t.successor_slug}/` } : { status: 410 };
  return { status: 404 };
}

async function relatedTo(p, kind) {
  const { rows } = await pool.query(
    `${RESOURCE_SQL}
      WHERE a.visibility = 'community' AND a.hidden_at IS NULL AND a.moderation_state = 'published'
        AND a.slug IS NOT NULL AND a.id <> $1
      ORDER BY (CASE WHEN $2::text <> '' AND UPPER(a.level) = $2 AND $3::text <> '' AND LOWER(a.skill) = LOWER($3) THEN 0
                     WHEN $2::text <> '' AND UPPER(a.level) = $2 THEN 1
                     WHEN a.kind = $4 THEN 2
                     WHEN a.user_id = $5 THEN 3 ELSE 4 END),
               (SELECT COUNT(*) FROM verified_uses vu WHERE vu.assignment_id = a.id) DESC,
               a.published_at DESC NULLS LAST
      LIMIT 8`,
    [p.id, p.cefr || '', p.skill || '', kind, p.authorId]);
  return rows.map(project).filter(x => x.indexable);
}

/* ── author ────────────────────────────────────────────────────────────── */
async function resolveAuthor(slug) {
  const prefix = authorIdPrefix(slug);
  if (!prefix) return { status: 404 };
  const { rows: users } = await pool.query(
    `SELECT id, name, avatar, community_bio AS bio FROM users
      WHERE role IN ('teacher','admin') AND REPLACE(id::text, '-', '') LIKE $1`, [`${prefix}%`]);
  if (users.length !== 1) return { status: 404 };
  const u = users[0];
  const canon = authorSlug(u.name, u.id);
  const { rows } = await pool.query(
    `${RESOURCE_SQL} WHERE a.user_id = $1 AND a.visibility = 'community' AND a.hidden_at IS NULL AND a.moderation_state = 'published'
      ORDER BY a.published_at DESC NULLS LAST LIMIT 200`, [u.id]);
  const items = [];
  for (const r of rows) { if (!r.slug) r.slug = await ensureSlug(pool, r); const p = project(r); if (p.indexable) items.push(p); }
  if (!items.length) return { status: 410 };
  const ids = rows.map(r => r.id);
  const { rows: [t] } = await pool.query(
    `SELECT COUNT(DISTINCT lesson_session_id)::int AS taught, COUNT(rating)::int AS rated,
            COUNT(*) FILTER (WHERE rating = 'worked_well')::int AS good
       FROM verified_uses WHERE assignment_id = ANY($1::uuid[])`, [ids]);
  const saves = items.reduce((n, i) => n + i.stats.saves, 0);
  const top = items.slice().sort((a, b) => b.stats.used - a.stats.used || b.stats.saves - a.stats.saves).filter(i => i.stats.used > 0).slice(0, 3);
  return {
    status: 200, canonical: canon, slug,
    author: { id: u.id, name: clip(u.name, 80) || 'A TeachEd teacher', bio: clip(u.bio, 400), hasAvatar: !!u.avatar },
    stats: { published: items.length, saves, taught: t.taught, pct: t.rated >= 5 ? Math.round(100 * t.good / t.rated) : null },
    top, items,
  };
}

/* ── HTML ──────────────────────────────────────────────────────────────── */
const CSS = `
:root{--ink:#16181D;--mute:#5A5F6B;--line:rgba(11,16,38,.1);--lime:#CDF649;--olive:#C9CBBF;--sand:#F6F6EF;--bg:#FAFAF7}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 "TeachEd UI",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:inherit}
.top{display:flex;align-items:center;gap:18px;max-width:1040px;margin:0 auto;padding:14px 20px}
.top .brand{display:flex;align-items:center;gap:8px;font-weight:800;text-decoration:none}
.top .brand img{width:32px;height:32px}
.top nav{display:flex;gap:6px;margin-left:8px}
.top nav a{padding:8px 12px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px}
.top nav a:hover{background:var(--olive)}
.top .sp{flex:1}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 20px;border-radius:999px;border:0;background:var(--lime);color:var(--ink);font-family:inherit;font-weight:800;font-size:15px;line-height:1;text-decoration:none;cursor:pointer}
.btn:hover{filter:brightness(.97)}.btn:focus-visible,a:focus-visible,button:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
.btn.ghost{background:#fff;border:1px solid var(--line)}
main{max-width:1040px;margin:0 auto;padding:6px 20px 56px}
.crumbs{font-size:14px;color:var(--mute);margin:8px 0 14px}.crumbs ol{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0;padding:0}
.crumbs li+li::before{content:"\\203A";margin-right:6px}.crumbs a{text-decoration:none}.crumbs a:hover{text-decoration:underline}
h1{font-size:clamp(26px,4.2vw,40px);line-height:1.15;letter-spacing:-.02em;margin:0 0 10px;font-weight:800}
h2{font-size:20px;margin:34px 0 12px;font-weight:800;letter-spacing:-.01em}
.meta{display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--mute);font-size:15px;margin-bottom:14px}.meta b{color:var(--ink);font-weight:700}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}.tag{padding:5px 12px;border-radius:999px;background:var(--sand);border:1px solid var(--line);font-size:13.5px;font-weight:700}
.tag.cefr{background:var(--lime);border-color:var(--lime)}
.grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:28px;align-items:start}
@media(max-width:820px){.grid{grid-template-columns:1fr}.top nav{display:none}}
.cover{aspect-ratio:16/9;width:100%;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,#E9F5C4,#DCE2EB);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}
.cover img{width:100%;height:100%;object-fit:cover;display:block}
.cover span{font-weight:800;font-size:22px;color:#3A3F49}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px}
.desc{white-space:pre-line;font-size:17px}
.inside{margin:0;padding-left:20px}.inside li{margin:3px 0}
.used{font-size:17px;font-weight:700}.used small{display:block;font-weight:500;color:var(--mute);font-size:14px;margin-top:4px}
.stack>*+*{margin-top:14px}
.author{display:flex;align-items:center;gap:12px}.av{width:44px;height:44px;border-radius:50%;background:var(--olive);display:flex;align-items:center;justify-content:center;font-weight:800}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;list-style:none;margin:0;padding:0}
.rc{display:block;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;height:100%}
.rc:hover{box-shadow:0 10px 28px rgba(11,16,38,.1)}
.rc .im{aspect-ratio:16/9;background:linear-gradient(135deg,#E9F5C4,#DCE2EB)}.rc .im img{width:100%;height:100%;object-fit:cover;display:block}
.rc .bd{padding:12px 14px 14px}.rc h3{margin:0 0 4px;font-size:16px;line-height:1.3}.rc p{margin:0;color:var(--mute);font-size:13.5px}
.stats{display:flex;flex-wrap:wrap;gap:12px}.stat{flex:1 1 140px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px}.stat b{display:block;font-size:26px;letter-spacing:-.02em}.stat span{color:var(--mute);font-size:14px}
.note{color:var(--mute);font-size:14px}
footer{max-width:1040px;margin:0 auto;padding:22px 20px 40px;color:var(--mute);font-size:14px;display:flex;flex-wrap:wrap;gap:8px 18px;border-top:1px solid var(--line)}
.rep{background:none;border:0;padding:0;color:var(--mute);font:inherit;text-decoration:underline;cursor:pointer}
.rep-box{margin-top:12px;display:none}.rep-box.on{display:block}
.rep-box select,.rep-box textarea{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:12px;margin-top:8px;background:#fff}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:12px 18px;border-radius:999px;font-weight:600;z-index:9;display:none}.toast.on{display:block}
`;

const initials = n => String(n || 'T').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || 'T';
const abs = path => `${BASE}${path}`;
const when = iso => { const d = new Date(iso); return Number.isFinite(+d) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''; };
const coverUrl = p => (p.hasImage ? abs(`/api/library/${p.id}/cover`) : abs('/og-cover.png'));

function shell({ title, description, canonical, robots = 'index, follow', ogImage, ogType = 'article', ld = [], body, script = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${esc(robots)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<meta property="og:site_name" content="TeachEd">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${esc(ogImage)}">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${ld.map(o => `<script type="application/ld+json">${ldJson(o)}</script>`).join('\n')}
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <a class="brand" href="/"><img src="/logo-sm.png" alt="" width="32" height="32">TeachEd</a>
  <nav aria-label="Main"><a href="/community.html">Community</a></nav>
  <span class="sp"></span>
  <a class="btn ghost" href="/?auth=login" id="signin">Sign in</a>
</header>
<main>
${body}
</main>
<footer><span>&copy; TeachEd</span><a href="/community.html">Community</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></footer>
<div class="toast" id="toast" role="status"></div>
${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}

function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumbs"><ol>${items.map((c, i) => `<li>${c.href && i < items.length - 1 ? `<a href="${esc(c.href)}">${esc(c.label)}</a>` : `<span${i === items.length - 1 ? ' aria-current="page"' : ''}>${esc(c.label)}</span>`}</li>`).join('')}</ol></nav>`;
}
const crumbLd = items => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, ...(c.url ? { item: c.url } : {}) })) });

function usedBlock(s) {
  if (!s.used) return `<p class="used">Not taught in a tracked lesson yet</p>`;
  const line = `Taught in ${s.used} lesson${s.used === 1 ? '' : 's'}`;
  const fb = s.rating ? `${s.rating.pct}% of teachers who taught this lesson said it worked well` : 'Not enough classroom feedback yet';
  return `<p class="used">${line}<small>${esc(fb)}</small></p>`;
}

function resourceCard(p) {
  const bits = [p.author.name, p.cefr ? `CEFR ${p.cefr}` : null, p.published ? when(p.published) : null, p.stats.saves ? `${p.stats.saves} save${p.stats.saves === 1 ? '' : 's'}` : null].filter(Boolean);
  return `<li><a class="rc" href="/community/resources/${esc(p.slug)}/"><div class="im">${p.hasImage ? `<img src="/api/library/${esc(p.id)}/cover" alt="" loading="lazy" width="640" height="360">` : ''}</div><div class="bd"><h3>${esc(p.title)}</h3><p>${esc(bits.join(' · '))}</p></div></a></li>`;
}

/* the guest's two actions: copy (sign up, come back, finish it) and report */
const RESOURCE_SCRIPT = `
(function(){
  var B=document.getElementById('copy-btn');
  var T=document.getElementById('toast');
  function toast(m){T.textContent=m;T.className='toast on';setTimeout(function(){T.className='toast'},3500)}
  function tok(){try{return localStorage.getItem('teachedos_token')}catch(e){return null}}
  var API=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?'http://localhost:4000':'';
  function call(path,opt){opt=opt||{};opt.headers=Object.assign({'Content-Type':'application/json'},opt.headers||{});var t=tok();if(t)opt.headers.Authorization='Bearer '+t;return fetch(API+path,opt)}
  var id=B&&B.getAttribute('data-id'),slug=B&&B.getAttribute('data-slug');
  function ev(name,cat){try{call('/api/community/events',{method:'POST',body:JSON.stringify({event:name,publication_id:id,source_surface:'public_resource',category:cat})})}catch(e){}}
  function copy(){
    B.disabled=true;B.textContent='Opening your board\\u2026';
    call('/api/library/'+encodeURIComponent(id)).then(function(r){return r.json()}).then(function(d){
      var a=d&&d.assignment,s=a&&a.data&&a.data.snapshot;
      if(!a||a.locked||!s||!s.cards||!s.cards.length){location.href='/lesson-view.html?id='+encodeURIComponent(id);return}
      sessionStorage.setItem('teachedos_community_import',JSON.stringify(s));
      call('/api/library/'+encodeURIComponent(id)+'/track-copy',{method:'POST'}).catch(function(){});
      ev('public_copy_completed','copy');
      location.href='/board.html?communityImport=session';
    }).catch(function(){B.disabled=false;B.textContent='Copy to my board';toast('Could not copy this resource. Try again.')});
  }
  if(B){
    B.addEventListener('click',function(){
      if(tok()){copy();return}
      ev('public_cta_clicked','copy');
      try{sessionStorage.setItem('teachedos_return_to','/community/resources/'+slug+'/?act=copy')}catch(e){}
      location.href='/?auth=register';
    });
    if(/[?&]act=copy(&|$)/.test(location.search)&&tok()){try{history.replaceState(null,'',location.pathname)}catch(e){}copy()}
  }
  var s=document.getElementById('signin');
  if(s)s.addEventListener('click',function(){try{sessionStorage.setItem('teachedos_return_to',location.pathname)}catch(e){}});
  var R=document.getElementById('rep-open'),X=document.getElementById('rep-box');
  if(R)R.addEventListener('click',function(){X.classList.toggle('on')});
  var send=document.getElementById('rep-send');
  if(send)send.addEventListener('click',function(){
    var reason=document.getElementById('rep-reason').value,note=document.getElementById('rep-note').value;
    send.disabled=true;
    fetch('/community/resources/'+slug+'/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:reason,note:note})})
      .then(function(r){if(!r.ok)throw 0;X.classList.remove('on');toast('Thank you. Our team will take a look.')})
      .catch(function(){send.disabled=false;toast('Could not send the report. Try again later.')});
  });
})();`;

const REASONS = [['misleading', 'Incorrect or misleading'], ['copyright', 'Copyright or plagiarism'], ['inappropriate', 'Inappropriate for learners'],
  ['personal_data', 'Personal data'], ['harmful_link', 'Harmful link or file'], ['spam', 'Spam or duplicate'], ['other', 'Other']];

function renderResource(p, related) {
  const url = abs(`/community/resources/${p.slug}/`);
  const seg = [p.cefr, p.skill].filter(Boolean).join(' ');
  const title = `${p.title} — ${seg ? seg + ' ' : ''}Teaching Resource | TeachEd`;
  const description = clip(p.description, 155);
  const sectionUrl = abs('/community.html');
  const bc = [{ label: 'Community', href: '/community.html', url: sectionUrl }, { label: p.section, href: '/community.html', url: sectionUrl },
    { label: p.title, url }];
  const ld = [{
    '@context': 'https://schema.org', '@type': 'LearningResource', name: p.title, description: clip(p.description, 500), url,
    image: coverUrl(p), author: { '@type': 'Person', name: p.author.name, url: abs(`/community/authors/${p.author.slug}/`) },
    ...(p.published ? { datePublished: new Date(p.published).toISOString() } : {}), ...(p.updated ? { dateModified: new Date(p.updated).toISOString() } : {}),
    inLanguage: 'en', learningResourceType: p.type, ...(p.cefr ? { educationalLevel: `CEFR ${p.cefr}` } : {}),
    ...(p.skill ? { teaches: p.skill } : {}), isAccessibleForFree: true,
  }, crumbLd(bc)];
  const inside = p.inside.cards ? `<h2>What's inside</h2><ul class="inside"><li>${p.inside.cards} card${p.inside.cards === 1 ? '' : 's'}${p.duration ? `, about ${esc(p.duration)} min` : ''}</li>${p.inside.types.map(t => `<li>${t.count} &times; ${esc(t.type)}</li>`).join('')}</ul>` : '';
  const cta = p.paid || !p.allowCopy
    ? `<a class="btn" href="/lesson-view.html?id=${esc(p.id)}">${p.paid ? 'See the preview' : 'Open the lesson'}</a>`
    : `<button class="btn" type="button" id="copy-btn" data-id="${esc(p.id)}" data-slug="${esc(p.slug)}">Copy to my board</button>`;
  const body = `${crumbs(bc)}
<h1>${esc(p.title)}</h1>
<div class="meta"><span>By <a href="/community/authors/${esc(p.author.slug)}/"><b>${esc(p.author.name)}</b></a></span>${p.published ? `<span>Published <time datetime="${esc(new Date(p.published).toISOString().slice(0, 10))}">${esc(when(p.published))}</time></span>` : ''}<span>${p.stats.saves} save${p.stats.saves === 1 ? '' : 's'}</span></div>
<div class="tags">${p.cefr ? `<span class="tag cefr">CEFR ${esc(p.cefr)}</span>` : ''}<span class="tag">${esc(p.type)}</span>${p.skill ? `<span class="tag">${esc(p.skill)}</span>` : ''}</div>
<div class="grid">
 <div class="stack">
  <div class="cover">${p.hasImage ? `<img src="/api/library/${esc(p.id)}/cover" alt="Cover of ${esc(p.title)}" width="1280" height="720" fetchpriority="high">` : `<span>${esc(p.title)}</span>`}</div>
  <div class="card"><div class="desc">${esc(p.description)}</div>${inside}</div>
 </div>
 <aside class="stack">
  <div class="card">${cta}<p class="note" style="margin:12px 0 0">Reading is free. Copying needs a free TeachEd account; you will come back to this page and the copy finishes by itself.</p></div>
  <div class="card"><h2 style="margin:0 0 8px;font-size:17px">Used in class</h2>${usedBlock(p.stats)}</div>
  <div class="card author"><span class="av" aria-hidden="true">${esc(initials(p.author.name))}</span><div><a href="/community/authors/${esc(p.author.slug)}/"><b>${esc(p.author.name)}</b></a><div class="note">See all resources by this author</div></div></div>
 </aside>
</div>
${related.length >= 1 ? `<h2>Related resources</h2><ul class="cards">${related.slice(0, 8).map(resourceCard).join('')}</ul>` : ''}
<p class="note" style="margin-top:34px"><button class="rep" type="button" id="rep-open">Report this resource</button> &middot; <a href="/community.html">More in Community</a></p>
<div class="rep-box card" id="rep-box"><label for="rep-reason"><b>What is wrong?</b></label>
 <select id="rep-reason">${REASONS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>
 <textarea id="rep-note" rows="3" maxlength="500" placeholder="Tell us more (optional)" aria-label="More details"></textarea>
 <p style="margin:10px 0 0"><button class="btn" type="button" id="rep-send">Send report</button></p></div>`;
  return shell({ title, description, canonical: url, robots: p.indexable ? 'index, follow' : 'noindex, follow', ogImage: coverUrl(p), ld, body, script: RESOURCE_SCRIPT });
}

function renderAuthor(a) {
  const url = abs(`/community/authors/${a.canonical}/`);
  const bc = [{ label: 'Community', href: '/community.html', url: abs('/community.html') }, { label: a.author.name, url }];
  const ld = [{
    '@context': 'https://schema.org', '@type': 'ProfilePage', url,
    mainEntity: { '@type': 'Person', name: a.author.name, url, ...(a.author.bio ? { description: a.author.bio } : {}) },
  }, crumbLd(bc)];
  const stat = (n, label) => `<div class="stat"><b>${n}</b><span>${esc(label)}</span></div>`;
  const body = `${crumbs(bc)}
<h1>${esc(a.author.name)}</h1>
${a.author.bio ? `<p class="desc" style="margin:0 0 6px">${esc(a.author.bio)}</p>` : ''}
<div class="stats" style="margin:18px 0 6px">${stat(a.stats.published, 'Published resources')}${stat(a.stats.saves, 'Saves')}${stat(a.stats.taught, a.stats.taught === 1 ? 'Lesson taught' : 'Lessons taught')}${a.stats.pct != null ? stat(`${a.stats.pct}%`, 'of teachers who taught these said it worked well') : ''}</div>
${a.top.length ? `<h2>Top resources</h2><ul class="cards">${a.top.map(resourceCard).join('')}</ul>` : ''}
<h2>All published resources</h2><ul class="cards">${a.items.map(resourceCard).join('')}</ul>`;
  const title = `${a.author.name} — Teaching Resources | TeachEd`;
  const description = clip(`${a.author.name} shares ${a.stats.published} teaching resource${a.stats.published === 1 ? '' : 's'} on TeachEd Community.${a.stats.taught ? ` Taught in ${a.stats.taught} lesson${a.stats.taught === 1 ? '' : 's'}.` : ''}`, 155);
  return shell({ title, description, canonical: url, ogType: 'profile', ogImage: a.items[0] ? coverUrl(a.items[0]) : abs('/og-cover.png'), ld, body });
}

function renderEnd(status, heading, text) {
  return shell({ title: `${heading} | TeachEd`, description: text, canonical: abs('/community.html'), robots: 'noindex, nofollow', ogType: 'website',
    body: `<h1>${esc(heading)}</h1><p class="desc">${esc(text)}</p><p><a class="btn" href="/community.html">Browse Community</a></p>` });
}

module.exports = { slugify, authorSlug, ensureSlug, backfillSlugs, resolveResource, resolveAuthor, relatedTo, renderResource, renderAuthor, renderEnd, project, RESOURCE_SQL, BASE, abs };
