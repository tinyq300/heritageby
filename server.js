'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');

const { answerChat: answerCore, cleanAnswer } = require('./api/chat-service.cjs');
function answerChat(body, options = {}) {
    return answerCore(body, { apiKey: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || 'openrouter/free', ...options });
}

function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.obj': 'text/plain', '.mtl': 'text/plain', '.patt': 'text/plain' };
function createServer(options = {}) {
    const root = __dirname;
    // Bound per-address traffic and concurrent upstream calls. Keys and provider errors are never returned.
    const clients = new Map();
    let upstream = 0;
    return http.createServer(async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
        catch { json(res, 400, { error: 'Некорректный адрес.' }); return; }
        if (pathname === '/api/chat') {
            if (req.method !== 'POST') { json(res, 405, { error: 'Используйте POST.' }); return; }
            if (!(req.headers['content-type'] || '').startsWith('application/json')) { json(res, 415, { error: 'Ожидается JSON.' }); return; }
            if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) { json(res, 403, { error: 'Недопустимый источник запроса.' }); return; }
            const now = Date.now(), address = req.socket.remoteAddress;
            for (const [key, value] of clients) if (now - value.start > 60000) clients.delete(key);
            const client = clients.get(address) || { start: now, count: 0 };
            if (clients.size >= 10000 || ++client.count > 20 || upstream >= 8) { json(res, 429, { error: 'Подождите немного перед следующим вопросом.' }); return; }
            clients.set(address, client);
            const chunks = [];
            let bytes = 0;
            try {
                for await (const chunk of req) {
                    bytes += chunk.length;
                    if (bytes > 24000) { json(res, 413, { error: 'Слишком большой запрос.' }); return; }
                    chunks.push(chunk);
                }
                const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                upstream++;
                try { const result = await answerChat(body, options); json(res, result.status, result.body); }
                finally { upstream--; }
            } catch { if (!res.headersSent) json(res, 400, { error: 'Некорректный JSON.' }); }
            return;
        }
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
        const parts = pathname.split('/').filter(Boolean);
        const allowedDirectories = new Set(['js', 'css', 'images', 'audio', 'video', 'models', 'patterns', '3d']);
        const extension = path.extname(pathname === '/' ? 'index.html' : pathname).toLowerCase();
        if (parts.some(part => part.startsWith('.') || /[\\:]/.test(part)) || !mime[extension] ||
            (parts.length > 1 && !allowedDirectories.has(parts[0])) ||
            (parts.length === 1 && extension === '.js' && !['aframe.min.js', 'aframe-ar.js'].includes(parts[0]))) {
            res.writeHead(404).end(); return;
        }
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
        try {
            const stat = await fs.promises.stat(file);
            if (!stat.isFile()) { res.writeHead(404).end(); return; }
            res.writeHead(200, { 'Content-Type': mime[extension], 'Content-Length': stat.size });
            if (req.method === 'HEAD') res.end();
            else pipeline(fs.createReadStream(file), res, () => {});
        } catch { res.writeHead(404).end(); }
    });
}

if (require.main === module) {
    const port = Number(process.env.PORT || 3000), host = process.env.HOST || '127.0.0.1';
    createServer().listen(port, host, () => {
        console.log(`Heritage Belarus: http://${host}:${port}/gallery.html`);
        console.log(process.env.OPENROUTER_API_KEY ? 'ИИ подключён через сервер.' : 'Ключ ИИ не задан: доступны ответы из исторической справки.');
    });
}
module.exports = { createServer, answerChat, cleanAnswer };
