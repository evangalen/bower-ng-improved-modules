(function() {
'use strict';

angular.module('ngModuleIntrospector', []);

}());

;(function() {
'use strict';

/** @const */
var serviceRegistrationMethodNames = ['provider', 'factory', 'service', 'value', 'constant'];

/** @const */
var angular1_0 = angular.version.full.indexOf('1.0.') === 0;


var numberOfBuildProviderProbingModules = 0;


// @ngInject
function moduleIntrospectorServiceFactory(moduleInvokeQueueItemInfoExtractor) {

    /**
     * @ngdoc type
     * @param {string} moduleName
     * @constructor
     */
    function ModuleIntrospector(moduleName) {

        var module = angular.module(moduleName);


        /**
         * @param {string} serviceName
         * @returns {{module: Object, providerName: string, providerMethod: string, declaration: *}}
         */
        this.getServiceDeclaration = function(serviceName) {
            var serviceInfo = getServiceInfo(serviceName);
            if (!serviceInfo.declaration) {
                throw 'Could not find declaration of service with name: ' + serviceName;
            }

            return serviceInfo;
        };

        /**
         * @param injector
         * @param {string} serviceName
         * @returns {Object.<{instance: *, module: angular.Module}>}
         */
        this.getServiceDependencies = function(injector, serviceName) {
            var serviceInfo = this.getServiceDeclaration(serviceName);

            if (serviceInfo.providerMethod === 'provider') {
                serviceInfo.declaration = $getDeclaration(serviceName, serviceInfo.declaration);
            }

            return getRegisteredObjectDependencies(injector, serviceInfo);
        };

        /**
         *
         * @param {string} serviceName
         * @returns {boolean}
         */
        this.hasValueService = function(serviceName) {
            var serviceInfo = getServiceInfo(serviceName);

            return !!(serviceInfo && serviceInfo.declaration && serviceInfo.providerMethod === 'value');
        };

        /**
         *
         * @param {string} serviceName
         * @returns {boolean}
         */
        this.hasConstantService = function(serviceName) {
            var serviceInfo = getServiceInfo(serviceName);

            return !!(serviceInfo && serviceInfo.declaration && serviceInfo.providerMethod === 'constant');
        };

        /**
         * @param {string} filterName
         * @returns {{module: Object, providerName: string, providerMethod: string, declaration: *}}
         */
        this.getFilterDeclaration = function(filterName) {
            var filterInfo = getFilterInfo(filterName);
            if (!filterInfo.declaration) {
                throw 'Could not find declaration of filter with name: ' + filterName;
            }

            return filterInfo;
        };

        /**
         * @param injector
         * @param {string} filterName
         * @returns {Object.<{instance: *, module: angular.Module}>}
         */
        this.getFilterDependencies = function(injector, filterName) {
            var filterInfo = getFilterInfo(filterName);
            if (!filterInfo.declaration) {
                throw 'Could not find declaration of filter with name: ' + filterName;
            }

            return getRegisteredObjectDependencies(injector, filterInfo);
        };

        /**
         * @param {string} controllerName
         * @returns {{module: Object, providerName: string, providerMethod: string, declaration: *}}
         */
        this.getControllerDeclaration = function(controllerName) {
            return getControllerInfo(controllerName);
        };

        /**
         * @param $injector
         * @param {string} controllerName
         * @returns {Object.<{instance: *, module: angular.Module}>}
         */
        this.getControllerDependencies = function($injector, controllerName) {
            var controllerInfo = getControllerInfo(controllerName);

            return getRegisteredObjectDependencies($injector, controllerInfo, '$scope');
        };

        /**
         * @param {string} directiveName
         * @returns {{module: Object, providerName: string, providerMethod: string, declaration: *}}
         */
        this.getDirectiveDeclaration = function(directiveName) {
            return getDirectiveInfo(directiveName);
        };

        /**
         * @param $injector
         * @param {string} directiveName
         * @returns {Object.<{instance: *, module: angular.Module}>}
         */
        this.getDirectiveDependencies = function($injector, directiveName) {
            var directiveInfo = getDirectiveInfo(directiveName);

            return getRegisteredObjectDependencies($injector, directiveInfo);
        };

        if (!angular1_0) {
            /**
             * @param {string} animationName
             * @returns {{module: Object, providerName: string, providerMethod: string, declaration: *}}
             */
            this.getAnimationDeclaration = function (animationName) {
                return getAnimationInfo(animationName);
            };

            /**
             * @param $injector
             * @param {string} animationName
             * @returns {Object.<{instance: *, module: angular.Module}>}
             */
            this.getAnimationDependencies = function ($injector, animationName) {
                var animationInfo = getAnimationInfo(animationName);

                return getRegisteredObjectDependencies($injector, animationInfo);
            };
        }

        /**
         * @param injector
         * @param {{module: Object, providerName: string, providerMethod: string, declaration: *}} registeredObjectInfo
         * @param {...string} toBeIgnoredDependencyServiceNames
         * @returns {Object.<{instance: *, module: angular.Module}>}
         */
        function getRegisteredObjectDependencies(injector, registeredObjectInfo, toBeIgnoredDependencyServiceNames) {
            var declaration = registeredObjectInfo.declaration;

            var dependencyServiceNames = injector.annotate(declaration);
            toBeIgnoredDependencyServiceNames = Array.prototype.slice.call(arguments, 2);

            var result = {};
            angular.forEach(dependencyServiceNames, function(dependencyServiceName) {
                if (!toBeIgnoredDependencyServiceNames ||
                        toBeIgnoredDependencyServiceNames.indexOf(dependencyServiceName) === -1) {
                    var dependencyServiceInfo = {};
                    dependencyServiceInfo.instance = injector.get(dependencyServiceName);
                    dependencyServiceInfo.module = getServiceInfo(dependencyServiceName).module;

                    result[dependencyServiceName] = dependencyServiceInfo;
                }
            });

            return result;
        }

        function $getDeclaration(providerName, providerDeclaration) {
            if (angular.isObject(providerDeclaration) && !angular.isArray(providerDeclaration)) {
                return providerDeclaration.$get;
            } else {
                var providerProbingModuleName =
                    'generatedPoviderProbingModule#' + numberOfBuildProviderProbingModules;

                var providerInstance = null;

                angular.module(providerProbingModuleName, [module.name])
                    .config([providerName + 'Provider', function(_providerInstance_) {
                        providerInstance = _providerInstance_;
                    }]);

                angular.injector(['ng', providerProbingModuleName]);

                return providerInstance.$get;
            }
        }

        /**
         * @returns {({module: Object}|{module: Object, providerName: string, providerMethod: string, declaration: *})}
         */
        function getServiceInfo(serviceName) {
            var result = moduleInvokeQueueItemInfoExtractor.findInvokeQueueItemInfo(
                    module, '$provide', serviceRegistrationMethodNames, serviceName);

            if (!result) {
                var ngModuleInjector = /** @type {$injector} */ angular.injector(['ng']);

                if (hasService(ngModuleInjector, serviceName)) {
                   result = {module: angular.module('ng')};
                }
            } else {
                result.providerName = '$provide';
            }

            if (!result) {
                throw 'Could not find service with name: ' + serviceName;
            }

            return result;
        }

        /**
         * @returns {({module: Object}|{module: Object, providerName: string, providerMethod: string, declaration: *})}
         */
        function getFilterInfo(filterName) {
            var result = moduleInvokeQueueItemInfoExtractor.findInvokeQueueItemInfo(
                    module, '$filterProvider', ['register'], filterName);

            if (!result) {
                var ngModuleInjector = /** @type {$injector} */ angular.injector(['ng']);

                if (hasService(ngModuleInjector, filterName + 'Filter')) {
                    result = {module: angular.module('ng')};
                }
            } else {
                result.providerName = '$filterProvider';
            }

            if (!result) {
                throw 'Could not find filter with name: ' + filterName;
            }

            return result;
        }

        /**
         * @param {string} controllerName
         * @returns {{module: Object, providerName: string, providerMethod: string, declaration: *}}
         */
        function getControllerInfo(controllerName) {
            var result = moduleInvokeQueueItemInfoExtractor.findInvokeQueueItemInfo(
                    module, '$controllerProvider', ['register'], controllerName);

            if (!result) {
                throw 'Could not find controller with name: ' + controllerName;
            } else {
                result.providerName = '$controllerProvider';
            }

            return result;
        }

        /**
         * @param {string} directiveName
         * @returns {{module: Object, providerName: string, providerMethod: string, declaration: *}}
         */
        function getDirectiveInfo(directiveName) {
            var result = moduleInvokeQueueItemInfoExtractor.findInvokeQueueItemInfo(
                    module, '$compileProvider', ['directive'], directiveName);

            if (!result) {
                throw 'Could not find directive with name: ' + directiveName;
            } else {
                result.providerName = '$compileProvider';
            }

            return result;
        }

        /**
         * @param {string} animationName
         * @returns {{module: Object, providerName: string, providerMethod: string, declaration: *}}
         */
        function getAnimationInfo(animationName) {
            var result = moduleInvokeQueueItemInfoExtractor.findInvokeQueueItemInfo(
                    module, '$animateProvider', ['register'], animationName);

            if (!result) {
                throw 'Could not find animation with name: ' + animationName;
            } else {
                result.providerName = '$animateProvider';
            }

            return result;
        }

        /**
         * @param {$injector} injector
         * @param {string} serviceName
         * @returns {boolean}
         */
        function hasService(injector, serviceName) {
            if (injector.has) {
                return injector.has(serviceName);
            } else {
                try {
                    injector.get(serviceName);

                    return true;
                } catch (e) {
                    if (e instanceof Error && e.message.indexOf('Unknown provider: ') === 0) {
                        return false;
                    } else {
                        throw e;
                    }
                }
            }
        }

    }


    /**
     * @ngdoc service
     * @name moduleIntrospector
     * @param {string} module
     * @returns {ModuleIntrospector}
     * @function
     */
    return function moduleIntrospector(module) {
        return new ModuleIntrospector(module);
    };

}
moduleIntrospectorServiceFactory.$inject = ["moduleInvokeQueueItemInfoExtractor"];


angular.module('ngModuleIntrospector')
    .factory('moduleIntrospector', moduleIntrospectorServiceFactory);

}());

