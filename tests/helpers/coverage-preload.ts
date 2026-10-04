import { afterAll } from 'bun:test';
import { reportCoverage } from './coverage';
afterAll(reportCoverage);
