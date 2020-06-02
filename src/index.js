import axios from 'axios';
import { promises } from 'fs';
import { resolve } from 'path';

export default (urlString, outputDir) => {
  const url = new URL(urlString);
  const { hostname, pathname } = url;
  const filename = `${hostname}${pathname}`;
  const absoluteFilePath = resolve(outputDir, `${filename.replace(/\W/g, '-')}.html`);
  return axios.get(url.toString())
    .then(({ data }) => promises.writeFile(resolve(outputDir, absoluteFilePath), data));
};
