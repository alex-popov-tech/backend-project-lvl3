import { promises } from 'fs';
import nock from 'nock';
import { tmpdir } from 'os';
import download from '../src/index.js';


const { readFile } = promises;
const expectedOutput = (filename) => `${tmpdir()}/${filename}.html`;
const mock = ({ host, path, body }) => nock(host)
  .get(path)
  .reply(200, body, { 'Access-Control-Allow-Origin': '*' });

test('Download real page', async () => {
  mock({ host: 'http://test.com', path: '/tryit', body: '<html><body>hello world</body></html>' });
  const expectedFilepath = expectedOutput('test-com-tryit');
  await download('http://test.com/tryit', tmpdir());
  expect(await readFile(expectedFilepath).then((buffer) => buffer.toString()))
    .toEqual('<html><body>hello world</body></html>');
});
