/* global angular */
(function() {
'use strict';

angular.module('ngImprovedModules', []);

}());
;/* global angular */
(function() {
'use strict';

/** @const */
var serviceRegistrationMethodNames = ['provider', 'factory', 'service', 'value', 'constant'];

angular.module('ngImprovedModules').factory('moduleIntrospector', [
    'moduleInvokeQueueItemInfoExtractor',
    function(moduleInvokeQueueItemInfoExtractor) {

    /**
     * @ngdoc type
     * @param {string} moduleName
     * @constructor
     */
    function ModuleIntrospector(moduleName) {

        var module = angular.module(moduleName);

        /**
         * @param {string} serviceName
         * @returns {{module: Object, providerMethod: string, declaration: *}}
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
            var serviceInfo = getServiceInfo(serviceName);
            if (!serviceInfo.declaration) {
                throw 'Could not find declaration of service with name: ' + serviceName;
            }

            return getRegisteredObjectDependencies(injector, serviceInfo);
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
         * @param $injector
         * @param {string} controllerName
         * @returns {Object.<{instance: *, module: angular.Module}>}
         */
        this.getControllerDependencies = function($injector, controllerName) {
            var controllerInfo = getControllerInfo(controllerName);
            if (!controllerInfo.declaration) {
                throw 'Could not find declaration of controller with name: ' + controllerName;
            }

            return getRegisteredObjectDependencies($injector, controllerInfo, '$scope');
        };


        /**
         * @param injector
         * @param {{module: Object, declaration: *}} registeredObjectInfo
         * @param {...string} toBeIgnoredDependencyServiceNames
         * @returns {Object.<{instance: *, module: angular.Module}>}
         */
        function getRegisteredObjectDependencies(injector, registeredObjectInfo, toBeIgnoredDependencyServiceNames) {
            var dependencyServiceNames = injector.annotate(registeredObjectInfo.declaration);
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


        /**
         * @returns {({module: Object}|{module: Object, providerMethod: string, declaration: *})}
         */
        function getServiceInfo(serviceName) {
            var result = moduleInvokeQueueItemInfoExtractor.findInvokeQueueItemInfo(
                    module, '$provide', serviceRegistrationMethodNames, serviceName);

            if (!result) {
                var ngModuleInjector = angular.injector(['ng']);

                if (ngModuleInjector.has(serviceName)) {
                    result = {module: angular.module('ng')};
                }
            }

            if (!result) {
                throw 'Could not find service with name: ' + serviceName;
            }

            return result;
        }

        /**
         * @returns {({module: Object}|{module: Object, providerMethod: string, declaration: *})}
         */
        function getFilterInfo(filterName) {
            var result = moduleInvokeQueueItemInfoExtractor.findInvokeQueueItemInfo(
                    module, '$filterProvider', 'register', filterName);

            if (!result) {
                var ngModuleInjector = angular.injector(['ng']);

                if (ngModuleInjector.has(filterName + 'Filter')) {
                    result = {module: angular.module('ng')};
                }
            }

            if (!result) {
                throw 'Could not find filter with name: ' + filterName;
            }

            return result;
        }

        /**
         * @param {string} controllerName
         * @returns {({module: Object}|{module: Object, providerMethod: string, declaration: *})}
         */
        function getControllerInfo(controllerName) {
            var result = moduleInvokeQueueItemInfoExtractor.findInvokeQueueItemInfo(
                    module, '$controllerProvider', 'register', controllerName);

            if (!result) {
                throw 'Could not find controller with name: ' + controllerName;
            }

            return result;
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

}]);

}());
;/* global angular */
(function() {
'use strict';

angular.module('ngImprovedModules').service('moduleInvokeQueueItemInfoExtractor', [function () {

    var that = this;

    /**
     * @returns {?{module: Object, providerMethod: string, declaration: *}}
     */
    this.findInvokeQueueItemInfo = function (module, providerName, providerMethods, itemName) {

        /**
         * @returns {?{module: Object, providerMethod: string, declaration: *}}
         */
        function findInvokeQueueItemInfoRecursive(currentModule, providerName, providerMethods, itemName) {
            var result = null;

            for (var j = 0; j < currentModule.requires.length; j++) {
                var requiredModule = angular.module(currentModule.requires[j]);

                result = findInvokeQueueItemInfoRecursive(requiredModule, providerName, providerMethods, itemName);

                //TODO: write logic to account for the fact that a non-constant declaration should not be allowed to
                //  override a earlier constant declaration
            }

            var providerDeclarationOnInvokeQueue =
                that.findProviderDeclarationOnInvokeQueue(currentModule, providerName, providerMethods, itemName);
            if (providerDeclarationOnInvokeQueue) {
                result = angular.extend(providerDeclarationOnInvokeQueue, {module: currentModule});
            }

            return result;
        }


        return findInvokeQueueItemInfoRecursive(module, providerName, providerMethods, itemName);
    };


    /**
     * @returns {?{providerMethod: string, declaration: *}}
     */
    this.findProviderDeclarationOnInvokeQueue = function (currentModule, providerName, providerMethods, itemName) {
        var result;

        for (var i = 0; i < currentModule._invokeQueue.length; i++) {
            var item = currentModule._invokeQueue[i];

            var currentProviderName = item[0];
            var currentProviderMethod = item[1];

            if (currentProviderName === providerName && providerMethods.indexOf(currentProviderMethod) !== -1) {
                var invokeLaterArgs = item[2];

                if (invokeLaterArgs.length === 2) {
                    if (invokeLaterArgs[0] === itemName) {
                        result = {providerMethod: currentProviderMethod, declaration: invokeLaterArgs[1]};

                        if (isConstantService(providerName, currentProviderMethod)) {
                            return result;
                        }
                    }
                } else if (invokeLaterArgs.length === 1) {
                    if (invokeLaterArgs[0].hasOwnProperty(itemName)) {
                        result = {providerMethod: currentProviderMethod, declaration: invokeLaterArgs[0][itemName]};

                        if (isConstantService(providerName, currentProviderMethod)) {
                            return result;
                        }
                    }
                } else {
                    throw 'Unexpected length of invokeQueue[' + i + '][2] (the "invokeLater" arguments): ' +
                        invokeLaterArgs.length;
                }
            }
        }

        return result;
    };


    function isConstantService(providerName, providerMethod) {
        return providerName === '$provide' && providerMethod === 'constant';
    }
}]);

}());