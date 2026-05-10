#!/usr/bin/env node

/**
 * Quick test to verify local Ollama integration.
 */

import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const OLLAMA_API_URL = process.env.OLLAMA_API_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3:0.6b';

console.log('Ollama AI Integration Test');
console.log(`Model: ${OLLAMA_MODEL}`);
console.log(`API: ${OLLAMA_API_URL}`);

async function testAPIConnection() {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: 'user',
            content: 'Respond with only the word SUCCESS.',
          },
        ],
        stream: false,
        options: {
          temperature: 0,
          num_predict: 20,
        },
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const error = await response.text();
      console.error(`Ollama API error: ${error}`);
      process.exit(1);
    }

    const data = await response.json();
    const result = data.message?.content?.trim() ?? '';

    if (result.toUpperCase().includes('SUCCESS')) {
      console.log(`Response: "${result}"`);
      console.log('Ollama AI integration is ready.');
      process.exit(0);
    }

    console.error(`Unexpected response: ${result}`);
    process.exit(1);
  } catch (error) {
    console.error(`Connection error: ${error}`);
    process.exit(1);
  }
}

testAPIConnection();
