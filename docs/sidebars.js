module.exports = {
  docs: [
    {
      type: 'category',
      label: 'Introduction',
      items: ['index', 'tl-dr', 'extra/install', 'extra/quick-start', 'extra/extensive-example'],
    },
    {
      type: 'category',
      label: 'Classic tools',
      collapsed: false,
      items: [
        'api/MockComponent',
        'api/MockDirective',
        'api/MockPipe',
        'api/MockProvider',
        'api/MockService',
        'api/MockModule',
      ],
    },
    {
      type: 'category',
      label: 'Contemporary tools',
      collapsed: false,
      items: ['api/MockBuilder', 'api/MockRender', 'api/MockInstance'],
    },
    {
      type: 'category',
      label: 'ngMocks',
      items: [
        'api/ngMocks',
        'api/ngMocks/defaultMock',
        'api/ngMocks/globalExclude',
        'api/ngMocks/globalKeep',
        'api/ngMocks/globalMock',
        'api/ngMocks/globalReplace',
        'api/ngMocks/globalWipe',
        'api/ngMocks/input',
        'api/ngMocks/output',
        'api/ngMocks/get',
        'api/ngMocks/find',
        'api/ngMocks/findAll',
        'api/ngMocks/findInstance',
        'api/ngMocks/findInstances',
        'api/ngMocks/stub',
        'api/ngMocks/stubMember',
        'api/ngMocks/guts',
        'api/ngMocks/faster',
        'api/ngMocks/throwOnConsole',
        'api/ngMocks/flushTestBed',
        'api/ngMocks/reset',
      ],
    },
    {
      type: 'category',
      label: 'Helper functions',
      items: [
        'api/helpers/isMockControlValueAccessor',
        'api/helpers/isMockValidator',
        'api/helpers/isMockOf',
        'api/helpers/isMockedNgDefOf',
        'api/helpers/getMockedNgDefOf',
        'api/helpers/isNgDef',
        'api/helpers/getSourceOfMock',
        'api/helpers/isNgInjectionToken',
      ],
    },
    {
      type: 'doc',
      id: 'extra/auto-spy',
    },
    {
      type: 'category',
      label: 'Extra',
      items: ['extra/customize-mocks', 'extra/mock-observables', 'extra/mock-form-controls', 'extra/with-3rd-party'],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/read-property-of-undefined',
        'troubleshooting/declarations-of-2-modules',
        'troubleshooting/no-selector',
        'troubleshooting/not-a-known-element',
      ],
    },
    {
      type: 'doc',
      id: 'need-help',
    },
  ],
  guides: [
    {
      type: 'doc',
      id: 'guides/index',
    },
  ],
};
