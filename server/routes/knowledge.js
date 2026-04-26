const express = require('express');
const { openDb } = require('../db');
const { invalidateKbCache } = require('../lib/anthropic');

const router = express.Router();

const CATEGORIES = ['note', 'project', 'client', 'framework', 'positioning', 'voice', 'haiti', 'other'];

// Rough token estimate: ~4 chars per token for English prose
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`SELECT * FROM knowledge_base ORDER BY is_active DESC, updated_at DESC`).all();
    const totalActiveTokens = rows.filter((r) => r.is_active).reduce((s, r) => s + (r.token_estimate || 0), 0);
    res.json({ entries: rows, total_active_tokens: totalActiveTokens, categories: CATEGORIES });
  } catch (e) { next(e); }
});

router.get('/export', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`SELECT * FROM knowledge_base ORDER BY category ASC, updated_at DESC`).all();
    const date = new Date().toISOString().slice(0, 10);
    const lines = [
      `# Knowledge Base Export`,
      `> Exported ${date} · ${rows.length} entries`,
      ``,
    ];
    for (const r of rows) {
      const updated = r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : '—';
      lines.push('---');
      lines.push('');
      lines.push(`## ${r.title}`);
      lines.push('');
      lines.push(`- **Category:** ${r.category}`);
      lines.push(`- **Active:** ${r.is_active ? 'yes' : 'no'}`);
      lines.push(`- **Tokens:** ~${r.token_estimate || 0}`);
      lines.push(`- **Last updated:** ${updated}`);
      lines.push('');
      lines.push(r.content_md || '');
      lines.push('');
    }
    const markdown = lines.join('\n');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="knowledge-export-${date}.md"`);
    res.send(markdown);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const row = await db.prepare(`SELECT * FROM knowledge_base WHERE id = ?`).get([req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { title, category, content_md, is_active = true } = req.body || {};
    if (!title || !content_md) return res.status(400).json({ error: 'title + content_md required' });
    const tokens = estimateTokens(content_md);
    const info = await db.prepare(`
      INSERT INTO knowledge_base (title, category, content_md, is_active, token_estimate)
      VALUES (?, ?, ?, ?, ?)
    `).run([title, category || 'note', content_md, is_active ? true : false, tokens]);
    const row = await db.prepare(`SELECT * FROM knowledge_base WHERE id = ?`).get([info.lastInsertRowid]);
    invalidateKbCache();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const { title, category, content_md, is_active } = req.body || {};
    const existing = await db.prepare(`SELECT * FROM knowledge_base WHERE id = ?`).get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const nextContent = content_md ?? existing.content_md;
    const tokens = estimateTokens(nextContent);
    await db.prepare(`
      UPDATE knowledge_base SET title = ?, category = ?, content_md = ?, is_active = ?, token_estimate = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run([
      title ?? existing.title,
      category ?? existing.category,
      nextContent,
      is_active !== undefined ? (is_active ? true : false) : existing.is_active,
      tokens,
      req.params.id,
    ]);
    const row = await db.prepare(`SELECT * FROM knowledge_base WHERE id = ?`).get([req.params.id]);
    invalidateKbCache();
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const r = await db.prepare(`DELETE FROM knowledge_base WHERE id = ?`).run([req.params.id]);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    invalidateKbCache();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/**
 * POST /api/knowledge/import-markdown
 *
 * Bulk-create entries from a markdown document. The parser splits on
 * level-2 headings (`## Title`); each section becomes one KB entry.
 * Optional metadata lines immediately under the heading are honored:
 *
 *   ## My entry title
 *   - Category: framework
 *   - Active: yes
 *
 *   …content here…
 *
 * Bullet metadata lines are stripped from the saved content_md so they
 * don't pollute the AI's context. Anything not parseable as a metadata
 * line stays in content.
 *
 * The endpoint is idempotent at the call level — if you import the
 * same markdown twice you'll get duplicate entries. We do NOT de-dupe
 * on title because the user might intentionally have different
 * versions of "Working with X" notes. The Knowledge view's Pause and
 * Delete actions are the right place to clean up.
 *
 * Body: { markdown: string, default_category?: string, default_active?: boolean }
 * Returns: { created: number, entries: [...] }
 */
router.post('/import-markdown', async (req, res, next) => {
  try {
    const db = openDb();
    const { markdown, default_category = 'note', default_active = true } = req.body || {};
    if (!markdown || typeof markdown !== 'string') {
      return res.status(400).json({ error: 'markdown (string) required' });
    }
    const sections = parseMarkdownSections(markdown);
    if (sections.length === 0) {
      return res.status(400).json({ error: 'No level-2 headings (## Title) found in the markdown.' });
    }
    if (sections.length > 50) {
      return res.status(400).json({ error: `Too many sections (${sections.length}). Cap is 50 per import.` });
    }

    const created = [];
    for (const sec of sections) {
      const category = CATEGORIES.includes(sec.category) ? sec.category : default_category;
      const isActive = sec.is_active != null ? sec.is_active : default_active;
      const tokens = estimateTokens(sec.content_md);
      const info = await db.prepare(`
        INSERT INTO knowledge_base (title, category, content_md, is_active, token_estimate)
        VALUES (?, ?, ?, ?, ?)
      `).run([sec.title, category, sec.content_md, !!isActive, tokens]);
      const row = await db.prepare(`SELECT * FROM knowledge_base WHERE id = ?`).get([info.lastInsertRowid]);
      created.push(row);
    }
    invalidateKbCache();
    res.json({ created: created.length, entries: created });
  } catch (e) { next(e); }
});

/**
 * Split markdown into { title, content_md, category?, is_active? } sections
 * keyed off level-2 (`## `) headings. Sections with no heading at all are
 * skipped — we need a title for each entry.
 *
 * Metadata bullets immediately under the heading are extracted into the
 * structured fields; the rest of the section becomes content.
 */
function parseMarkdownSections(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let current = null;

  function flush() {
    if (!current) return;
    // Trim leading metadata bullets, then strip trailing whitespace.
    const contentLines = current._raw.slice();
    while (contentLines.length > 0 && contentLines[0].trim() === '') contentLines.shift();
    while (contentLines.length > 0 && contentLines[contentLines.length - 1].trim() === '') contentLines.pop();
    const content_md = contentLines.join('\n').trim();
    if (current.title) {
      sections.push({
        title: current.title,
        content_md,
        category: current.category,
        is_active: current.is_active,
      });
    }
    current = null;
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      flush();
      current = { title: headingMatch[1].trim(), _raw: [], category: null, is_active: null };
      continue;
    }
    if (!current) continue; // skip pre-heading content
    // Metadata bullets: `- Category: foo` or `- Active: yes/no`
    const metaMatch = line.match(/^\s*-\s*(category|active)\s*:\s*(.+?)\s*$/i);
    if (metaMatch && current._raw.length === 0) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].toLowerCase().trim();
      if (key === 'category') current.category = val;
      if (key === 'active') current.is_active = ['yes', 'true', '1'].includes(val);
      continue; // don't push to content
    }
    current._raw.push(line);
  }
  flush();
  return sections;
}

// Bulk toggle active/inactive
router.post('/toggle', async (req, res, next) => {
  try {
    const db = openDb();
    const { ids, is_active } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids[] required' });
    for (const id of ids) {
      await db.prepare(`UPDATE knowledge_base SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run([!!is_active, id]);
    }
    invalidateKbCache();
    res.json({ ok: true, updated: ids.length });
  } catch (e) { next(e); }
});

module.exports = router;
