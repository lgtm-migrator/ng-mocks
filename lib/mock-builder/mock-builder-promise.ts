import { InjectionToken, NgModule, PipeTransform, Provider } from '@angular/core';
import { MetadataOverride, TestBed } from '@angular/core/testing';

import { extractDependency, flatten, mapEntries, mapValues } from '../common/core.helpers';
import { directiveResolver, jitReflector } from '../common/core.reflect';
import { NG_MOCKS, NG_MOCKS_OVERRIDES, NG_MOCKS_ROOT_PROVIDERS, NG_MOCKS_TOUCHES } from '../common/core.tokens';
import { AnyType, Type } from '../common/core.types';
import { isNgDef } from '../common/func.is-ng-def';
import { isNgInjectionToken } from '../common/func.is-ng-injection-token';
import { isNgModuleDefWithProviders, NgModuleWithProviders } from '../common/func.is-ng-module-def-with-providers';
import { ngMocksUniverse } from '../common/ng-mocks-universe';
import { MockComponent } from '../mock-component/mock-component';
import { MockDirective } from '../mock-directive/mock-directive';
import { MockModule, MockNgDef } from '../mock-module/mock-module';
import { MockPipe } from '../mock-pipe/mock-pipe';
import mockServiceHelper from '../mock-service/helper';
import MockProvider from '../mock-service/mock-provider';

import extractDep from './mock-builder-promise.extract-dep';
import skipDep from './mock-builder-promise.skip-dep';
import { IMockBuilderConfig, IMockBuilderResult } from './types';

const defaultMock = {}; // simulating Symbol

export class MockBuilderPromise implements PromiseLike<IMockBuilderResult> {
  protected beforeCC: Set<(testBed: typeof TestBed) => void> = new Set();
  protected configDef: Map<Type<any> | InjectionToken<any>, any> = new Map();
  protected defProviders: Map<Type<any> | InjectionToken<any>, Provider[]> = new Map();
  protected defValue: Map<Type<any> | InjectionToken<any>, any> = new Map();
  protected excludeDef: Set<Type<any> | InjectionToken<any>> = new Set();
  protected keepDef: Set<Type<any> | InjectionToken<any>> = new Set();
  protected mockDef: Set<Type<any> | InjectionToken<any>> = new Set();
  protected providerDef: Map<Type<any> | InjectionToken<any>, Provider> = new Map();
  protected replaceDef: Set<Type<any> | InjectionToken<any>> = new Set();

  public beforeCompileComponents(callback: (testBed: typeof TestBed) => void): this {
    this.beforeCC.add(callback);
    return this;
  }

