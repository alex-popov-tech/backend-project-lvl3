#!/usr/bin/env node
import commander from 'commander';
import download from '../index.js';

commander
  .description('Downloads passed page')
  .version('1.0.0')
  .option('-o, --output <dirPath>', 'output dir path', process.cwd())
  .arguments('<url>')
  .action(async (url, { output }) => {
    try {
      await download(url, output);
    } catch ({ message }) {
      console.error(message);
      process.exitCode = 1;
    }
  })
  .parse(process.argv);
