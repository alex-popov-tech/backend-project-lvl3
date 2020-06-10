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

export const generatePagePath = (outputDir, { host, pathname }) => {
  const urlPath = pathname === '/' ? '' : pathname;
  const filename = `${host}${urlPath}`.replace(/[/.]/g, '-');
  const fileext = '.html';
  return path.resolve(outputDir, `${filename}${fileext}`);
};

export const generateAssetsPath = (pagePath, relativeAssetsUrls) => {
  const dirpath = `${pagePath.substring(0, pagePath.lastIndexOf('.'))}_files`;
  return relativeAssetsUrls
    .map((assetUrl) => assetUrl.substring(1).replace(/\//g, '-'))
    .map((filename) => path.resolve(dirpath, filename));
};

export const getAssetSources = (html) => $('[ src ]', html).toArray().map((it) => $(it).attr('src'));

export const replaceHtmlSources = (baseHtml, fromUrls, toUrls) => {
  let result = baseHtml;
  fromUrls.forEach((from, i) => {
    const find = $.load(result);
    const to = toUrls[i];
    find(`[ src = '${from}' ]`).attr('src', to);
    result = find.html();
  });
  return result;
};

export const toAbsoluteUrl = (relativeAssetUrls, { origin, pathname }) => {
  const urlPath = pathname === '/' ? '' : pathname;
  return relativeAssetUrls.map((it) => `${origin}${urlPath}${it}`);
};
