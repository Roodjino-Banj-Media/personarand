const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuid } = require('uuid');
const { openDb } = require('../db');
const { uploadFile, getPublicUrl, deleteFile } = require('../lib/supabase');

const router = express.Router();

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

// Memory storage — serverless-compatible
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WebP, GIF, PDF.`));
  },
});

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { tag } = req.query;
    const rows = await db.prepare('SELECT * FROM visual_inspiration ORDER BY created_at DESC').all();
    const hydrated = rows.map((r) => ({ ...r, tags: normalizeArray(r.tags) }));
    const filtered = tag ? hydrated.filter((r) => r.tags.includes(tag)) : hydrated;
    res.json(filtered);
  } catch (e) { next(e); }
});

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (expected field "file")' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const safeBase = path.basename(req.file.originalname, ext).replace(/[^a-z0-9-_]/gi, '_').slice(0, 40);
    const storagePath = `${uuid()}-${safeBase}${ext}`;

    await uploadFile(storagePath, req.file.buffer, req.file.mimetype);
    const publicUrl = getPublicUrl(storagePath);

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : (typeof req.body.tags === 'string' ? safeJson(req.body.tags, []) : []);
    const notes = req.body.notes || null;

    const db = openDb();
    const info = await db.prepare(`
      INSERT INTO visual_inspiration (filename, filepath, tags, notes)
      VALUES (?, ?, ?::jsonb, ?)
    `).run([req.file.originalname, publicUrl, JSON.stringify(tags), notes]);
    const row = await db.prepare('SELECT * FROM visual_inspiration WHERE id = ?').get([info.lastInsertRowid]);
    res.status(201).json({ ...row, tags: normalizeArray(row.tags), storage_path: storagePath });
  } catch (err) {
    if (err instanceof multer.MulterError || err.message?.startsWith('Unsupported')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const { tags, notes } = req.body || {};
    const existing = await db.prepare('SELECT * FROM visual_inspiration WHERE id = ?').get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.prepare('UPDATE visual_inspiration SET tags = ?::jsonb, notes = ? WHERE id = ?').run([
      tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : JSON.stringify(normalizeArray(existing.tags)),
      notes !== undefined ? notes : existing.notes,
      req.params.id,
    ]);
    const row = await db.prepare('SELECT * FROM visual_inspiration WHERE id = ?').get([req.params.id]);
    res.json({ ...row, tags: normalizeArray(row.tags) });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const row = await db.prepare('SELECT * FROM visual_inspiration WHERE id = ?').get([req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    await db.prepare('DELETE FROM visual_inspiration WHERE id = ?').run([req.params.id]);
    // Best-effort: try to delete from Supabase Storage (extract path from public URL)
    if (row.filepath) {
      try {
        const url = new URL(row.filepath);
        const storagePath = url.pathname.split('/').pop();
        if (storagePath) await deleteFile(storagePath);
      } catch { /* ignore */ }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/tags', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare('SELECT tags FROM visual_inspiration').all();
    const allTags = new Set();
    for (const r of rows) for (const t of normalizeArray(r.tags)) allTags.add(t);
    res.json([...allTags].sort());
  } catch (e) { next(e); }
});

function normalizeArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function safeJson(s, fallback) {
  if (!s) return fallback;
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch { return fallback; }
}

module.exports = router;
