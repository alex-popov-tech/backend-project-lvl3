import { readFile } from 'fs-extra';
import nock from 'nock';
import { tmpdir } from 'os';
import download from '../src/index.js';


const outputDir = tmpdir();

const shouldHaveContent = async (filepath, content) => expect(
  await readFile(filepath).then((buffer) => buffer.toString().trim()),
).toEqual(content);

const mock = ({ host, path, body }) => nock(host)
  .get(path)
  .reply(200, body, { 'Access-Control-Allow-Origin': '*' })
  .log(console.log);

test('Download real page', async () => {
  mock({
    host: 'http://test.com',
    path: '/tryit',
    body: '<html><head><script src="/js/script.js"></script><style src="/css/style.css"></style></head></html>',
  });
  mock({ host: 'http://test.com', path: '/tryit/css/style.css', body: '.foo color: red' });
  mock({ host: 'http://test.com', path: '/tryit/js/script.js', body: 'console.log("hello!")' });
  await download('http://test.com/tryit', outputDir);
  await shouldHaveContent(
    `${outputDir}/test-com-tryit.html`,
    `<html><head><script src="${outputDir}/test-com-tryit_files/js-script.js"></script><style src="${outputDir}/test-com-tryit_files/css-style.css"></style></head><body></body></html>`,
  );
  await shouldHaveContent(`${outputDir}/test-com-tryit_files/js-script.js`, 'console.log("hello!")');
  await shouldHaveContent(`${outputDir}/test-com-tryit_files/css-style.css`, '.foo color: red');
});
