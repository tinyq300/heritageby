'use strict';
const heroines = require('../js/heroines.js');
const policy = require('../js/chat-policy.js');

function cleanAnswer(value, heroine) {
    if (typeof value !== 'string' || value.length > 10000) return null;
    try {
        const parsed = JSON.parse(value.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
        const ids = new Set(heroine.knowledge.map(note => note.id));
        if (parsed.onTopic !== true || typeof parsed.answer !== 'string' || !parsed.answer.trim() || parsed.answer.length > 2500 ||
            !Array.isArray(parsed.factIds) || !parsed.factIds.length || !parsed.factIds.every(id => ids.has(id))) return null;
        const answer = parsed.answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (!answer || /<[^>]*>|https?:\/\//i.test(answer)) return null;
        if (policy.classify(answer, heroine).kind === 'future') return null;
        if ([...answer.matchAll(/\b(1\d{3}|20\d{2}|21\d{2})\b/g)].some(m => Number(m[1]) > heroine.contextYear)) return null;
        return answer;
    } catch { return null; }
}

async function answerChat(body, { apiKey = '', model = 'openrouter/free', fetchImpl = fetch } = {}) {
    if (!body || typeof body.heroineId !== 'string' || !Object.hasOwn(heroines, body.heroineId) ||
        typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1200) {
        return { status: 400, body: { error: 'Укажите героиню и вопрос длиной до 1200 символов.' } };
    }
    const heroine = heroines[body.heroineId];
    // Use only valid user/assistant turns. System prompts and person data always belong to the server.
    const history = (Array.isArray(body.history) ? body.history : []).slice(-8).filter(item => item &&
        ['user', 'assistant'].includes(item.role) && typeof item.content === 'string' && item.content.length <= 2500)
        .map(({ role, content }) => ({ role, content }));
    const fallback = { status: 200, body: { answer: policy.localReply(body.message, heroine, history), source: 'reference' } };
    const decision = policy.classify(body.message, heroine, history);
    if (!apiKey || heroine.needsReview || decision.kind !== 'topic') return fallback;
    try {
        const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title': 'Heritage Belarus', 'HTTP-Referer': 'https://tinyq300.github.io/heritageby/' },
            body: JSON.stringify({ model, messages: [
                { role: 'system', content: policy.systemPrompt(heroine) }, ...history,
                { role: 'user', content: body.message }
            ], temperature: 0.2, max_tokens: 1000, response_format: { type: 'json_object' } }),
            signal: AbortSignal.timeout(25000)
        });
        if (!response.ok) return fallback;
        const data = await response.json();
        const answer = cleanAnswer(data.choices?.[0]?.message?.content, heroine);
        return answer ? { status: 200, body: { answer, source: 'ai' } } : fallback;
    } catch { return fallback; }
}

module.exports = { answerChat, cleanAnswer };
