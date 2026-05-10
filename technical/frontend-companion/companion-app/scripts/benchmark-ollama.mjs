#!/usr/bin/env node
// @ts-check

/**
 * Ollama qwen3:1.7b Benchmark for AI Testing Framework
 * Runs directly against Ollama — no browser needed
 *
 * Usage: node scripts/benchmark-ollama.mjs
 */

const OLLAMA_URL = process.env.OLLAMA_API_URL ?? 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:4b';

/** Strip qwen3 chain-of-thought <think>...</think> blocks */
function stripThinking(raw) {
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

async function callOllama(prompt, options = {}) {
  const start = Date.now();
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.1, num_predict: 300, ...options },
    }),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const elapsed = Date.now() - start;
  const raw = data.message?.content ?? '';
  const clean = stripThinking(raw);
  const tokens = data.eval_count ?? 0;

  return { raw, clean, elapsed, tokens, tokensPerSec: tokens / (elapsed / 1000) };
}

// ── Benchmark Tasks ───────────────────────────────────────────────────────────

const SAMPLE_HTML = `
<html>
<body>
  <h1>Login — Milestone 2</h1>
  <form>
    <input type="email" placeholder="Email address" id="email" />
    <input type="password" placeholder="Password" id="password" />
    <button id="login-btn" type="submit">Sign In</button>
  </form>
  <a href="/signup">Create account</a>
  <p style="color:red" id="error-msg"></p>
</body>
</html>`.trim();

const SAMPLE_PAGE_TEXT = `
Companion App
Login — Milestone 2
Sign In
Create account
`.trim();

const tasks = [
  {
    name: 'Selector: find login button',
    prompt: `Given this HTML, return ONLY the CSS selector for the login/sign-in button. No explanation.\n\n${SAMPLE_HTML}`,
    validate: (clean) => clean.includes('#login-btn') || clean.includes('button') || clean.includes('[type'),
  },
  {
    name: 'Selector: find email input',
    prompt: `Given this HTML, return ONLY the CSS selector for the email input. No explanation.\n\n${SAMPLE_HTML}`,
    validate: (clean) => clean.includes('#email') || clean.includes('[type="email"]') || clean.includes('input'),
  },
  {
    name: 'Observation: is user logged in?',
    prompt: `Is this page showing a logged-in state or a login form?\n\nPage text:\n${SAMPLE_PAGE_TEXT}\n\nAnswer: YES (logged in) or NO (not logged in).`,
    validate: (clean) => clean.toUpperCase().includes('NO'),
  },
  {
    name: 'Observation: page type?',
    prompt: `What type of page is this? Options: login, home, onboarding, error.\n\nPage text:\n${SAMPLE_PAGE_TEXT}\n\nRespond with ONLY ONE WORD.`,
    validate: (clean) => clean.toLowerCase().includes('login'),
  },
  {
    name: 'State validation: form empty?',
    prompt: `A login form is visible with empty fields. Is the form ready to submit with valid data?\n\nPage text:\n${SAMPLE_PAGE_TEXT}\n\nAnswer only YES or NO.`,
    validate: (clean) => clean.toUpperCase().includes('NO'),
  },
  {
    name: 'Data extraction: page title',
    prompt: `Extract the page title from this content as JSON like {"title": "..."}.\n\nPage text:\n${SAMPLE_PAGE_TEXT}`,
    validate: (clean) => {
      try {
        const match = clean.match(/\{[\s\S]*?\}/);
        if (!match) return false;
        const obj = JSON.parse(match[0]);
        return typeof obj.title === 'string' && obj.title.length > 0;
      } catch {
        return false;
      }
    },
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

function bar(value, max = 10000, width = 30) {
  const filled = Math.round((Math.min(value, max) / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║        Ollama ${MODEL.padEnd(10)} — AI Testing Benchmark        ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Connectivity check
  try {
    const ping = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!ping.ok) throw new Error('Non-200');
    const tags = await ping.json();
    const models = tags.models?.map((m) => m.name) ?? [];
    console.log(`✅ Ollama running at ${OLLAMA_URL}`);
    console.log(`   Available models: ${models.join(', ')}`);
    console.log(`   Using: ${MODEL}\n`);
  } catch (err) {
    console.error(`❌ Cannot reach Ollama at ${OLLAMA_URL}`);
    console.error(`   Error: ${err.message}`);
    process.exit(1);
  }

  // Warm-up call
  process.stdout.write('🔥 Warm-up call... ');
  await callOllama('Say READY', { num_predict: 5 });
  console.log('done\n');

  const results = [];

  for (const task of tasks) {
    process.stdout.write(`  Running: ${task.name}... `);
    try {
      const { clean, elapsed, tokens, tokensPerSec } = await callOllama(task.prompt);
      const correct = task.validate(clean);
      results.push({ name: task.name, elapsed, tokens, tokensPerSec, correct, response: clean });
      console.log(`${correct ? '✅' : '❌'} ${elapsed}ms`);
    } catch (err) {
      results.push({ name: task.name, elapsed: -1, tokens: 0, tokensPerSec: 0, correct: false, response: String(err) });
      console.log(`❌ ERROR: ${err.message}`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.correct).length;
  const failed = results.length - passed;
  const avgMs = Math.round(results.filter((r) => r.elapsed > 0).reduce((s, r) => s + r.elapsed, 0) / results.length);
  const avgTps = (results.filter((r) => r.tokensPerSec > 0).reduce((s, r) => s + r.tokensPerSec, 0) / results.length).toFixed(1);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('BENCHMARK RESULTS\n');

  for (const r of results) {
    const status = r.correct ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} │ ${r.name}`);
    console.log(`       │ Speed: ${r.elapsed}ms  ${bar(r.elapsed)}  (${r.tokensPerSec.toFixed(1)} tok/s)`);
    const preview = r.response.replace(/\n/g, ' ').substring(0, 80);
    console.log(`       │ Response: "${preview}${r.response.length > 80 ? '...' : ''}"`);
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`SUMMARY`);
  console.log(`  Model:     ${MODEL}`);
  console.log(`  Accuracy:  ${passed}/${results.length} tasks correct (${Math.round((passed / results.length) * 100)}%)`);
  console.log(`  Avg Speed: ${avgMs}ms per request`);
  console.log(`  Avg Speed: ${avgTps} tokens/sec`);
  console.log(`  Passed:    ${passed}   Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const verdict = passed === results.length
    ? '🟢 EXCELLENT — Model ready for AI-assisted testing'
    : passed >= Math.ceil(results.length * 0.7)
    ? '🟡 ACCEPTABLE — Usable with manual fallback for failed tasks'
    : '🔴 POOR — Consider a larger model (qwen3:4b or mistral)';

  console.log(`\nVerdict: ${verdict}\n`);

  process.exit(passed === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
