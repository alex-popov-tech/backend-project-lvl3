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
  content,
  trimChars = '/',
  replaceFrom = /[/.]/g,
  replaceTo = '-',
}) => _.trim(content, trimChars).replace(replaceFrom, replaceTo);

const getAssetInfos = (html, baseurl, slug, outputDir) => {
  const attributeMapping = {
    link: 'href',
    script: 'src',
    img: 'src',
    style: 'src',
  };
  const toElementInfo = (element) => {
    const tagname = element.type;
    const attrname = attributeMapping[tagname];
    const attrvalue = element.attribs[attrname];
    return { tagname, attrname, attrvalue };
  };
  const dirpath = `${outputDir}/${slug}_files`;
  return $('link,img,script,style', html)
    .toArray()
    .filter((element) => {
      const { attrvalue } = toElementInfo(element);
      return new URL(attrvalue, baseurl.origin).origin === baseurl.origin;
    })
    .map((element) => {
      const { tagname, attrname, attrvalue } = toElementInfo(element);
      const absoluteUrl = `${_.trim(baseurl.origin + baseurl.pathname, '/')}${attrvalue}`;
      const fileName = toSlug({ content: attrvalue, replaceFrom: /[/]/g });
      const filePath = path.resolve(dirpath, fileName);
      return {
        tagname,
        attrname,
        attrvalue,
        absoluteUrl,
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

export default (urlString, outputDir) => {
  const url = new URL(urlString);
  log(`Passed URL: ${url.toJSON()}`);
  log(`Passed output dir: ${outputDir}`);

  const slug = toSlug({ content: `${url.host}${url.pathname}` });

  const pageFileName = `${slug}.html`;
  const pageFilePath = path.resolve(outputDir, pageFileName);
  log(`Html file path: ${pageFilePath}`);

  const assetsDirName = `${slug}_files`;
  const assetsDirPath = path.resolve(outputDir, assetsDirName);
  log(`Assets dir path: ${assetsDirPath}`);

  return download(url.href)
    .then((html) => {
      const assetInfos = getAssetInfos(html, url, slug, outputDir);
      const updatedHtml = replaceAttributes(html, assetInfos);

      const tasks = assetInfos
        .map(({ filePath, absoluteUrl }) => ({
          title: `Dowloading ${absoluteUrl} to ${filePath}...`,
          task: () => download(absoluteUrl).then((content) => ensureFile(filePath, content)),
        }));
      const listr = new Listr(tasks, { concurrent: true });
      return ensureFile(pageFilePath, updatedHtml)
        .then(() => listr.run());
    });
};
