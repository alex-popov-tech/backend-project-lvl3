import axios from 'axios';
import 'axios-debug-log';
import $ from 'cheerio';
import debug from 'debug';
import fs from 'fs-extra';
import Listr from 'listr';
import _ from 'lodash';
import path from 'path';

const log = debug('page-loader');

const download = (urlString) => axios.get(urlString, { responseType: 'arraybuffer' })
  .then(({ data }) => data.toString())
  .catch(({ message }) => {
    throw new Error(`Error ocurred when trying to download "${urlString}"\nReason - "${message}"`);
  });

const ensureFile = (filepath, content) => fs.outputFile(filepath, content)
  .catch(({ message }) => {
    throw new Error(`Error ocurred when trying to write: "${filepath}"\nReason - "${message}"`);
  });

const toSlug = (content, replaceFrom = /[/.]/g, options = {
  trimChars: '/',
  replaceTo: '-',
}) => _.trim(content, options.trimChars).replace(replaceFrom, options.replaceTo);

const getAssetInfos = (html, baseurl, slug, outputDir) => {
  const attributeMapping = {
    link: 'href',
    script: 'src',
    img: 'src',
    style: 'src',
  };
  const toElementInfo = (element) => {
    const tagname = element.name;
    const attrname = attributeMapping[tagname];
    const attrvalue = element.attribs[attrname];
    return { tagname, attrname, attrvalue };
  };
  const dirpath = `${outputDir}/${slug}_files`;
  return $('link,img,script,style', html)
    .toArray()
    .map(toElementInfo)
    .filter(({ attrvalue }) => attrvalue)
    .map((info) => ({ ...info, url: new URL(info.attrvalue, baseurl.origin) }))
    .filter(({ url }) => url.host === baseurl.host)
    .map((info) => {
      const fileName = toSlug(info.url.pathname, /[/]/g);
      const filePath = path.resolve(dirpath, fileName);
      return {
        ...info,
        filePath,
      };
    });
};

const replaceAttributes = (
  initialHtml,
  assetInfos,
) => assetInfos.reduce((html, {
  tagname,
  attrname,
  attrvalue,
  filePath,
}) => {
  const $$ = $.load(html);
  $$(`${tagname}[ ${attrname} = '${attrvalue}' ]`).attr(attrname, filePath);
  return $$.html();
}, initialHtml);

const prepareAssets = (html, url, slug, outputDir) => {
  const assetInfos = getAssetInfos(html, url, slug, outputDir);
  log(assetInfos.map((it) => JSON.stringify(it)));
  const updatedHtml = replaceAttributes(html, assetInfos);
  return {
    updatedHtml,
    assetInfos,
  };
};

export default (urlString, outputDir) => {
  const url = new URL(urlString);
  log(`Passed URL: ${url}`);
  log(`Passed output dir: ${outputDir}`);

  const slug = toSlug(`${url.host}${url.pathname}`);

  const pageFileName = `${slug}.html`;
  const pageFilePath = path.resolve(outputDir, pageFileName);
  log(`Html file path: ${pageFilePath}`);

  const assetsDirName = `${slug}_files`;
  const assetsDirPath = path.resolve(outputDir, assetsDirName);
  log(`Assets dir path: ${assetsDirPath}`);

  return download(url.toString())
    .then((html) => {
      const { updatedHtml, assetInfos } = prepareAssets(html, url, slug, outputDir);

      const tasks = assetInfos
        .map(({ filePath, url: assetUrl }) => ({
          title: `Dowloading ${assetUrl} to ${filePath}...`,
          task: () => download(assetUrl.toString())
            .then((content) => ensureFile(filePath, content)),
        }));
      const listr = new Listr(tasks, { concurrent: true });
      return ensureFile(pageFilePath, updatedHtml)
        .then(() => listr.run());
    });
};
