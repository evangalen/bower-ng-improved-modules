/**
 * @license ngModuleIntrospector
 * (c) 2014 Emil van Galen. https://github.com/evangalen/ng-improved-modules
 * License: MIT
 */
(function() { 'use strict';

angular.module('ngModuleIntrospector', []);

/**
 * @typedef {(Function|Array.<(string|Function)>)} PossiblyAnnotatedFn
 */
/**
 * @typedef {({$get: Function|Array.<(string|Function)>}|Function|Array.<(string|Function)>)} RawProviderDeclaration
 */
/**
 * @typedef {({$get: Function|Array.<(string|Function)>}|Function)} StrippedProviderDeclaration
 */


/**
 * @ngdoc type
 * @param {...string} moduleNames
 * @constructor
 */
function ModuleIntrospector(moduleNames) {
    moduleNames = Array.prototype.slice.call(arguments, 0);


    /**
     * @param {object} providerInstance
     * @param {string} methodName
     * @param {function(string, *)} afterMethodLogic
     */
    function afterProviderMethodExecution(providerInstance, methodName, afterMethodLogic) {
        return afterExecution(providerInstance, methodName, supportObject(afterMethodLogic));
    }

    /**
     * @param {function(string, *)} delegate
     * @returns {function((object|string), *=)}
     */
    function supportObject(delegate) {
        return function(key, value) {
            if (angular.isObject(key)) {
                angular.forEach(arguments[0], function(rawDeclaration, componentName) {
                    delegate(componentName, rawDeclaration);
                });
            } else {
                return delegate(key, value);
            }
        };
    }

    /**
     * @param {object} object
     * @param {string} methodName
     * @param {Function} afterMethodLogic
     */
    function afterExecution(object, methodName, afterMethodLogic) {
        var originalMethod = object[methodName];

        object[methodName] = function() {
            var result = originalMethod.apply(this, arguments);

            afterMethodLogic.apply(this, arguments);

            return result;
        };
    }

    /**
     * @param {PossiblyAnnotatedFn} possiblyAnnotatedFn
     * @returns {Function}
     */
    function stripAnnotations(possiblyAnnotatedFn) {
        if (angular.isFunction(possiblyAnnotatedFn)) {
            return possiblyAnnotatedFn;
        } else {
            return possiblyAnnotatedFn[possiblyAnnotatedFn.length - 1];
        }
    }

    /**
     * @param {PossiblyAnnotatedFn} possiblyAnnotatedFn
     * @returns {string[]}
     */
    function determineDependencies(possiblyAnnotatedFn) {
        return emptyInjector.annotate(possiblyAnnotatedFn);
    }

    /**
     * @param {string} providerName
     * @param {string} providerMethod
     * @param {string} componentName
     * @param {*} rawDeclaration
     * @param {*} strippedDeclaration
     * @param {string[]} injectedServices
     */
    function registerComponent(
            providerName, providerMethod, componentName, rawDeclaration, strippedDeclaration, injectedServices) {
        var registeredComponents = registeredComponentsPerProviderName[providerName];
        if (!registeredComponents) {
            registeredComponents = {};
            registeredComponentsPerProviderName[providerName] = registeredComponents;
        }

        registeredComponents[componentName] = {
            providerMethod: providerMethod,
            componentName: componentName,
            rawDeclaration: rawDeclaration,
            strippedDeclaration: strippedDeclaration,
            injectedServices: injectedServices
        };
    }

    /**
     * @param {string} serviceName
     * @returns {boolean}
     */
    function existingConstantService(serviceName) {
        var registeredServices = registeredComponentsPerProviderName.$provide;
        if (!registeredServices) {
            return false;
        }

        var registeredService = registeredServices[serviceName];
        return !!registeredService && registeredService.providerMethod === 'constant';
    }

    /**
     * @param {string} serviceProviderName
     * @param {RawProviderDeclaration} rawDeclaration
     * @param {StrippedProviderDeclaration} strippedDeclaration
     * @param {string[]} injectedProviders
     */
    function registerServiceProviderDeclaration(
            serviceProviderName, rawDeclaration, strippedDeclaration, injectedProviders) {
        serviceProviderDeclarationPerProviderName[serviceProviderName] = {
                rawDeclaration: rawDeclaration,
                strippedDeclaration: strippedDeclaration,
                injectedProviders: injectedProviders
            };
    }

    function registerBuiltInFilters($FilterProvider) {
        var $provideCapturingFactoryInvocations = {
            factory: function(name, getFn) {
                var suffix = 'Filter';

                var endsWithFilterSuffix = name.indexOf(suffix, name.length - suffix.length) !== -1;
                if (!endsWithFilterSuffix) {
                    throw 'Unexpected registered factory: ' + name;
                }

                var providerName = '$filterProvider';
                var filterProviderRegistrationMethodName = registrationMethodPerProvider[providerName];
                var nameWithoutSuffix = name.substring(0, name.length - suffix.length);

                registerComponent(providerName, filterProviderRegistrationMethodName, nameWithoutSuffix, getFn,
                    stripAnnotations(getFn), determineDependencies(getFn));
            }
        };


        emptyInjector.instantiate($FilterProvider, {$provide: $provideCapturingFactoryInvocations});
    }


    /**
     * @type {
     *  Object.<
     *      Object.<{
     *          providerMethod: string,
     *          componentName: string,
     *          rawDeclaration: *,
     *          strippedDeclaration: *,
     *          injectedServices: string[]
     *      }>
     *  >}
     */
    var registeredComponentsPerProviderName = {};

    /**
      * @type {Object.<{
      *     rawDeclaration: RawProviderDeclaration,
      *     strippedDeclaration: StrippedProviderDeclaration,
      *     injectedProviders: string[]
      *  }>}
      */
    var serviceProviderDeclarationPerProviderName = {};

    var registrationMethodPerProvider = {
        $filterProvider: 'register',
        $controllerProvider: 'register',
        $compileProvider: 'directive',
        $animateProvider: 'register'
    };

    var emptyInjector = angular.injector([]);

    var providerInjector = null;


    /** @ngInject */
    var providerInjectorCapturingConfigFn = function ($injector) {
        providerInjector = $injector;
    };
    providerInjectorCapturingConfigFn.$inject = ["$injector"];

    /** @ngInject */
    var $provideMethodsHookConfigFn = function($provide) {

        var registerService = angular.bind(undefined, registerComponent, '$provide');


        afterProviderMethodExecution($provide, 'constant', function(/** string */ name, value) {
            registerService('constant', name, value, value, []);
        });

        afterProviderMethodExecution($provide, 'value', function(/** string */ name, value) {
            if (!existingConstantService(name)) {
                registerService('value', name, value, value, []);
            }
        });

        afterProviderMethodExecution($provide, 'service', function(/** string */ name, /** PossiblyAnnotatedFn */ service) {
            if (!existingConstantService(name)) {
                registerService('service', name,
                    service, stripAnnotations(service), determineDependencies(service));
            }
        });

        afterProviderMethodExecution($provide, 'factory', function(/** string */ name, /** PossiblyAnnotatedFn */ getFn) {
            if (!existingConstantService(name)) {
                registerService('factory', name,
                    getFn, stripAnnotations(getFn), determineDependencies(getFn));
            }
        });

        afterProviderMethodExecution($provide, 'provider', function(/** string */ name, /** RawProviderDeclaration */ provider) {
            if (existingConstantService(name)) {
                return;
            }

            var providerName = name + 'Provider';

            var isProviderObject = angular.isObject(provider) && !angular.isArray(provider);
            var strippedProviderDeclaration = !isProviderObject ? stripAnnotations(provider) : provider;
            var injectedProviders = !isProviderObject ? determineDependencies(provider) : [];
            registerServiceProviderDeclaration(providerName, provider, strippedProviderDeclaration, injectedProviders);

            var providerInstance = providerInjector.get(providerName);

            registerService('provider', name, providerInstance.$get,
                    stripAnnotations(providerInstance.$get), determineDependencies(providerInstance.$get));

            if (name === '$filter') {
                registerBuiltInFilters(provider);
            }


            var registrationMethodOfProvider = registrationMethodPerProvider[providerName];
            if (registrationMethodOfProvider) {
                afterProviderMethodExecution(providerInstance, registrationMethodOfProvider, function(
                        /** string */ name, /** PossiblyAnnotatedFn */ rawDeclaration) {
                    registerComponent(providerName, registrationMethodOfProvider, name, rawDeclaration,
                            stripAnnotations(rawDeclaration), determineDependencies(rawDeclaration));
                });
            }
        });
    };
    $provideMethodsHookConfigFn.$inject = ["$provide"];


    // create an injector that first captures the "providerInjector", then hooks the $provide methods,
    // after that loads the ng module and finally loads the modules of moduleNames.
    angular.injector([providerInjectorCapturingConfigFn, $provideMethodsHookConfigFn, 'ng'].concat(moduleNames));


    /**
     * @param {string} providerName
     * @param {string} componentName
     * @returns {{
     *      providerMethod: string,
     *      componentName: string,
     *      rawDeclaration: *,
     *      strippedDeclaration: *,
     *      injectedServices: string[]
     *  }}
     */
    this.getProviderComponentDeclaration = function(providerName, componentName) {
        var registeredComponents = registeredComponentsPerProviderName[providerName];

        var registeredComponent = registeredComponents && registeredComponents[componentName];
        if (!registeredComponent) {
            throw 'Could not find registered component "' + componentName + '" for provider: ' + providerName;
        }

        return registeredComponent;
    };


    /**
     * @param {string} providerName
     * @returns {{rawDeclaration: RawProviderDeclaration, strippedDeclaration: StrippedProviderDeclaration, injectedProviders: string[]}}
     */
    this.getProviderDeclaration = function(providerName) {
        var result = serviceProviderDeclarationPerProviderName[providerName];
        if (!result) {
            throw 'Could not find provider: ' + providerName;
        }

        //noinspection JSValidateTypes
        return result; //TODO: investigate with WebStorm complains about incompatible types
    };

}


angular.module('ngModuleIntrospector')
    .factory('moduleIntrospector', function() {

        /**
         * @ngdoc service
         * @name moduleIntrospector
         * @param {...string} modules
         * @returns {ModuleIntrospector}
         * @function
         */
        return function moduleIntrospector(modules) {
            return new ModuleIntrospector(modules);
        };
    });

}());