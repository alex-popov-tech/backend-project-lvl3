import debug from 'debug';
import Listr from 'listr';
import {
  download,
  ensureFile,
  replaceHtmlSources,
  getAssetRelativeUrls,
  toAbsoluteAssetUrl,
  generatePageFilePath,
  generateAssetFilePaths,
} from './utils.js';

const log = debug('page-loader');

export default (urlString, outputDir) => download(urlString)
  .then((html) => {
    const url = new URL(urlString);
    log(`Passed URL: ${url.toJSON()}`);
    log(`Passed output dir: ${outputDir}`);

    const relativeAssetUrls = getAssetRelativeUrls(html);
    const absoluteAssetUrls = toAbsoluteAssetUrl(relativeAssetUrls, url);
    log(`Assets found on a page: [${absoluteAssetUrls.join(', ')}]`);

    const pageFilePath = generatePageFilePath(outputDir, url);
    log(`Html file path: ${pageFilePath}`);
    const assetFilePaths = generateAssetFilePaths(pageFilePath, relativeAssetUrls);
    log(`Assets file paths: [${assetFilePaths.join(', ')}]`);

    const updatedHtml = replaceHtmlSources(html, relativeAssetUrls, assetFilePaths);

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
