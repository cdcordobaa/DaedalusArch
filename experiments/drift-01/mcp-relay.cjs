'use strict';
// Joins this process's stdio to a Unix socket (argv[2]), both ways.
const net = require('node:net');
const s = net.connect(process.argv[2]);
process.stdin.pipe(s);
s.pipe(process.stdout);
s.on('close', () => process.exit(0));
s.on('error', () => process.exit(1));
