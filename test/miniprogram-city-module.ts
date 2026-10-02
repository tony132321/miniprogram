import { createRequire } from 'node:module';

export const cityModule = createRequire(import.meta.url)('../miniprogram/utils/city.js');