  public build(): NgModule {
    const backup = {
      builder: ngMocksUniverse.builder,
      cacheMocks: ngMocksUniverse.cacheMocks,
      cacheProviders: ngMocksUniverse.cacheProviders,
      config: ngMocksUniverse.config,
      flags: ngMocksUniverse.flags,
      touches: ngMocksUniverse.touches,
    };

    ngMocksUniverse.builder = new Map();
    ngMocksUniverse.cacheMocks = new Map();
    ngMocksUniverse.cacheProviders = new Map();
    ngMocksUniverse.config = this.configDef;
    ngMocksUniverse.flags = new Set([
      'cacheComponent',
      'cacheDirective',
      'cacheModule',
      'cachePipe',
      'cacheProvider',
      'correctModuleExports',
    ]);
    ngMocksUniverse.touches = new Set();
    ngMocksUniverse.config.set('multi', new Set()); // collecting multi flags of providers.
    ngMocksUniverse.config.set('deps', new Set()); // collecting all deps of providers.
    ngMocksUniverse.config.set('depsSkip', new Set()); // collecting all declarations of kept modules.
    ngMocksUniverse.config.set('resolution', new Map()); // flags to understand how to mock nested declarations.

    for (const def of mapValues(this.keepDef)) {
      ngMocksUniverse.builder.set(def, def);
      ngMocksUniverse.config.get('resolution').set(def, 'keep');
    }

    for (const def of mapValues(this.replaceDef)) {
      ngMocksUniverse.builder.set(def, this.defValue.get(def));
      ngMocksUniverse.config.get('resolution').set(def, 'replace');
    }

    for (const def of [...mapValues(this.excludeDef)]) {
      ngMocksUniverse.builder.set(def, null);
      ngMocksUniverse.config.get('resolution').set(def, 'exclude');
    }

    // mocking requested things.
    for (const def of mapValues(this.mockDef)) {
      ngMocksUniverse.config.get('resolution').set(def, 'mock');
      if (isNgDef(def)) {
        continue;
      }
      if (this.defValue.has(def)) {
        const instance = this.defValue.get(def);
        ngMocksUniverse.builder.set(
          def,
          mockServiceHelper.useFactory(def, () => instance)
        );
      } else {
        ngMocksUniverse.builder.set(def, MockProvider(def));
      }
      ngMocksUniverse.touches.delete(def);
    }

    for (const def of mapValues(this.mockDef)) {
      if (isNgDef(def, 'c')) {
        ngMocksUniverse.builder.set(def, MockComponent(def));
      } else if (isNgDef(def, 'd')) {
        ngMocksUniverse.builder.set(def, MockDirective(def));
      } else if (isNgDef(def, 'p')) {
        ngMocksUniverse.builder.set(
          def,
          this.defValue.has(def) ? MockPipe(def, this.defValue.get(def)) : MockPipe(def)
        );
      } else {
        continue;
      }
      ngMocksUniverse.touches.delete(def);
    }

    // Now we need to run through requested modules.
    const defProviders = new Map();
    for (const def of [...mapValues(this.keepDef), ...mapValues(this.mockDef), ...mapValues(this.replaceDef)]) {
      if (!isNgDef(def, 'm')) {
        continue;
      }

      if (this.defProviders.has(def) && this.mockDef.has(def)) {
        const [, loDef] = MockNgDef({ providers: this.defProviders.get(def) });
        defProviders.set(def, loDef.providers);
      } else if (this.defProviders.has(def)) {
        defProviders.set(def, this.defProviders.get(def));
      }

      ngMocksUniverse.builder.set(def, MockModule(def));
      ngMocksUniverse.touches.delete(def);
    }

    // Setting up TestBed.
    const imports: Array<Type<any> | NgModuleWithProviders> = [];
    const declarations: Array<Type<any>> = [];
    const providers: Provider[] = [];

    // Adding suitable leftovers.
    for (const def of [...mapValues(this.mockDef), ...mapValues(this.keepDef), ...mapValues(this.replaceDef)]) {
      if (isNgDef(def, 'm') && defProviders.has(def)) {
        // nothing to do
      } else if (!isNgDef(def) || ngMocksUniverse.touches.has(def)) {
        continue;
      }
      const config = this.configDef.get(def);
      if (config && config.dependency) {
        continue;
      }
      if (isNgDef(def, 'm')) {
        const loModule = ngMocksUniverse.builder.get(def);
        const loProviders = defProviders.has(def) ? defProviders.get(def) : undefined;
        imports.push(
          loProviders
            ? {
                ngModule: loModule,
                providers: loProviders,
              }
            : loModule
        );
      } else {
        declarations.push(ngMocksUniverse.builder.get(def));
      }
      ngMocksUniverse.touches.add(def);
    }

    // Adding missed providers to test bed.
    for (const def of mapValues(this.keepDef)) {
      if (isNgDef(def) || ngMocksUniverse.touches.has(def)) {
        continue;
      }
      const config = this.configDef.get(def);
      if (config && config.dependency) {
        continue;
      }
      if (isNgInjectionToken(def)) {
        ngMocksUniverse.touches.add(def);
        continue;
      }
      providers.push(def);
      ngMocksUniverse.touches.add(def);
    }

    // Adding missed providers to test bed.
    for (const def of mapValues(this.mockDef)) {
      if (isNgDef(def) || ngMocksUniverse.touches.has(def)) {
        continue;
      }
      const config = this.configDef.get(def);
      if (config && config.dependency) {
        continue;
      }
      const mock = ngMocksUniverse.builder.get(def);
      providers.push(
        mock
          ? mock
          : {
              provide: def,
              useValue: undefined,
            }
      );
      ngMocksUniverse.touches.add(def);
    }

    // Adding requested providers to test bed.
    for (const provider of mapValues(this.providerDef)) {
      providers.push(provider);
    }

    // Analyzing providers.
    for (const provider of flatten(providers)) {
      const provide = typeof provider === 'object' && (provider as any).provide ? (provider as any).provide : provider;
      ngMocksUniverse.touches.add(provide);

      if (provide !== provider && (provider as any).deps) {
        extractDependency((provider as any).deps, ngMocksUniverse.config.get('deps'));
      }
    }

    // Mocking root providers.
    const parameters = new Set<any>();
    if (!this.keepDef.has(NG_MOCKS_ROOT_PROVIDERS)) {
      // We need buckets here to process first all depsSkip, then deps and only after that all other defs.
      const buckets: any[] = [];
      buckets.push(mapValues(ngMocksUniverse.config.get('depsSkip')));
      buckets.push(mapValues(ngMocksUniverse.config.get('deps')));
      buckets.push(mapValues(ngMocksUniverse.touches));
      // Also we need to track what has been touched to check params recursively, but avoiding duplicates.
      const touched: any[] = [].concat(...buckets);
      for (const bucket of buckets) {
        for (const def of bucket) {
          if (!skipDep(def)) {
            if (this.mockDef.has(NG_MOCKS_ROOT_PROVIDERS) || !ngMocksUniverse.config.get('depsSkip').has(def)) {
              parameters.add(def);
            }
          }

          for (const decorators of jitReflector.parameters(def)) {
            const provide: any = extractDep(decorators);
            if (skipDep(provide)) {
              continue;
            }
            if (typeof provide === 'function' && touched.indexOf(provide) === -1) {
              touched.push(provide);
              bucket.push(provide);
            }

            if (this.mockDef.has(NG_MOCKS_ROOT_PROVIDERS) || !ngMocksUniverse.config.get('depsSkip').has(def)) {
              parameters.add(provide);
            } else {
              ngMocksUniverse.config.get('depsSkip').add(provide);
            }
          }
        }
      }
    }

    // Adding missed providers.
    if (parameters.size) {
      const parametersMap = new Map();
      for (const parameter of mapValues(parameters)) {
        const mock = mockServiceHelper.resolveProvider(parameter, parametersMap);
        if (mock) {
          providers.push(mock);
        } else if (isNgInjectionToken(parameter)) {
          const multi = ngMocksUniverse.config.has('multi') && ngMocksUniverse.config.get('multi').has(parameter);
          providers.push(mockServiceHelper.useFactory(parameter, () => (multi ? [] : undefined)));
        }
      }
    }

    const mocks = new Map();
    for (const [key, value] of [
      ...mapEntries(ngMocksUniverse.builder),
      ...mapEntries(ngMocksUniverse.cacheMocks),
      ...mapEntries(ngMocksUniverse.cacheProviders),
    ]) {
      if (mocks.has(key)) {
        continue;
      }
      mocks.set(key, value);
    }

    providers.push({
      provide: NG_MOCKS,
      useValue: mocks,
    });

    // Redefining providers for kept declarations.
    const touches = new Set();
    providers.push({
      provide: NG_MOCKS_TOUCHES,
      useValue: touches,
    });
    const overrides: Map<Type<any>, MetadataOverride<any>> = new Map();
    providers.push({
      provide: NG_MOCKS_OVERRIDES,
      useValue: overrides,
    });
    for (const proto of mapValues(ngMocksUniverse.touches)) {
      const source: any = proto;
      let value = ngMocksUniverse.builder.get(source);

      // kept declarations should be based on their source.
      if (value === undefined) {
        value = source;
      }

      touches.add(source);
      touches.add(value);

      // no reason to touch mocks
      if (ngMocksUniverse.cacheMocks.has(value)) {
        continue;
      }

      // no customizations in replacements
      if (this.replaceDef.has(source) && value === this.defValue.get(source)) {
        continue;
      }

      let meta: NgModule | undefined;
      if (isNgDef(value, 'c')) {
        meta = directiveResolver.resolve(value);
      } else if (isNgDef(value, 'd')) {
        meta = directiveResolver.resolve(value);
      } else {
        continue;
      }

      const skipMock = ngMocksUniverse.flags.has('skipMock');
      /* istanbul ignore else */
      if (!skipMock) {
        ngMocksUniverse.flags.add('skipMock');
      }
      const [changed, def] = MockNgDef({ providers: meta.providers });
      /* istanbul ignore else */
      if (!skipMock) {
        ngMocksUniverse.flags.delete('skipMock');
      }
      if (!changed) {
        continue;
      }
      const override: MetadataOverride<NgModule> = {
        set: def,
      };
      overrides.set(value, override);
    }

    for (const key of Object.keys(backup)) {
      (ngMocksUniverse as any)[key] = (backup as any)[key];
    }

    return {
      declarations,
      imports,
      providers,
    };
  }

