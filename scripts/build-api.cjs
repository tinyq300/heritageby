'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function wrap(file, imports = '') {
    return `(() => { const module = { exports: {} }; ${imports}\n${fs.readFileSync(path.join(root, file), 'utf8')}\nreturn module.exports; })()`;
}
const runtime = fs.readFileSync(path.join(root, 'api/worker-runtime.mjs'), 'utf8');
const source = `// Generated from the tested gallery records, topic policy and API service.\n` +
    `const records = ${wrap('js/heroines.js')};\n` +
    `const topicPolicy = ${wrap('js/chat-policy.js')};\n` +
    `const service = ${wrap('api/chat-service.cjs', `const require = name => name.endsWith('heroines.js') ? records : topicPolicy;`)};\n` +
    runtime + '\nexport default createWorker({ answerChat: service.answerChat });\n';
const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist-api/index.js');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, source);
console.log(`API Worker built: ${output}`);
