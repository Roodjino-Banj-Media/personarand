// Supabase client for Auth + Storage only. DB access goes through lib/db.js.
const { createClient } = require('@supabase/supabase-js');

let adminClient = null;
function getAdmin() {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set.');
  adminClient = createClient(url, key, { auth: { persistSession: false } });
  return adminClient;
}

// Validate a user JWT from Authorization header. Returns user or null.
async function validateJwt(token) {
  if (!token) return null;
  try {
    const { data, error } = await getAdmin().auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

// Storage helpers (uploads bucket).
const UPLOADS_BUCKET = 'uploads';

async function uploadFile(filename, buffer, contentType) {
  const admin = getAdmin();
  const { data, error } = await admin.storage
    .from(UPLOADS_BUCKET)
    .upload(filename, buffer, { contentType, upsert: false });
  if (error) throw error;
  return data;
}

function getPublicUrl(path) {
  const { data } = getAdmin().storage.from(UPLOADS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function deleteFile(path) {
  const { error } = await getAdmin().storage.from(UPLOADS_BUCKET).remove([path]);
  if (error) throw error;
}

module.exports = { getAdmin, validateJwt, uploadFile, getPublicUrl, deleteFile, UPLOADS_BUCKET };
