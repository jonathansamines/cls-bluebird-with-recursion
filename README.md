# Multiple bluebird instrumentation calls

## Issue description
From instana >=1.65.0, the package started [registering a require hook](https://github.com/instana/nodejs-sensor/blob/master/packages/core/src/tracing/instrumentation/control_flow/bluebird.js#L18) which is currently used to ensure all bluebird versions get patched properly by using [cls-bluebird](https://github.com/TimBeyer/cls-bluebird/blob/master/lib/index.js#L16).

The [cls-bluebird](https://github.com/TimBeyer/cls-bluebird/blob/master/lib/index.js#L16) package can instrument the currently installed bluebird version, if consumers decide not to specify the bluebird instance to patch.

When both features are combined, (I think) the following happens:

1. Instana registers a require hook, intercepting all requires to bluebird.
2. Consumers try to instrument bluebird with a cls namespace without specifying a bluebird instance
3. cls-bluebird tries to require bluebird to instrument it
4. Since the require hook is already registered, it will intercept the bluebird require call
5. Instana require hook will try to instrument the intercepted bluebird call by calling cls-bluebird again (this time with the intercepted bluebird instance)
6. We have now a recusive call to cls-bluebird. As described by the [Node.js modules Cycle](https://nodejs.org/dist/latest-v10.x/docs/api/modules.html#modules_cycles) documentation, Node.js deals with this scenario by providing a temporal incomplete export value (an empty object in this case) to the module causing the cycle call. 
7. The module causing the cycle call is the instana require hook, which tries to [immediately call](https://github.com/instana/nodejs-sensor/blob/master/packages/core/src/tracing/instrumentation/control_flow/bluebird.js#L18) the cls-bluebird's require result, which under normal conditions is a function
8. The function call fails, because the required value is not a function (yet), it's an object

## Additional information
As described in the test cases provided below, you will get an error stating that bluebird cannot be required. That is because cls-bluebird [ignores the underlying error](https://github.com/TimBeyer/cls-bluebird/blob/master/lib/index.js#L16). Print that error, to get the underlying error:

```bash
TypeError: require(...) is not a function
    at patchBluebird (/Users/jsamines/dev/personal/cls-bluebird-with-recursion/instana-master/node_modules/@instana/core/src/tracing/instrumentation/control_flow/bluebird.js:19:26)
    at Function.patchedModuleLoad [as _load] (/Users/jsamines/dev/personal/cls-bluebird-with-recursion/instana-master/node_modules/@instana/core/src/util/requireHook.js:58:36)
    at Module.require (internal/modules/cjs/loader.js:637:17)
    at require (internal/modules/cjs/helpers.js:22:18)
    at Object.<anonymous> (/Users/jsamines/dev/personal/cls-bluebird-with-recursion/instana-master/node_modules/cls-bluebird/lib/index.js:15:13)
    at Module._compile (internal/modules/cjs/loader.js:701:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:712:10)
    at Module.load (internal/modules/cjs/loader.js:600:32)
    at tryModuleLoad (internal/modules/cjs/loader.js:539:12)
    at Function.Module._load (internal/modules/cjs/loader.js:531:3)
    at Function.patchedModuleLoad [as _load] (/Users/jsamines/dev/personal/cls-bluebird-with-recursion/instana-master/node_modules/@instana/core/src/util/requireHook.js:25:32)
    at Module.require (internal/modules/cjs/loader.js:637:17)
    at require (internal/modules/cjs/helpers.js:22:18)
    at Object.<anonymous> (/Users/jsamines/dev/personal/cls-bluebird-with-recursion/instana-master/test.js:12:28)
    at Module._compile (internal/modules/cjs/loader.js:701:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:712:10)
```

## Suggested solution
Require the cls-bluebird module, before the instana require hook is registered. By doing that, we avoid the recursive call


## Instana 1.68.x
Current instana sensor published to the npm publish registry:

```bash
cd instana-master && npm i && npm t

/Users/jsamines/dev/personal/cls-bluebird-with-recursion/instana-master/node_modules/cls-bluebird/lib/index.js:46
		if (!Promise) throw new Error('Could not require Bluebird');
		              ^

Error: Could not require Bluebird
    at patchBluebird (/Users/jsamines/dev/personal/cls-bluebird-with-recursion/instana-master/node_modules/cls-bluebird/lib/index.js:46:23)
    at Object.<anonymous> (/Users/jsamines/dev/personal/cls-bluebird-with-recursion/instana-master/test.js:17:1)
    at Module._compile (internal/modules/cjs/loader.js:701:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:712:10)
    at Module.load (internal/modules/cjs/loader.js:600:32)
    at tryModuleLoad (internal/modules/cjs/loader.js:539:12)
    at Function.Module._load (internal/modules/cjs/loader.js:531:3)
    at Function.Module.runMain (internal/modules/cjs/loader.js:754:12)
    at startup (internal/bootstrap/node.js:283:19)
    at bootstrapNodeJSCore (internal/bootstrap/node.js:622:3)
npm ERR! Test failed.  See above for more details.
```

## Instana (with patch)
Temporal instana sensor published by using [gitpkg](https://github.com/ramasilveyra/gitpkg) pointing to [4eded2f6fa](https://github.com/jonathansamines/nodejs-sensor/commit/4eded2f6fa8b365a002b902a747cba66e508ec2e) with the proposed change

```bash
cd instana-patch && npm i && npm t

// operation succeeds
```
