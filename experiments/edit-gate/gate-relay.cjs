'use strict';
// Edit-gate hook command (runs as the generator user). Sends this hook's stdin JSON to the root hub's Unix socket
// (argv[2]) and prints the hub's reply. Fails open: on any error or after 8 s it prints nothing and exits 0.
const net = require('node:net');
const done = (out) => { if (out) process.stdout.write(out); process.exit(0); };
setTimeout(() => done(''), 8000).unref();
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const s = net.connect(process.argv[2], () => s.end(Buffer.concat(chunks)));
  const reply = [];
  s.on('data', (c) => reply.push(c));
  s.on('end', () => done(Buffer.concat(reply).toString('utf8')));
  s.on('error', () => done(''));
});
