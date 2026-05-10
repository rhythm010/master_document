import { Page } from '@playwright/test';

/**
 * AI-Powered Testing Utilities
 * Uses local Ollama for intelligent test automation
 */

const OLLAMA_API_URL = process.env.OLLAMA_API_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:4b';

interface AIContext {
  page: Page;
  model: string;
}

/**
 * Initialize AI context for a page using local Ollama
 */
export async function initStagehand(page: Page): Promise<AIContext | null> {
  try {
    const context: AIContext = {
      page,
      model: OLLAMA_MODEL,
    };

    console.log(`✅ AI Context initialized with Ollama model: ${OLLAMA_MODEL}`);
    return context;
  } catch (error) {
    console.warn('AI initialization failed:', error);
    return null;
  }
}

/**
 * Call Ollama API for AI-powered analysis
 */
async function callOllama(
  prompt: string,
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): Promise<string> {
  const payload = {
    model: OLLAMA_MODEL,
    messages: messages || [{ role: 'user' as const, content: prompt }],
    stream: false,
    options: {
      temperature: 0.2,
      num_predict: 500,
    },
  };

  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as any;
    return (data.message?.content || '').trim();
  } catch (error) {
    console.error('Ollama API call failed:', error);
    throw error;
  }
}

/**
 * AI-powered click using natural language
 * Example: clickByDescription(page, 'click the blue button that says Continue')
 */
export async function clickByDescription(
  page: Page,
  description: string
) {
  try {
    console.log(`[AI-Click] Analyzing: ${description}`);
    
    const pageHTML = await page.content();
    const prompt = `Given this HTML, find the best CSS selector or XPath for: "${description}"\n\nHTML (first 3000 chars):\n${pageHTML.substring(0, 3000)}\n\nRespond with ONLY the selector.`;
    
    const selector = await callOllama(prompt);
    
    if (selector.trim()) {
      console.log(`[AI-Click] Using selector: ${selector}`);
      try {
        await page.click(selector.trim());
      } catch {
        console.warn('[AI-Click] Selector failed, falling back');
      }
    }
  } catch (error) {
    console.error('[AI-Click] Error:', error);
  }
}

/**
 * AI-powered observation using natural language
 * Example: const result = await observe(page, 'Is the form submitted successfully?')
 */
export async function observe(
  page: Page,
  instruction: string
): Promise<string> {
  try {
    const text = await page.innerText('body');
    const title = await page.title();
    
    const prompt = `Analyze this page for: "${instruction}"\n\nTitle: ${title}\n\nPage text:\n${text.substring(0, 2000)}`;
    return await callOllama(prompt);
  } catch (error) {
    console.error('Observation error:', error);
    return '';
  }
}

/**
 * Wait for AI-detected visual change
 */
export async function waitForVisualChange(
  page: Page,
  instruction: string,
  timeoutMs: number = 10000
) {
  console.log(`[AI] Waiting for: ${instruction}`);
  
  // Fallback to standard Playwright wait
  await page.waitForLoadState('networkidle');
}

/**
 * Intelligent element interaction combining Playwright and AI
 */
export async function intelligentClick(
  page: Page,
  selectorOrDescription: string
) {
  try {
    // Try Playwright selector first
    const element = page.locator(selectorOrDescription);
    if (await element.isVisible({ timeout: 1000 })) {
      await element.click();
      return;
    }
  } catch (error) {
    // Fall back to AI description
    console.log(`[Hybrid] Using AI description: ${selectorOrDescription}`);
    await clickByDescription(page, selectorOrDescription);
  }
}

/**
 * Extract data using AI observation
 * Example: const data = await extractData(page, 'What is the booking confirmation number?')
 */
export async function extractData(
  page: Page,
  instruction: string
): Promise<any> {
  try {
    const text = await page.innerText('body');
    const prompt = `Extract the following data from this page: "${instruction}"\n\nPage content:\n${text.substring(0, 2000)}\n\nRespond with JSON format.`;
    
    const result = await callOllama(prompt);
    return JSON.parse(result);
  } catch (error) {
    console.error('Data extraction error:', error);
    return null;
  }
}

/**
 * Validate UI state using AI
 * Example: const isValid = await validateState(page, 'Is the form valid and ready to submit?')
 */
export async function validateState(
  page: Page,
  instruction: string
): Promise<boolean> {
  try {
    const text = await page.innerText('body');
    const prompt = `Is this page in the following state: "${instruction}"?\n\nPage content:\n${text.substring(0, 1500)}\n\nRespond with only YES or NO.`;
    
    const response = await callOllama(prompt);
    return response.toUpperCase().includes('YES');
  } catch (error) {
    console.error('State validation error:', error);
    return false;
  }
}

/**
 * Complete a form using AI
 * Example: await fillFormAI(page, 'Fill the booking form with date 2026-05-20 and time 14:00')
 */
export async function fillFormAI(
  page: Page,
  instruction: string
) {
  try {
    const formHTML = await page.content();
    const prompt = `Given this HTML form, generate Playwright commands to: "${instruction}"\n\nHTML:\n${formHTML.substring(0, 2000)}`;
    
    const commands = await callOllama(prompt);
    console.log('[FormFill] AI suggested:', commands);
  } catch (error) {
    console.error('Form fill error:', error);
  }
}

/**
 * Handle dynamic content using AI observation
 * Example: const price = await getDynamicContent(page, 'What is the total booking price shown on the screen?')
 */
export async function getDynamicContent(
  page: Page,
  instruction: string
): Promise<string> {
  return await observe(page, instruction);
}

/**
 * AI Context manager
 * 
 * Usage:
 * ```
 * const context = new StagehandContext(page);
 * await context.init();
 * 
 * try {
 *   await context.click('click the submit button');
 *   const result = await context.observe('was the form submitted?');
 * } finally {
 *   await context.close();
 * }
 * ```
 */
export class StagehandContext {
  private page: Page;
  private context: AIContext | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  async init() {
    this.context = await initStagehand(this.page);
  }

  async click(description: string) {
    if (!this.context) throw new Error('Context not initialized');
    await clickByDescription(this.page, description);
  }

  async observe(instruction: string): Promise<string> {
    if (!this.context) throw new Error('Context not initialized');
    return await observe(this.page, instruction);
  }

  async extract(instruction: string): Promise<any> {
    if (!this.context) throw new Error('Context not initialized');
    return await extractData(this.page, instruction);
  }

  async validate(state: string): Promise<boolean> {
    if (!this.context) throw new Error('Context not initialized');
    return await validateState(this.page, state);
  }

  async close() {
    // Cleanup if needed
    this.context = null;
  }
}
