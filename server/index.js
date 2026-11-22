import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const port = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-mini';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || 'eleven_v4';
const allowed = (process.env.ALLOWED_ORIGINS || 'https://appassets.androidplatform.net').split(',').map(x => x.trim()).filter(Boolean);
const usage = new Map();

app.use(cors({ origin(origin, cb) { if (!origin || allowed.includes(origin)) return cb(null, true); cb(new Error('Origin tidak diizinkan')); } }));
app.use(express.json({ limit: '32kb' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'DikzCryz Sairi API' }));

async function validSession(session) {
  if (typeof session !== 'string' || !/^[0-9a-f-]{36}$/i.test(session)) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/whoami`, {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_session: session })
  });
  if (!r.ok) return false;
  const data = await r.json();
  return !!(data && data.id);
}
function limit(session, kind) {
  const now = Date.now(); const key = `${session}:${kind}`; const max = kind === 'voice' ? 12 : 40;
  const hour = 60 * 60 * 1000; const list = (usage.get(key) || []).filter(t => now - t < hour);
  if (list.length >= max) return false;
  list.push(now); usage.set(key, list); return true;
}
async function authorize(req, res, kind) {
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) { res.status(503).json({ error: 'Server AI belum dikonfigurasi oleh pengelola.' }); return false; }
  try {
    if (!(await validSession(req.body?.session))) { res.status(401).json({ error: 'Sesi tidak valid. Silakan masuk ulang.' }); return false; }
  } catch { res.status(503).json({ error: 'Tidak dapat memeriksa sesi aplikasi.' }); return false; }
  if (!limit(req.body.session, kind)) { res.status(429).json({ error: 'Batas penggunaan sementara tercapai. Coba lagi nanti.' }); return false; }
  return true;
}
const systemPrompt = `Kamu adalah Sairi, asisten virtual orisinal di aplikasi DikzCryz. Berbahasa Indonesia yang natural, hangat, sopan, ringkas tetapi membantu. Jangan mengaku sebagai manusia. Jika tidak tahu, katakan dengan jujur. Bantu belajar, pemrograman, dan penggunaan aplikasi dengan aman. Jangan meminta kata sandi, token rahasia, atau API key pengguna.`;

app.post('/api/chat', async (req, res) => {
  if (!(await authorize(req, res, 'chat'))) return;
  const message = String(req.body.message || '').trim();
  if (!message || message.length > 1800) return res.status(400).json({ error: 'Pesan kosong atau terlalu panjang (maksimal 1.800 karakter).' });
  const history = Array.isArray(req.body.history) ? req.body.history.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 1800) })) : [];
  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: CHAT_MODEL, instructions: systemPrompt, input: [...history, { role: 'user', content: message }], max_output_tokens: 700 })
    });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status >= 500 ? 502 : 400).json({ error: data.error?.message || 'Layanan AI gagal memproses pesan.' });
    const reply = data.output?.flatMap(item => item.content || []).filter(part => part.type === 'output_text').map(part => part.text).join('\n').trim();
    if (!reply) return res.status(502).json({ error: 'AI tidak mengembalikan teks jawaban.' });
    res.json({ reply });
  } catch { res.status(502).json({ error: 'Tidak dapat menghubungi layanan AI.' }); }
});

app.post('/api/voice', async (req, res) => {
  if (!(await authorize(req, res, 'voice'))) return;
  const text = String(req.body.text || '').trim();
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) return res.status(503).json({ error: 'Layanan suara belum dikonfigurasi oleh pengelola.' });
  if (!text || text.length > 1400) return res.status(400).json({ error: 'Teks VN kosong atau terlalu panjang (maksimal 1.400 karakter).' });
  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: TTS_MODEL, language_code: 'id', voice_settings: { stability: 0.48, similarity_boost: 0.78, style: 0.35, use_speaker_boost: true } })
    });
    if (!upstream.ok) { let d={}; try{d=await upstream.json()}catch{} return res.status(upstream.status >= 500 ? 502 : 400).json({ error: d.detail?.message || d.detail || 'Pembuatan VN gagal.' }); }
    res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Cache-Control', 'no-store');
    const bytes = Buffer.from(await upstream.arrayBuffer()); res.setHeader('Content-Length', bytes.length); res.send(bytes);
  } catch { res.status(502).json({ error: 'Tidak dapat menghubungi layanan suara.' }); }
});

app.listen(port, () => console.log(`DikzCryz Sairi API berjalan pada port ${port}`));