  public exclude(def: any): this {
    this.wipe(def);
    this.excludeDef.add(def);

    return this;
  }

  public keep<T>(def: NgModuleWithProviders<T>, config?: IMockBuilderConfig): this;
  public keep<T>(token: InjectionToken<T>, config?: IMockBuilderConfig): this;
  public keep<T>(def: AnyType<T>, config?: IMockBuilderConfig): this;
  public keep(def: any, config?: IMockBuilderConfig): this;
  public keep(input: any, config?: IMockBuilderConfig): this {
    const { def, providers } = isNgModuleDefWithProviders(input)
      ? { def: input.ngModule, providers: input.providers }
      : { def: input, providers: undefined };

    const existing = this.keepDef.has(def) ? this.defProviders.get(def) : [];
    this.wipe(def);
    this.keepDef.add(def);

    // a magic to support modules with providers.
    if (providers) {
      this.defProviders.set(def, [...existing, ...providers]);
    }

    if (config) {
      this.configDef.set(def, config);
    } else {
      this.configDef.delete(def);
    }

    return this;
  }

  public mock<T extends PipeTransform>(pipe: AnyType<T>, config?: IMockBuilderConfig): this;
  public mock<T extends PipeTransform>(
    pipe: AnyType<T>,
    mock?: PipeTransform['transform'],
    config?: IMockBuilderConfig
  ): this;
  public mock<T>(token: InjectionToken<T>, mock: any, config: IMockBuilderConfig): this;
  public mock<T>(provider: AnyType<T>, mock: AnyType<T>, config: IMockBuilderConfig): this;
  public mock<T>(provider: AnyType<T>, mock: Partial<T>, config: IMockBuilderConfig): this;
  public mock<T>(provider: AnyType<T>, mock: AnyType<T>, config: IMockBuilderConfig): this;
  public mock<T>(token: InjectionToken<T>, mock?: any): this;
  public mock<T>(def: NgModuleWithProviders<T>): this;
  public mock<T>(def: AnyType<T>, config: IMockBuilderConfig): this;
  public mock<T>(provider: AnyType<T>, mock?: Partial<T>): this;
  public mock<T>(def: AnyType<T>): this;
  public mock(input: any, a1: any = defaultMock, a2?: any): this {
    const { def, providers } = isNgModuleDefWithProviders(input)
      ? { def: input.ngModule, providers: input.providers }
      : { def: input, providers: undefined };

    let mock: any = def === a1 ? defaultMock : a1;
    let config: any = a2 ? a2 : a1 !== defaultMock ? a1 : undefined;
    if (isNgDef(def, 'p') && typeof a1 === 'function') {
      mock = a1;
      config = a2;
    }
    if (!isNgDef(def)) {
      config = a2;
    }

    const existing = this.mockDef.has(def) ? this.defProviders.get(def) : [];
    this.wipe(def);
    this.mockDef.add(def);

    // a magic to support modules with providers.
    if (providers) {
      this.defProviders.set(def, [...existing, ...providers]);
    }

    if (isNgDef(def, 'p') && typeof mock === 'function') {
      this.defValue.set(def, mock);
    }
    if (!isNgDef(def) && mock !== defaultMock) {
      this.defValue.set(def, mock);
    }

    if (config) {
      this.configDef.set(def, config);
    } else {
      this.configDef.delete(def);
    }

    return this;
  }

