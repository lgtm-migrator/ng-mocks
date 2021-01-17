import { Directive, ElementRef, Injector, OnInit, Optional, TemplateRef, ViewContainerRef } from '@angular/core';
import { getTestBed } from '@angular/core/testing';

import { extendClass } from '../common/core.helpers';
import coreReflectDirectiveResolve from '../common/core.reflect.directive-resolve';
import { Type } from '../common/core.types';
import { getMockedNgDefOf } from '../common/func.get-mocked-ng-def-of';
import { LegacyControlValueAccessor } from '../common/mock-control-value-accessor';
import ngMocksUniverse from '../common/ng-mocks-universe';
import decorateDeclaration from '../mock/decorate-declaration';

import { MockedDirective } from './types';

class DirectiveMockBase extends LegacyControlValueAccessor implements OnInit {
  // istanbul ignore next
  public constructor(
    injector: Injector,
    element?: ElementRef,
    template?: TemplateRef<any>,
    viewContainer?: ViewContainerRef,
  ) {
    super(injector);
    this.__ngMocksInstall(element, template, viewContainer);
  }

  public ngOnInit(): void {
    const config = (this.__ngMocksConfig as any).config;
    if (config?.render) {
      const { $implicit, variables } =
        config.render !== true
          ? config.render
          : {
              $implicit: undefined,
              variables: {},
            };
      (this as any).__render($implicit, variables);
    }
  }

  private __ngMocksInstall(element?: ElementRef, template?: TemplateRef<any>, viewContainer?: ViewContainerRef): void {
    // Basically any directive on ng-template is treated as structural, even it does not control render process.
    // In our case we do not if we should render it or not and due to this we do nothing.
    (this as any).__element = element;
    (this as any).__template = template;
    (this as any).__viewContainer = viewContainer;
    (this as any).__isStructural = template && viewContainer;

    // Providing method to render mock values.
    (this as any).__render = ($implicit?: any, variables?: Record<keyof any, any>) => {
      if (viewContainer && template) {
        viewContainer.clear();
        viewContainer.createEmbeddedView(template, { ...variables, $implicit });
      }
    };
  }
}

Object.defineProperty(DirectiveMockBase, 'parameters', {
  value: [[Injector], [ElementRef, new Optional()], [TemplateRef, new Optional()], [ViewContainerRef, new Optional()]],
});

const decorateClass = (directive: Type<any>, mock: Type<any>): void => {
  const meta = coreReflectDirectiveResolve(directive);
  const { selector, exportAs, inputs, outputs, queries, providers } = meta;
  const mockMeta = { inputs, outputs, providers, queries };
  const mockParams = { exportAs, selector };
  const options = decorateDeclaration(directive, mock, mockMeta, mockParams);
  Directive(options)(mock);
};

export function MockDirectives(...directives: Array<Type<any>>): Array<Type<MockedDirective<any>>> {
  return directives.map(MockDirective);
}

/**
 * @see https://github.com/ike18t/ng-mocks#how-to-mock-directives
 */
export function MockDirective<TDirective>(directive: Type<TDirective>): Type<MockedDirective<TDirective>> {
  // We are inside of an 'it'.
  // It is fine to to return a mock copy or to throw an exception if it was not replaced with its mock copy in TestBed.
  if ((getTestBed() as any)._instantiated) {
    try {
      return getMockedNgDefOf(directive, 'd');
    } catch (error) {
      // looks like an in-test mock.
    }
  }
  if (ngMocksUniverse.flags.has('cacheDirective') && ngMocksUniverse.cacheDeclarations.has(directive)) {
    return ngMocksUniverse.cacheDeclarations.get(directive);
  }

  const mock = extendClass(DirectiveMockBase);
  decorateClass(directive, mock);

  // istanbul ignore else
  if (ngMocksUniverse.flags.has('cacheDirective')) {
    ngMocksUniverse.cacheDeclarations.set(directive, mock);
  }

  return mock as any;
}
