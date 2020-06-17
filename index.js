import axios from 'axios';
import 'axios-debug-log';
import $ from 'cheerio';
import debug from 'debug';
import fs from 'fs-extra';
import Listr from 'listr';
import _ from 'lodash';
import path from 'path';

const log = debug('page-loader');

const download = (url) => axios.get(url)
  .then(({ data }) => data)
  .catch(({ message }) => {
    throw new Error(`Error ocurred when trying to download "${url}"\nReason - "${message}"`);
  });

const ensureFile = (filepath, content) => fs.outputFile(filepath, content)
  .catch(({ message }) => {
    throw new Error(`Error ocurred when trying to write: "${filepath}"\nReason - "${message}"`);
  });

const toSlug = ({ host, pathname }) => _.trim(`${host}${pathname}`, '/').replace(/[/.]/g, '-');

const generatePageFilePath = (outputDir, url) => {
  const filename = `${toSlug(url)}.html`;
  return path.resolve(outputDir, filename);
};

const generateAssetFilePaths = (outputDir, url, relativeAssetUrls) => {
  const dirpath = `${outputDir}/${toSlug(url)}_files`;
  const assetFilePaths = relativeAssetUrls
    .map((assetUrl) => _.trim(assetUrl, '/').replace(/\//g, '-'))
    .map((filename) => path.resolve(dirpath, filename));
  return assetFilePaths;
};

const getAssetRelativeUrls = (html) => $('[ src ]', html)
  .toArray()
  .filter((it) => it.attribs.src.startsWith('/'))
  .map((it) => $(it).attr('src'));

const replaceAttributes = (
  initialHtml,
  attributeName,
  fromAttributes,
  toAttributes,
) => fromAttributes
  .reduce((html, from, i) => {
    const to = toAttributes[i];
    const $$ = $.load(html);
    $$(`[ ${attributeName} = '${from}' ]`).attr(attributeName, to);
    return $$.html();
  }, initialHtml);

const toAbsoluteUrls = (relativeUrls, { origin, pathname }) => {
  const baseUrlPath = pathname === '/' ? '' : pathname;
  return relativeUrls.map((it) => `${origin}${baseUrlPath}${it}`);
};

export default (urlString, outputDir) => download(urlString)
  .then((html) => {
    const url = new URL(urlString);
    log(`Passed URL: ${url.toJSON()}`);
    log(`Passed output dir: ${outputDir}`);

    const relativeAssetUrls = getAssetRelativeUrls(html);
    const absoluteAssetUrls = toAbsoluteUrls(relativeAssetUrls, url);
    log(`Assets found on a page: [${absoluteAssetUrls.join('\n')}]`);

    const pageFilePath = generatePageFilePath(outputDir, url);
    log(`Html file path: ${pageFilePath}`);
    const assetFilePaths = generateAssetFilePaths(outputDir, url, relativeAssetUrls);
    log(`Assets file paths: [${assetFilePaths.join('\n')}]`);

    const updatedHtml = replaceAttributes(html, 'src', relativeAssetUrls, assetFilePaths);

    const assetContents = [];
    const tasks = absoluteAssetUrls.map((assetUrl, i) => ({
      title: `Dowloading ${assetUrl}...`,
      task: () => download(assetUrl).then((content) => {
        assetContents[i] = content;
      }),
    }));
    const listr = new Listr(tasks, { concurrent: true });
    return listr.run().then(() => ({
      page: { filepath: pageFilePath, content: updatedHtml },
      assets: assetContents.map((content, i) => ({ filepath: assetFilePaths[i], content })),
    }));
  }).then(({ page, assets }) => Promise.all([
    ensureFile(page.filepath, page.content),
    ...assets.map(({ filepath, content }) => ensureFile(filepath, content)),
  ]));
