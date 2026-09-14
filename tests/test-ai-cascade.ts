import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function runCascadeTest() {
  console.log('=== Agent HQ AI Provider Cascade Verification ===\n');

  const rawGeminiKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const geminiKeys = rawGeminiKeys
    .split(',')
    .map(k => k.trim())
    .filter(k => Boolean(k && k !== 'MY_GEMINI_API_KEY' && k.length > 5));

  console.log(`Detected ${geminiKeys.length} Gemini API Key(s) in pool.`);
  console.log(`Groq API Key configured: ${Boolean(process.env.GROQ_API_KEY)}`);
  console.log(`OpenAI API Key configured: ${Boolean(process.env.OPENAI_API_KEY)}`);

  if (geminiKeys.length === 0) {
    throw new Error('No valid Gemini API keys found in .env');
  }

  // Test first key
  console.log('\n--- Testing Gemini API Key #1 connectivity ---');
  const client1 = new GoogleGenAI({ apiKey: geminiKeys[0] });
  try {
    const res = await client1.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: 'Respond with exactly: {"status":"operational","engine":"gemini"}',
    });
    console.log('[PASS] Key #1 Response:', res.text?.trim());
  } catch (err: any) {
    console.error('[FAIL] Key #1 error:', err.message);
  }

  // Test Groq if present
  if (process.env.GROQ_API_KEY) {
    console.log('\n--- Testing Groq Cloud connectivity ---');
    try {
      const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Respond with exactly: OK' }],
          max_tokens: 10,
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        console.log(`[PASS] Groq Cloud (${model}) response:`, data.choices?.[0]?.message?.content?.trim());
      } else {
        console.warn('[WARN] Groq returned status:', res.status, await res.text());
      }
    } catch (err: any) {
      console.warn('[WARN] Groq request failed:', err.message);
    }
  }

  // Test OpenAI if present
  if (process.env.OPENAI_API_KEY) {
    console.log('\n--- Testing OpenAI connectivity ---');
    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4o';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Respond with exactly: OK' }],
          max_tokens: 10,
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        console.log(`[PASS] OpenAI (${model}) response:`, data.choices?.[0]?.message?.content?.trim());
      } else {
        console.warn('[WARN] OpenAI returned status:', res.status, await res.text());
      }
    } catch (err: any) {
      console.warn('[WARN] OpenAI request failed:', err.message);
    }
  }

  console.log('\n=== All Provider Cascade Checks Complete ===');
}

runCascadeTest().catch(console.error);