;(function() {
'use strict';

/**
 * @ngdoc service
 * @name ModuleInvokeQueueItemInfoExtractor
 * @constructor
 */
// @ngInject
function ModuleInvokeQueueItemInfoExtractor() {

    var that = this;


    /**
     * @param {object} module an angular module
     * @param {string} providerName
     * @param {Array.<string>} providerMethods
     * @param {string} itemName
     * @returns {?{module: Object, providerMethod: string, declaration: *}}
     */
    this.findInvokeQueueItemInfo = function (module, providerName, providerMethods, itemName) {

        var visitedModules = {};


        /**
         * @param {?{module: Object, providerMethod: string, declaration: *}} previousResult
         * @param {object} currentModule
         * @param {{providerName: string, providerMethods: Array.<string>, itemName: string}} searchParams
         * @returns {?{module: Object, providerMethod: string, declaration: *}}
         */
        function findInvokeQueueItemInfoRecursive(previousResult, currentModule, searchParams) {

            visitedModules[currentModule.name] = true;


            var result = null;

            angular.forEach(currentModule.requires, function(nameOfRequiredModule) {
                if (!visitedModules[nameOfRequiredModule]) {
                    var requiredModule = angular.module(nameOfRequiredModule);

                    var resultFromRecursiveInvocation =
                        findInvokeQueueItemInfoRecursive(previousResult, requiredModule, searchParams);

                    if (providerName !== '$provide' || !previousResult || !resultFromRecursiveInvocation ||
                        previousResult.providerMethod !== 'constant' ||
                        resultFromRecursiveInvocation.providerMethod === 'constant') {
                        result = resultFromRecursiveInvocation;
                    }

                    previousResult = result;
                } else {
                    result = previousResult;
                }
            });

            var providerDeclarationOnInvokeQueue =
                that.findProviderDeclarationOnInvokeQueue(previousResult, currentModule, searchParams);
            if (providerDeclarationOnInvokeQueue) {
                result = angular.extend(providerDeclarationOnInvokeQueue, {module: currentModule});

                if (!result) {
                    result = previousResult;
                } else {
                    previousResult = result;
                }
            }

            return result;
        }


        return findInvokeQueueItemInfoRecursive(
                null, module, {providerName: providerName, providerMethods: providerMethods, itemName: itemName});
    };


    /**
     * @param {?{module: Object, providerMethod: string, declaration: *}} previousResult
     * @param {object} currentModule
     * @param {{providerName: string, providerMethods: Array.<string>, itemName: string}} searchParams
     * @returns {?{providerMethod: string, declaration: *}}
     */
    this.findProviderDeclarationOnInvokeQueue = function (previousResult, currentModule, searchParams) {
        var result = null;

        angular.forEach(currentModule._invokeQueue, function(item, index) {
            var currentProviderName = item[0];
            var currentProviderMethod = item[1];

            if (currentProviderName === searchParams.providerName &&
                    searchParams.providerMethods.indexOf(currentProviderMethod) !== -1) {
                var invokeLaterArgs = item[2];

                if (invokeLaterArgs.length === 2) {
                    if (invokeLaterArgs[0] === searchParams.itemName) {
                        if (isNotConstantServiceOrTryingToOverrideOne(
                                previousResult, searchParams, currentProviderMethod)) {
                            result = {providerMethod: currentProviderMethod, declaration: invokeLaterArgs[1]};

                            previousResult = result;
                        }
                    }
                } else if (invokeLaterArgs.length === 1) {
                    if (invokeLaterArgs[0].hasOwnProperty(searchParams.itemName)) {
                        if (isNotConstantServiceOrTryingToOverrideOne(
                                previousResult, searchParams, currentProviderMethod)) {
                            result = {
                                providerMethod: currentProviderMethod,
                                declaration: invokeLaterArgs[0][searchParams.itemName]
                            };

                            previousResult = result;
                        }
                    }
                } else {
                    throw 'Unexpected length of invokeQueue[' + index + '][2] (the "invokeLater" arguments): ' +
                        invokeLaterArgs.length;
                }
            }
        });

        return result;
    };


    function isNotConstantServiceOrTryingToOverrideOne(previousResult, searchParams, currentProviderMethod) {
        return searchParams.providerName !== '$provide' || !previousResult ||
                previousResult.providerMethod !== 'constant' || currentProviderMethod === 'constant';
    }
}


angular.module('ngModuleIntrospector')
    .service('moduleInvokeQueueItemInfoExtractor', ModuleInvokeQueueItemInfoExtractor);

}());