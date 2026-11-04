import { eq, finish } from './setup';
import { isAnalyticsDemoAvailable } from '../../src/dev/analyticsDemo';

eq('demo data actions are available in production builds by default', isAnalyticsDemoAvailable(), true);
finish();
