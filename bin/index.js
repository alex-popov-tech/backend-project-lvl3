#!/usr/bin/env node
import commander from 'commander';
import download from '../src/index.js';

commander
  .description('Downloads passed page')
  .version('1.0.0')
  .option('-o, --output <dirPath>', 'output dir path', process.cwd())
  .arguments('<url>')
  .action(async (url, { output }) => {
    const error = await download(url, output).catch((err) => err);
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    process.exit(0);
  })
  .parse(process.argv);
