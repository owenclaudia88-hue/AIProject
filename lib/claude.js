/**
 * One way to ask Claude for structured output.
 *
 * Written for the roadmap, and every lesson in it was paid for once already:
 *
 *   A tool call rather than typed JSON. "Return only valid JSON" works until
 *   one unescaped quote inside seventeen thousand characters loses the whole
 *   thing to a parse error.
 *
 *   Offered, never forced. Some models refuse tool_choice "tool" and "any"
 *   outright, and a 400 loses the answer just as completely as bad syntax.
 *
 *   A model that writes the answer out as prose instead is handed it back and
 *   asked once to deliver the same thing through the tool. Prose is far longer
 *   than the same content as a tool call, so an answer that hit the ceiling
 *   while writing it out usually fits once it is asked for the structure -
 *   which only works because running out of room is reported here rather than
 *   thrown.
 *
 *   Every model has its own ceiling on output, and asking for more than it
 *   allows is a 400 rather than a smaller answer, so a refusal about that one
 *   number drops back to a size known to be accepted.
 */

export const MODEL = process.env.CLAUDE_MODEL || process.env.ROADMAP_MODEL || 'claude-sonnet-5-5';

const SAFE_MAX = 16000;

/* Dollars per million tokens, for the models this project calls. Only ever
   used to show what a run cost; nothing decides anything on it, so a price
   that goes out of date makes a number wrong rather than a report. */
const PRICES = {
  'claude-sonnet-5-5': { in: 2, out: 10 },
  'claude-opus-5-5': { in: 4, out: 20 },
  'claude-haiku-4-5': { in: 1, out: 5 }
};

const priceFor = (model) => {
  const k = Object.keys(PRICES).find((p) => String(model || '').startsWith(p));
  return k ? PRICES[k] : PRICES['claude-sonnet-5-5'];
};

/**
 * What the calls in one run cost, added up as they happen.
 *
 * A report is five or six model calls - select, write, verify, and whatever
 * repair it needed - and until now nothing anywhere said what any of it cost.
 * The first anybody knew was the account running dry.
 *
 * Collected per run rather than globally, because "what did this report cost"
 * is the question somebody actually asks.
 */
export function newMeter() {
  const calls = [];
  return {
    record(model, usage) {
      if (!usage) return;
      const p = priceFor(model);
      const input = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
      const output = usage.output_tokens || 0;
      calls.push({ input, output, cost: (input / 1e6) * p.in + (output / 1e6) * p.out });
    },
    get total() {
      return {
        calls: calls.length,
        input: calls.reduce((n, c) => n + c.input, 0),
        output: calls.reduce((n, c) => n + c.output, 0),
        // Rounded to the cent that will be charged, not to the fraction the
        // arithmetic produces.
        usd: Math.round(calls.reduce((n, c) => n + c.cost, 0) * 100) / 100
      };
    }
  };
}

async function ask(messages, tool, budget) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const err = new Error('ANTHROPIC_API_KEY is not set');
    err.code = 'no_key';
    throw err;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: budget,
      tools: [tool],
      messages
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 400 && /max_tokens/i.test(body) && budget > SAFE_MAX) {
      return ask(messages, tool, SAFE_MAX);
    }
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  const call = (data.content || []).find((c) => c.type === 'tool_use' && c.name === tool.name);

  return {
    data: call ? call.input : null,
    text,
    model: data.model || MODEL,
    usage: data.usage || null,
    truncated: data.stop_reason === 'max_tokens'
  };
}

/**
 * The answer, as data.
 *
 * `tool` is { name, description, input_schema }. Returns { data, text, model }
 * where data is the tool input, or null if the model never called it and the
 * caller has to deal with prose.
 */
export async function callTool(prompt, tool, { maxTokens = 32000, meter = null } = {}) {
  const first = await ask([{ role: 'user', content: prompt }], tool, maxTokens);
  if (meter) meter.record(first.model, first.usage);
  if (first.data && !first.truncated) return first;
  if (!first.data && !first.text) throw new Error('the model returned nothing at all');

  const again = await ask([
    { role: 'user', content: prompt },
    { role: 'assistant', content: first.text || '(cut off)' },
    { role: 'user', content: first.truncated
      ? `That was cut off. Deliver the whole thing by calling the ${tool.name} tool, nothing else.`
      : `Deliver that same answer by calling the ${tool.name} tool. Change nothing about it.` }
  ], tool, maxTokens);
  if (meter) meter.record(again.model, again.usage);

  if (again.data && !again.truncated) return again;
  if (first.truncated || again.truncated) throw new Error('the model ran out of room before finishing');
  return again.data ? again : first;
}

/** Models occasionally fence their JSON however firmly they were asked not to. */
export function parseJson(text) {
  let t = String(text || '').trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first > 0 || last < t.length - 1) t = t.slice(first, last + 1);
  return JSON.parse(t);
}
