const DEFAULT_ORIGIN = 'https://tinyq300.github.io';

export function createWorker({ answerChat, fetchImpl = fetch }) {
    const clients = new Map();
    let activeRequests = 0;

    return {
        async fetch(request, env = {}) {
            const url = new URL(request.url);
            const origin = request.headers.get('Origin');
            const allowedOrigins = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGIN).split(',').map(s => s.trim());
            const allowed = origin && allowedOrigins.includes(origin);
            const headers = {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
                'Vary': 'Origin',
                ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {})
            };
            const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
            if (origin && !allowed) return json({ error: 'Недопустимый источник запроса.' }, 403);

            if (request.method === 'OPTIONS' && url.pathname === '/api/chat') {
                if (!allowed || request.headers.get('Access-Control-Request-Method') !== 'POST') return json({ error: 'Недопустимый запрос.' }, 403);
                return new Response(null, { status: 204, headers: {
                    ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600'
                } });
            }

            if (url.pathname === '/health' || url.pathname === '/api/status') {
                if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Используйте GET.' }, 405);
                return json({ service: 'heritageby-chat', ready: Boolean(env.OPENROUTER_API_KEY?.trim()), protocolVersion: 1 });
            }
            if (url.pathname === '/' && request.method === 'GET') {
                return new Response(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Heritage Belarus — API бесед</title><style>body{font:18px/1.6 system-ui;max-width:720px;margin:12vh auto;padding:24px;background:#f5f0e8;color:#42252b}a{color:#8b1538}</style><h1>API исторических бесед</h1><p>Сервис для сайта «Вечные Образы».</p><p>${env.OPENROUTER_API_KEY?.trim() ? 'Генерация ИИ настроена.' : 'Ожидается подключение ключа владельцем. Исторические справки доступны.'}</p><p><a href="https://tinyq300.github.io/heritageby/">Открыть сайт</a> · <a href="/health">Состояние сервиса</a></p></html>`, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
            }
            if (url.pathname !== '/api/chat') return json({ error: 'Не найдено.' }, 404);
            if (request.method !== 'POST') return json({ error: 'Используйте POST.' }, 405);
            if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return json({ error: 'Ожидается JSON.' }, 415);

            const now = Date.now();
            for (const [key, value] of clients) if (now - value.start >= 60000) clients.delete(key);
            // CF-Connecting-IP is set by the hosting edge. Never trust a caller's X-Forwarded-For.
            const address = request.headers.get('CF-Connecting-IP') || 'unknown';
            const client = clients.get(address) || { start: now, count: 0 };
            if (clients.size >= 5000 || ++client.count > 15 || activeRequests >= 6) {
                return json({ error: 'Подождите немного перед следующим вопросом.' }, 429);
            }
            clients.set(address, client);

            if (Number(request.headers.get('Content-Length') || 0) > 24000) return json({ error: 'Слишком большой запрос.' }, 413);
            let body;
            try {
                const reader = request.body?.getReader();
                if (!reader) return json({ error: 'Ожидается вопрос.' }, 400);
                const chunks = [];
                let length = 0;
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    length += value.byteLength;
                    if (length > 24000) { await reader.cancel(); return json({ error: 'Слишком большой запрос.' }, 413); }
                    chunks.push(value);
                }
                const bytes = new Uint8Array(length);
                let offset = 0;
                for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
                body = JSON.parse(new TextDecoder().decode(bytes));
            } catch { return json({ error: 'Некорректный JSON.' }, 400); }

            activeRequests++;
            try {
                const result = await answerChat(body, {
                    apiKey: env.OPENROUTER_API_KEY?.trim() || '',
                    model: env.OPENROUTER_MODEL || 'openrouter/free', fetchImpl
                });
                return json(result.body, result.status);
            } catch { return json({ error: 'Сервис временно недоступен.' }, 503); }
            finally { activeRequests--; }
        }
    };
}
