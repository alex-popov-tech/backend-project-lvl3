import axios from 'axios';
import 'axios-debug-log';
import $ from 'cheerio';
import fs from 'fs-extra';
import path from 'path';


export const download = (url) => axios.get(url)
  .then(({ data }) => data)
  .catch(({ message }) => {
    throw new Error(`Error ocurred when trying to download "${url}"\nReason - "${message}"`);
  });

export const ensureFile = (filepath, content) => fs.outputFile(filepath, content)
  .catch(({ message }) => {
    throw new Error(`Error ocurred when trying to write: "${filepath}"\nReason - "${message}"`);
  });

export const generatePageFilePath = (outputDir, { host, pathname }) => {
  const urlPath = pathname === '/' ? '' : pathname;
  const filename = `${host}${urlPath}`.replace(/[/.]/g, '-');
  const fileext = '.html';
  return path.resolve(outputDir, `${filename}${fileext}`);
};

export const generateAssetFilePaths = (pagePath, relativeAssetUrls) => {
  const dirpath = `${pagePath.substring(0, pagePath.lastIndexOf('.'))}_files`;
  return relativeAssetUrls
    .map((assetUrl) => assetUrl.substring(1).replace(/\//g, '-'))
    .map((filename) => path.resolve(dirpath, filename));
};

export const getAssetRelativeUrls = (html) => $('[ src ]', html).toArray().map((it) => $(it).attr('src'));

export const replaceHtmlSources = (initialHtml, fromUrls, toUrls) => fromUrls
  .reduce((html, from, i) => {
    const to = toUrls[i];
    const $$ = $.load(html);
    $$(`[ src = '${from}' ]`).attr('src', to);
    return $$.html();
  }, initialHtml);

export const toAbsoluteAssetUrl = (relativeAssetUrls, { origin, pathname }) => {
  const urlPath = pathname === '/' ? '' : pathname;
  return relativeAssetUrls.map((it) => `${origin}${urlPath}${it}`);
};
