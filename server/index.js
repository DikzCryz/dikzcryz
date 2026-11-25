import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const port = Number(process.env.PORT || 8787);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const primaryModel = (process.env.GEMINI_CHAT_MODEL || 'gemini-3.1-flash-lite').trim();
const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.8-flash')
  .split(',').map(x => x.trim()).filter(Boolean);
const models = [...new Set([primaryModel, ...fallbackModels])];
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';
const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || 'eleven_v3';
const allowed = (process.env.ALLOWED_ORIGINS || 'https://appassets.androidplatform.net')
  .split(',').map(x => x.trim()).filter(Boolean);
const usage = new Map();

app.disable('x-powered-by');
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Origin tidak diizinkan'));
  }
}));
app.use(express.json({ limit: '32kb' }));

const systemPrompt = `Kamu adalah Sairi, asisten virtual orisinal di aplikasi DikzCryz. Berbahasa Indonesia yang natural, hangat, sopan, ringkas tetapi membantu. Jangan mengaku sebagai manusia. Jika tidak tahu, katakan dengan jujur. Bantu belajar, pemrograman, dan penggunaan aplikasi dengan aman. Jangan meminta kata sandi, token rahasia, atau API key pengguna.`;

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'DikzCryz Sairi API',
    ai: GEMINI_API_KEY ? 'configured' : 'not_configured',
    voice: ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID ? 'configured' : 'not_configured'
  });
});

async function validSession(session) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase belum dikonfigurasi.');
  if (typeof session !== 'string' || !/^[0-9a-f-]{36}$/i.test(session)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/whoami`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_session: session }),
      signal: controller.signal
    });
    if (!r.ok) return false;
    const data = await r.json();
    return !!(data && data.id);
  } finally {
    clearTimeout(timer);
  }
}

function limit(session, kind) {
  const now = Date.now();
  const key = `${session}:${kind}`;
  const max = kind === 'voice' ? 12 : 40;
  const windowMs = 60 * 60 * 1000;
  const list = (usage.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now);
  usage.set(key, list);
  // Bersihkan entri kedaluwarsa agar Map tidak tumbuh tanpa batas.
  if (usage.size > 5000) {
    for (const [k, timestamps] of usage) {
      if (!timestamps.some(t => now - t < windowMs)) usage.delete(k);
    }
  }
  return true;
}

async function authorize(req, res, kind) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(503).json({ error: 'Server akun belum dikonfigurasi oleh pengelola.' });
    return false;
  }
  try {
    if (!(await validSession(req.body?.session))) {
      res.status(401).json({ error: 'Sesi tidak valid. Silakan masuk ulang.' });
      return false;
    }
  } catch {
    res.status(503).json({ error: 'Tidak dapat memeriksa sesi aplikasi.' });
    return false;
  }
  if (!limit(req.body.session, kind)) {
    res.status(429).json({ error: 'Batas penggunaan sementara tercapai. Coba lagi nanti.' });
    return false;
  }
  return true;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const normalized = history.slice(-12).map(item => ({
    role: item?.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(item?.content || '').trim().slice(0, 1800) }]
  })).filter(item => item.parts[0].text);
  // Gemini mengharuskan giliran percakapan berurutan; hilangkan pesan berurutan
  // dari role sama untuk menghindari payload yang tidak valid.
  const compact = [];
  for (const item of normalized) {
    if (compact.length && compact[compact.length - 1].role === item.role) {
      compact[compact.length - 1] = item;
    } else compact.push(item);
  }
  // Riwayat harus dimulai dari user.
  while (compact.length && compact[0].role !== 'user') compact.shift();
  return compact;
}

async function callGemini(model, contents) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 700 }
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error?.message || `Gemini gagal (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    const reply = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    if (!reply) {
      const error = new Error('Gemini tidak mengembalikan teks jawaban.');
      error.status = 502;
      throw error;
    }
    return reply;
  } finally {
    clearTimeout(timer);
  }
}

app.post('/api/chat', async (req, res) => {
  if (!(await authorize(req, res, 'chat'))) return;
  if (!GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini API belum dikonfigurasi oleh pengelola.' });
  const message = String(req.body.message || '').trim();
  if (!message || message.length > 1800) {
    return res.status(400).json({ error: 'Pesan kosong atau terlalu panjang (maksimal 1.800 karakter).' });
  }
  const history = normalizeHistory(req.body.history);
  const contents = [...history, { role: 'user', parts: [{ text: message }] }];
  let lastError;
  for (const model of models) {
    try {
      const reply = await callGemini(model, contents);
      return res.json({ reply, model });
    } catch (error) {
      lastError = error;
      // Fallback hanya untuk gangguan model/kuota sementara atau model ID tidak tersedia.
      // Kesalahan kredensial/izin tidak akan dicoba berulang pada model lain.
      if (![404, 429, 500, 502, 503, 504].includes(error.status)) break;
    }
  }
  const status = lastError?.status || 502;
  if (status === 429) {
    return res.status(429).json({ error: 'Kuota model AI sedang tercapai. Semua model cadangan yang dikonfigurasi juga belum tersedia. Coba lagi nanti.' });
  }
  if (status === 401 || status === 403) {
    return res.status(502).json({ error: 'Akses Gemini ditolak. Pengelola perlu memeriksa API key dan izin project.' });
  }
  return res.status(502).json({ error: lastError?.name === 'AbortError' ? 'Layanan AI terlalu lama merespons.' : 'Semua model Sairi sedang tidak tersedia. Coba lagi nanti.' });
});

app.post('/api/voice', async (req, res) => {
  if (!(await authorize(req, res, 'voice'))) return;
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    return res.status(503).json({ error: 'Layanan suara belum dikonfigurasi oleh pengelola.' });
  }
  const text = String(req.body.text || '').trim();
  if (!text || text.length > 1400) {
    return res.status(400).json({ error: 'Teks VN kosong atau terlalu panjang (maksimal 1.400 karakter).' });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: TTS_MODEL, language_code: 'id', voice_settings: { stability: 0.48, similarity_boost: 0.78, style: 0.35, use_speaker_boost: true } }),
        signal: controller.signal
      });
      if (!upstream.ok) {
        let data = {}; try { data = await upstream.json(); } catch {}
        return res.status(upstream.status === 429 ? 429 : 502).json({ error: data.detail?.message || data.detail || 'Pembuatan VN gagal.' });
      }
      const bytes = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Length', bytes.length);
      return res.send(bytes);
    } finally { clearTimeout(timer); }
  } catch (error) {
    return res.status(502).json({ error: error.name === 'AbortError' ? 'Pembuatan VN terlalu lama.' : 'Tidak dapat menghubungi layanan suara.' });
  }
});

app.use((err, _req, res, _next) => {
  if (err?.message === 'Origin tidak diizinkan') return res.status(403).json({ error: err.message });
  return res.status(400).json({ error: 'Permintaan tidak dapat diproses.' });
});

app.listen(port, '0.0.0.0', () => console.log(`DikzCryz Sairi API berjalan pada port ${port}`));
