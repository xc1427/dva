import invariant from 'invariant';
import warning from 'warning';
import { effects as sagaEffects } from 'redux-saga';
import { NAMESPACE_SEP } from './constants';
import prefixType from './prefixType';

/**
 * @description - 返回的结果就是给 sagaMiddleware.run 来使用
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/index.js
282:         sagas.push(app._getSaga(m.effects, m, onError, plugin.get('onEffect'), hooksAndOpts));
283:
...
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/index.js
319:     sagas.forEach(sagaMiddleware.run);
320:

File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/index.js
120:       store.runSaga(app._getSaga(m.effects, m, onError, plugin.get('onEffect'), hooksAndOpts));
121:


 *
 * @param onEffect - 插件
 * @param onError - 插件
 * @param {*} opts - 就是那个 hooksAndOpts

 * @use_site
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/index.js
262:     app._getSaga = getSaga.bind(null);
263:

 * @call_site
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/index.js
281:       if (m.effects) {
282:         sagas.push(app._getSaga(m.effects, m, onError, plugin.get('onEffect'), hooksAndOpts));
283:       }

 * */

export default function getSaga(effects, model, onError, onEffect, opts = {}) {
  return function*() {
    for (const key in effects) {
      if (Object.prototype.hasOwnProperty.call(effects, key)) {
        // 得到一个 redux-saga 语境下的 watcher 类型的 saga
        const watcher = getWatcher(key, effects[key], model, onError, onEffect, opts);

        // 把这个 saga fork 出来，之后可以 cancel
        const task = yield sagaEffects.fork(watcher);
        yield sagaEffects.fork(function*() {
          /**
           * @put_site - dva-core/index#replaceModel
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/index.js
174:     if (~oldModelIdx) {
175:       // Cancel effects
176:       store.dispatch({ type: `${namespace}/@@CANCEL_EFFECTS` });
177:

            @put_site - dva-core/index#unmodel
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/index.js
148:     store.dispatch({ type: `${namespace}/@@CANCEL_EFFECTS` });

           */
          yield sagaEffects.take(`${model.namespace}/@@CANCEL_EFFECTS`);
          yield sagaEffects.cancel(task);
        });
      }
    }
  };
}

/**
 * @description - getWatcher 大体上可以看做是 getSaga 的单体版（在 effects 上迭代）
 * @param {*} key - 就是业务定义 model 时，写的effects: {} 里面的每一个 effect 的 key
 * @param {*} _effect - SagaIterator | [SagaIterator, { type: 'watcher' | 'takeLatest' | 'throttle' }] , 就是 key 所对应的 effect
 * @param {*} model - 就是业务定义的 model，除了 prefix 了 namespace，原版的。
 * @param {*} onError - 出错时调用的，传入的位置：/dva-core/src/index.js#116: store.runSaga(app._getSaga(m.effects, m, onError, plugin.get('onEffect'), hooksAndOpts));

 * @param { Function[] } onEffect - onEffect 插件, 传入的位置：/dva-core/src/index.js#116: store.runSaga(app._getSaga(m.effects, m, onError, plugin.get('onEffect'), hooksAndOpts));
 * @param {*} opts - 就是那个 hooksAndOpts
 */
