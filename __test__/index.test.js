import { promises as fs } from 'fs';
import nock from 'nock';
import { tmpdir } from 'os';
import { sep } from 'path';
import download from '../index.js';

nock.disableNetConnect();

let outputDir;

beforeEach(async () => {
  outputDir = await fs.mkdtemp(`${tmpdir()}${sep}page-loader_`);
});

const shouldHaveContent = async (filepath, content) => expect(
  await fs.readFile(filepath).then((buffer) => buffer.toString().trim()),
).toEqual(content);

test('page with resources happy path', async () => {
  nock('http://test.com')
    .get('/tryit')
    .reply(200, '<html><head><script src="http://foo.io/bar.js"></script><script src="/js/script.js"></script><style src="/css/style.css"></style></head></html>');
  nock('http://test.com')
    .get('/tryit/css/style.css')
    .reply(200, '.foo color: red');
  nock('http://test.com')
    .get('/tryit/js/script.js')
    .reply(200, 'console.log("hello!")');
  await download('http://test.com/tryit', outputDir);
  await shouldHaveContent(
    `${outputDir}/test-com-tryit.html`,
    `<html><head><script src="http://foo.io/bar.js"></script><script src="${outputDir}/test-com-tryit_files/js-script.js"></script><style src="${outputDir}/test-com-tryit_files/css-style.css"></style></head><body></body></html>`,
  );
  await shouldHaveContent(`${outputDir}/test-com-tryit_files/js-script.js`, 'console.log("hello!")');
  await shouldHaveContent(`${outputDir}/test-com-tryit_files/css-style.css`, '.foo color: red');
});

test('page failed', async () => {
  nock('http://test.com')
    .get('/')
    .reply(403, '<html><body>403 Unauthorized</body></html>');
  await expect(download('http://test.com', outputDir))
    .rejects
    .toThrow('Error ocurred when trying to download "http://test.com/"\nReason - "Request failed with status code 403"');
});

test('asset failed', async () => {
  nock('http://test.com')
    .get('/')
    .reply(200, '<html><head><script src="/script.js"></script></head></html>');
  nock('http://test.com')
    .get('/script.js')
    .reply(500, '');
  await expect(download('http://test.com', outputDir))
    .rejects
    .toThrow('Error ocurred when trying to download "http://test.com/script.js"\nReason - "Request failed with status code 500"');
});

test('failed to save', async () => {
  nock('http://test.com')
    .get('/')
    .reply(200, '<html></html>');
  expect(download('http://test.com', '/bin'))
    .rejects
    .toThrow('Error ocurred when trying to write: "/bin/test-com.html"\nReason - "');
});
