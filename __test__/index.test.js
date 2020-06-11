import { readFile } from 'fs-extra';
import nock from 'nock';
import { tmpdir } from 'os';
import { sep } from 'path';
import { promises } from 'fs';
import download from '../src/index.js';

nock.disableNetConnect();

let outputDir;

beforeEach(async () => {
  outputDir = await promises.mkdtemp(`${tmpdir()}${sep}page-loader_`);
});

const shouldHaveContent = async (filepath, content) => expect(
  await readFile(filepath).then((buffer) => buffer.toString().trim()),
).toEqual(content);

const mockResponse = ({
  host,
  path,
  status,
  body,
}) => nock(host)
  .get(path)
  .reply(status, body, { 'Access-Control-Allow-Origin': '*' });

test('page with resources happy path', async () => {
  mockResponse({
    host: 'http://test.com',
    path: '/tryit',
    status: 200,
    body: '<html><head><script src="/js/script.js"></script><style src="/css/style.css"></style></head></html>',
  });
  mockResponse({
    host: 'http://test.com',
    path: '/tryit/css/style.css',
    status: 200,
    body: '.foo color: red',
  });
  mockResponse({
    host: 'http://test.com',
    path: '/tryit/js/script.js',
    status: 200,
    body: 'console.log("hello!")',
  });
  await download('http://test.com/tryit', outputDir);
  await shouldHaveContent(
    `${outputDir}/test-com-tryit.html`,
    `<html><head><script src="${outputDir}/test-com-tryit_files/js-script.js"></script><style src="${outputDir}/test-com-tryit_files/css-style.css"></style></head><body></body></html>`,
  );
  await shouldHaveContent(`${outputDir}/test-com-tryit_files/js-script.js`, 'console.log("hello!")');
  await shouldHaveContent(`${outputDir}/test-com-tryit_files/css-style.css`, '.foo color: red');
});

test('page failed', async () => {
  mockResponse({
    host: 'http://test.com',
    path: '/',
    status: 403,
    body: '<html><body>403 Unauthorized</body></html>',
  });
  await expect(download('http://test.com', outputDir))
    .rejects
    .toThrow('Error ocurred when trying to download "http://test.com"\nReason - "Request failed with status code 403"');
});

test('asset failed', async () => {
  mockResponse({
    host: 'http://test.com',
    path: '/',
    status: 200,
    body: '<html><head><script src="/script.js"></script></head></html>',
  });
  mockResponse({
    host: 'http://test.com',
    path: '/script.js',
    status: 500,
    body: '',
  });
  await expect(download('http://test.com', outputDir))
    .rejects
    .toThrow('Error ocurred when trying to download "http://test.com/script.js"\nReason - "Request failed with status code 500"');
});

test('failed to save', async () => {
  mockResponse({
    host: 'http://test.com',
    path: '/',
    status: 200,
    body: '<html></html>',
  });
  expect(download('http://test.com', '/bin'))
    .rejects
    .toThrow('Error ocurred when trying to write: "/bin/test-com.html"\nReason - "');
});
