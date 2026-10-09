import { cp, copyFile, mkdir, rm } from 'node:fs/promises';

const outputDirectory = new URL('./dist/', import.meta.url);
const staticFiles = [
  'index.html',
  'dither.js',
  'pixel-blast.js',
  'spotlight-text.js'
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all(
  staticFiles.map(file => copyFile(new URL(`./${file}`, import.meta.url), new URL(`./dist/${file}`, import.meta.url)))
);

await cp(new URL('./assets/', import.meta.url), new URL('./dist/assets/', import.meta.url), { recursive: true });

console.log('Static site built successfully in dist/.');
