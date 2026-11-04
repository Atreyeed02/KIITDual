import { eq, finish } from './setup';
import { isAnalyticsDemoAvailable } from '../../src/dev/analyticsDemo';

eq('demo data actions are disabled in production builds', isAnalyticsDemoAvailable(), false);
finish();
