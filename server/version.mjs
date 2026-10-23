import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

// Bundles report their immutable manifest identity; checkouts identify as source.
const manifestUrl=new URL('../bundle-manifest.json',import.meta.url);
const bundled=fs.existsSync(fileURLToPath(manifestUrl));
const metadata=JSON.parse(fs.readFileSync(bundled?manifestUrl:new URL('../package.json',import.meta.url),'utf8'));
export const VERSION=metadata.version;
export const BUILD_ID=bundled?metadata.build_id:'source-tree';
