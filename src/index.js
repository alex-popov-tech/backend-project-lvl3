import axios from 'axios';
import 'axios-debug-log';
import $ from 'cheerio';
import debug from 'debug';
import fs from 'fs-extra';
import path from 'path';

const log = debug('page-loader');

const download = (url) => axios.get(url)
  .then((response) => response.data)
  .catch(({ message }) => {
    throw new Error(`Error ocurred when trying to download "${url}"\nReason - "${message}"`);
  });

const ensureFile = (filepath, content) => fs.outputFile(filepath, content)
  .catch(({ message }) => {
    throw new Error(`Error ocurred when trying to write: "${filepath}"\nReason - "${message}"`);
  });

const generatePagePath = (outputDir, { host, pathname }) => {
  const urlPath = pathname === '/' ? '' : pathname;
  const filename = `${host}${urlPath}`.replace(/[/.]/g, '-');
  const fileext = '.html';
  return path.resolve(outputDir, `${filename}${fileext}`);
};

const generateAssetsPath = (pagePath, relativeAssetsUrls) => {
  const dirpath = `${pagePath.substring(0, pagePath.lastIndexOf('.'))}_files`;
  return relativeAssetsUrls
    .map((assetUrl) => assetUrl.substring(1).replace(/\//g, '-'))
    .map((filename) => path.resolve(dirpath, filename));
};

const getAssetSources = (html) => $('[ src ]', html).toArray().map((it) => $(it).attr('src'));

const replaceHtmlSources = (baseHtml, fromUrls, toUrls) => {
  let result = baseHtml;
  fromUrls.forEach((from, i) => {
    const find = $.load(result);
    const to = toUrls[i];
    find(`[ src = '${from}' ]`).attr('src', to);
    result = find.html();
  });
  return result;
};

const toAbsoluteUrl = (relativeAssetUrls, { origin, pathname }) => {
  const urlPath = pathname === '/' ? '' : pathname;
  return relativeAssetUrls.map((it) => `${origin}${urlPath}${it}`);
};

export default (urlString, outputDir) => download(urlString)
  .then((html) => {
    const url = new URL(urlString);
    log(`Passed URL: ${url.toJSON()}`);
    log(`Passed output dir: ${outputDir}`);

    const relativeAssetUrls = getAssetSources(html);
    const absoluteAssetUrls = toAbsoluteUrl(relativeAssetUrls, url);
    log(`Assets found on a page: [${absoluteAssetUrls.join(', ')}]`);

    const pageFilePath = generatePagePath(outputDir, url);
    log(`Html file path: ${pageFilePath}`);
    const assetFilePaths = generateAssetsPath(pageFilePath, relativeAssetUrls);
    log(`Assets file paths: [${assetFilePaths.join(', ')}]`);

    const updatedHtml = replaceHtmlSources(html, relativeAssetUrls, assetFilePaths);

    return Promise.all(absoluteAssetUrls.map((absAssetUrls) => download(absAssetUrls)))
      .then((assetContents) => ({
        page: { filepath: pageFilePath, content: updatedHtml },
        assets: assetContents.map((content, i) => ({ filepath: assetFilePaths[i], content })),
      }));
  }).then(({ page, assets }) => Promise.all([
    ensureFile(page.filepath, page.content),
    ...assets.map(({ filepath, content }) => ensureFile(filepath, content)),
  ]));