function getWatcher(key, _effect, model, onError, onEffect, opts) {
  let effect = _effect;
  let type = 'takeEvery';
  let ms;
  let delayMs;

  if (Array.isArray(_effect)) {
    [effect] = _effect;
    const opts = _effect[1];
    if (opts && opts.type) {
      ({ type } = opts);
      if (type === 'throttle') {
        invariant(opts.ms, 'app.start: opts.ms should be defined if type is throttle');
        ({ ms } = opts);
      }
      if (type === 'poll') {
        invariant(opts.delay, 'app.start: opts.delay should be defined if type is poll');
        ({ delay: delayMs } = opts);
      }
    }
    invariant(
      ['watcher', 'takeEvery', 'takeLatest', 'throttle', 'poll'].indexOf(type) > -1,
      'app.start: effect type should be takeEvery, takeLatest, throttle, poll or watcher',
    );
  }

  function noop() {}

  /**
   * @tutorial -
     - 这个函数存在的目的是主要为了把 onError 给用上去
     - sagaWithCatch 也可以看成是一个 onEffect 插件，只不过没有通过插件机制去注册
   * @param  {...any} args
   */
  function* sagaWithCatch(...args) {
    const { __dva_resolve: resolve = noop, __dva_reject: reject = noop } =
      args.length > 0 ? args[0] : {};
    console.log('debug cxi', 'sagaWithCatch::args which may contain __dva_resolve', args);
    try {
      yield sagaEffects.put({ type: `${key}${NAMESPACE_SEP}@@start` });

      // 这里的 effect 是 model.effect 中定义的那个，原版的
      const ret = yield effect(...args.concat(createEffects(model, opts)));
      yield sagaEffects.put({ type: `${key}${NAMESPACE_SEP}@@end` });
      resolve(ret);
    } catch (e) {
      onError(e, {
        key,
        effectArgs: args,
      });
      if (!e._dontReject) {
        reject(e);
      }
    }
  }

  // 应用了所有 `onEffect` 插件后得到的 saga，类型为 SagaIterator。
  // 比如 dva-loading 插件，那么此时其实已经实施了该插件的逻辑
  const sagaWithOnEffect = applyOnEffect(onEffect, sagaWithCatch, model, key);

  switch (type) {
    case 'watcher':
      return sagaWithCatch;
    case 'takeLatest':
      return function*() {
        /**
        takeLatest 的合同是这样的：takeLatest 会把从第 2 (from 0)个入参开始的参数传给第一个入参函数（也即那个 worker saga，这里是 sagaWithOnEffect），并且把 action 附在最后面。这里举一个例子：

        type HelperFunc2<A, T1, T2> = (arg1: T1, arg2: T2, action: A) => any;

        这里是不给 takeLatest 多余入参，那么只有 action
        传给 sagaWithOnEffect。

        因此，

File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/getSaga.js
124:       const ret = yield effect(...args.concat(createEffects(model, opts)));
125:
        这里的 args 只有 action，所有的入参就是 （action， effectsCommandMap) ，完全吻合业务代码中的感受
         */
        yield sagaEffects.takeLatest(key, sagaWithOnEffect);
      };
    case 'throttle':
      return function*() {
        yield sagaEffects.throttle(ms, key, sagaWithOnEffect);
      };
    case 'poll':
      return function*() {
        function delay(timeout) {
          return new Promise(resolve => setTimeout(resolve, timeout));
        }
        function* pollSagaWorker(sagaEffects, action) {
          const { call } = sagaEffects;
          while (true) {
            yield call(sagaWithOnEffect, action);
            yield call(delay, delayMs);
          }
        }
        const { call, take, race } = sagaEffects;
        while (true) {
          const action = yield take(`${key}-start`);
          yield race([call(pollSagaWorker, sagaEffects, action), take(`${key}-stop`)]);
        }
      };
    default:
      return function*() {
        yield sagaEffects.takeEvery(key, sagaWithOnEffect);
      };
  }
}

/**
 * @description 用来注入 m.effect 第二个入参的那个「无需关心」 namespace 的 effectCommandMap，
 * 这也是我的 getModelState, setModelState 可以发挥的地方。本质上返回一个对象

 * @param {*} model - prefixNamespaced model
 * @param {*} opts - hooksAndOpts
 */
function createEffects(model, opts) {
  function assertAction(type, name) {
    invariant(type, 'dispatch: action should be a plain Object with type');

    const { namespacePrefixWarning = true } = opts;

    if (namespacePrefixWarning) {
      warning(
        type.indexOf(`${model.namespace}${NAMESPACE_SEP}`) !== 0,
        `[${name}] ${type} should not be prefixed with namespace ${model.namespace}`,
      );
    }
  }

  /**
   * put 和 put.resolve 不做 typeof string 判断
   * @param {*} action
   */
  function put(action) {
    const { type } = action;
    assertAction(type, 'sagaEffects.put');
    return sagaEffects.put({ ...action, type: prefixType(type, model) });
  }

  // The operator `put` doesn't block waiting the returned promise to resolve.
  // Using `put.resolve` will wait until the promsie resolve/reject before resuming.
  // It will be helpful to organize multi-effects in order,
  // and increase the reusability by seperate the effect in stand-alone pieces.
  // https://github.com/redux-saga/redux-saga/issues/336
  function putResolve(action) {
    const { type } = action;
    assertAction(type, 'sagaEffects.put.resolve');
    return sagaEffects.put.resolve({
      ...action,
      type: prefixType(type, model),
    });
  }
  put.resolve = putResolve;

  /**
   * @tutorial - 如果 take 的东西是 string，或者 string[]，那么都给弄个前缀，否则不变
   */
  function take(type) {
    if (typeof type === 'string') {
      assertAction(type, 'sagaEffects.take');
      return sagaEffects.take(prefixType(type, model));
    } else if (Array.isArray(type)) {
      return sagaEffects.take(
        type.map(t => {
          if (typeof t === 'string') {
            assertAction(t, 'sagaEffects.take');
            return prefixType(t, model);
          }
          return t;
        }),
      );
    } else {
      return sagaEffects.take(type);
    }
  }
  return { ...sagaEffects, put, take };
}

/**
 * @returns SagaIterator
 * @param fns -
     - OnEffect[]。 每个元素是一个 onEffect 函数（前期由 onEffect 插件搜集的）
     - type OnEffect = (effect:SagaIterator, sagaEffects, model, key) => SagaIterator;
 * @param effect - SagaIterator。 实质是 sagaWithCatch
 * @param model - prefixNamespaced model
 * @param key - effect 对应的 key
 * @tutorial：把每个 `onEffect` 函数洋葱式地叠上去
 */
function applyOnEffect(fns, effect, model, key) {
  for (const fn of fns) {
    effect = fn(effect, sagaEffects, model, key);
  }
  return effect;
}
