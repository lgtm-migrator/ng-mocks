import 'jest-preset-angular/setup-jest';

import { MockInstance, ngMocks } from 'ng-mocks';

ngMocks.autoSpy('jest');

jasmine.getEnv().addReporter({
  specDone: MockInstance.restore,
  specStarted: MockInstance.remember,
  suiteDone: MockInstance.restore,
  suiteStarted: MockInstance.remember,
});
