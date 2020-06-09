import axios from 'axios';
import $ from 'cheerio';
import fs from 'fs-extra';
import path from 'path';


const download = (url) => axios.get(url).then((response) => response.data);

const generatePagePath = (outputDir, { host, pathname }) => {
  const urlPath = pathname === '/' ? '' : pathname;
  const filename = `${host}${urlPath}`.replace(/[\/\.]/g, '-');
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

    const relativeAssetUrls = getAssetSources(html);
    const absoluteAssetUrls = toAbsoluteUrl(relativeAssetUrls, url);

    const pageFilePath = generatePagePath(outputDir, url);
    const assetFilePaths = generateAssetsPath(pageFilePath, relativeAssetUrls);

    const updatedHtml = replaceHtmlSources(html, relativeAssetUrls, assetFilePaths);

    return Promise.all(absoluteAssetUrls.map((absAssetUrls) => download(absAssetUrls)))
      .then((assetContents) => ({
        page: { filepath: pageFilePath, content: updatedHtml },
        assets: assetContents.map((content, i) => ({ filepath: assetFilePaths[i], content })),
      }));
  })
  .then(({ page, assets }) => Promise.all([
    fs.outputFile(page.filepath, page.content),
    ...assets.map(({ filepath, content }) => fs.outputFile(filepath, content)),
  ]));