  public provide(def: Provider): this {
    for (const provider of flatten(def)) {
      const provide = typeof provider === 'object' && provider.provide ? provider.provide : provider;
      const multi = typeof provider === 'object' && provider.provide && provider.multi;
      const existing = this.providerDef.has(provide) ? this.providerDef.get(provide) : [];
      this.wipe(provide);
      this.providerDef.set(provide, multi ? [...existing, provider] : provider);
    }
    return this;
  }

  public replace(source: Type<any>, destination: Type<any>, config?: IMockBuilderConfig): this {
    if (!isNgDef(destination) || !isNgDef(source)) {
      throw new Error(
        'Cannot replace the declaration, both have to be a Module, a Component, a Directive or a Pipe, for Providers use `.mock` or `.provide`'
      );
    }

    this.wipe(source);
    this.replaceDef.add(source);
    this.defValue.set(source, destination);

    if (config) {
      this.configDef.set(source, config);
    } else {
      this.configDef.delete(source);
    }
    return this;
  }

  public then<TResult1 = IMockBuilderResult, TResult2 = never>(
    fulfill?: (value: IMockBuilderResult) => PromiseLike<TResult1>,
    reject?: (reason: any) => PromiseLike<TResult2>
  ): PromiseLike<TResult1 | TResult2> {
    const promise = new Promise((resolve: (value: IMockBuilderResult) => void): void => {
      const testBed = TestBed.configureTestingModule(this.build());
      for (const callback of mapValues(this.beforeCC)) {
        callback(testBed);
      }
      const testBedPromise = testBed.compileComponents();
      testBedPromise.then(() => {
        resolve({ testBed });
      });
    });
    return promise.then(fulfill, reject);
  }

  private wipe(def: Type<any>): void {
    this.defProviders.delete(def);
    this.defValue.delete(def);
    this.excludeDef.delete(def);
    this.keepDef.delete(def);
    this.mockDef.delete(def);
    this.providerDef.delete(def);
    this.replaceDef.delete(def);
  }
}
