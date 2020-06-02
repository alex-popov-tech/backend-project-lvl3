#!/usr/bin/env node
import commander from 'commander';
import download from '../src/index.js';


commander
  .description('Downloads passed page')
  .version('1.0.0')
  .option('-o, --output <dirPath>', 'output dir path', process.cwd())
  .arguments('<url>')
  .action((url, { output }) => download(url, output))
  .parse(process.argv);
