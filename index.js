import axios from 'axios';
import 'axios-debug-log';
import $ from 'cheerio';
import debug from 'debug';
import fs from 'fs-extra';
import Listr from 'listr';
import _ from 'lodash';
import path from 'path';

const log = debug('page-loader');

const download = (url) => axios.get(url, { responseType: 'arraybuffer' })
  .then(({ data }) => data.toString())
  .catch(({ message }) => {
    throw new Error(`Error ocurred when trying to download "${url}"\nReason - "${message}"`);
  });

const ensureFile = (filepath, content) => fs.outputFile(filepath, content)
  .catch(({ message }) => {
    throw new Error(`Error ocurred when trying to write: "${filepath}"\nReason - "${message}"`);
  });

const toSlug = ({
  chunks,
  trimChars = '/',
  replaceFrom = /[/.]/g,
  replaceTo = '-',
}) => _.trim(chunks.join(''), trimChars).replace(replaceFrom, replaceTo);

const toPageFilePath = (outputDir, url) => {
  const filename = `${toSlug({ chunks: [url.host, url.pathname] })}.html`;
  return path.resolve(outputDir, filename);
};

const toAssetFilePaths = (outputDir, url, elementInfos) => {
  const dirpath = `${outputDir}/${toSlug({ chunks: [url.host, url.pathname] })}_files`;
  const assetFilePaths = elementInfos
    .map(({ attrvalue }) => toSlug({ chunks: [attrvalue], replaceFrom: /[/]/g, replaceTo: '-' }))
    .map((filename) => path.resolve(dirpath, filename));
  return assetFilePaths;
};

const toElementInfos = (html, baseurl) => {
  const attributeMapping = {
    link: 'href',
    script: 'src',
    img: 'src',
    style: 'src',
  };
  const toInfo = (element) => {
    const tagname = element.type;
    const attrname = attributeMapping[tagname];
    const attrvalue = element.attribs[attrname];
    return { tagname, attrname, attrvalue };
  };
  return $('link,img,script,style', html)
    .toArray()
    .filter((element) => {
      const { attrvalue } = toInfo(element);
      return new URL(attrvalue, baseurl.origin).origin === baseurl.origin;
    })
    .map((element) => {
      const { tagname, attrname, attrvalue } = toInfo(element);
      return {
        tagname,
        attrname,
        attrvalue,
        absoluteUrl: `${_.trim(baseurl.origin + baseurl.pathname, '/')}${attrvalue}`,
      };
    });
};

const replaceAttributes = (
  initialHtml,
  elementInfos,
  assetFilePaths,
) => elementInfos
  .reduce((html, { tagname, attrname, attrvalue }, i) => {
    const filePath = assetFilePaths[i];
    const $$ = $.load(html);
    $$(`${tagname}[ ${attrname} = '${attrvalue}' ]`).attr(attrname, filePath);
    return $$.html();
  }, initialHtml);

export default (urlString, outputDir) => download(urlString)
  .then((html) => {
    const url = new URL(urlString);
    log(`Passed URL: ${url.toJSON()}`);
    log(`Passed output dir: ${outputDir}`);

    const elementInfos = toElementInfos(html, url);
    log(`Assets found on a page: [${elementInfos.map((it) => JSON.stringify(it)).join('\n')}]`);

    const pageFilePath = toPageFilePath(outputDir, url);
    log(`Html file path: ${pageFilePath}`);
    const assetFilePaths = toAssetFilePaths(outputDir, url, elementInfos);
    log(`Assets file paths: [${assetFilePaths.join('\n')}]`);

    const updatedHtml = replaceAttributes(html, elementInfos, assetFilePaths);

    const tasks = elementInfos.map(({ absoluteUrl }) => absoluteUrl)
      .map((assetUrl, i) => ({
        title: `Dowloading ${assetUrl} to ${assetFilePaths[i]}...`,
        task: () => download(assetUrl).then((content) => ensureFile(assetFilePaths[i], content)),
      }));
    const listr = new Listr(tasks, { concurrent: true });
    return ensureFile(pageFilePath, updatedHtml)
      .then(() => listr.run());
  });
