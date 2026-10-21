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
      /* One call per reply. Left to itself the model split a roadmap across
         two calls - goal, opening and start-here in one, the rest in another -
         and only the first was ever read, so the plan arrived without its
         phases. "auto" because forcing the tool is refused on current
         models; this only caps how many calls a reply may hold. */
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
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
  // Every call in the reply, not only ours: each one has to be answered if
  // the reply is handed back, or the API refuses the whole request.
  const callIds = (data.content || []).filter((c) => c.type === 'tool_use').map((c) => c.id);

  return {
    data: call ? call.input : null,
    text,
    model: data.model || MODEL,
    usage: data.usage || null,
    truncated: data.stop_reason === 'max_tokens',
    // The whole reply and the call in it, for handing a malformed call back.
    content: data.content || [],
    callId: call ? call.id : null,
    callIds
  };
}

/* The top-level fields the tool requires that this call left out. */
function missingFields(input, tool) {
  const need = Array.isArray(tool?.input_schema?.required) ? tool.input_schema.required : [];
  return need.filter((k) => input == null || input[k] === undefined || input[k] === null);
}

/**
 * One more try when a call arrives without fields its tool requires.
 *
 * The API does not hold a tool call to its schema, so a model can finish a
 * call in the wrong shape and nothing objects. A roadmap came back as goal,
 * opening, startHere and a top-level "steps" - the start-here object closed
 * early and its steps spilled out, with no revenue and no phases - and the
 * member saw "the model returned no usable phases".
 *
 * The reply goes back exactly as it came, thinking and all, with the call
 * answered as an error that names what is missing - the way a failed tool is
 * reported - and the model is asked for the whole thing again. Once: a second
 * malformed answer is returned as it is, for the caller's own check to report.
 */
async function completeCall(prompt, tool, got, maxTokens, meter) {
  const missing = missingFields(got.data, tool);
  if (!missing.length || !got.callId) return got;

  const fields = Object.keys(tool.input_schema?.properties || {});
  console.error(`[claude] ${tool.name} call missing ${missing.join(', ')}`
    + ` (came back with: ${Object.keys(got.data || {}).join(', ') || 'nothing'}); asking again`);

  const again = await ask([
    { role: 'user', content: prompt },
    { role: 'assistant', content: got.content },
    /* A result for every call the reply made. The first retry that went out
       answered only one of two, and the API turned the request down. */
    { role: 'user', content: (got.callIds.length ? got.callIds : [got.callId]).map((id) => ({
      type: 'tool_result', tool_use_id: id, is_error: true,
      content: `That call is missing required field(s): ${missing.join(', ')}. `
        + `It came back with: ${Object.keys(got.data || {}).join(', ') || 'nothing'}. `
        + `The top level of the input takes exactly these fields: ${fields.join(', ')}. `
        + `Call ${tool.name} again, once, with the complete answer in that one call.`
    })) }
  ], tool, maxTokens);
  if (meter) meter.record(again.model, again.usage);

  return again.data && !again.truncated && !missingFields(again.data, tool).length ? again : got;
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
  if (first.data && !first.truncated) return completeCall(prompt, tool, first, maxTokens, meter);
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
