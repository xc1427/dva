import { combineReducers } from 'redux';
import createSagaMiddleware, * as saga from 'redux-saga';
import invariant from 'invariant';
import checkModel from './checkModel';
import prefixNamespace from './prefixNamespace';
import Plugin, { filterHooks } from './Plugin';
import createStore from './createStore';
import getSaga from './getSaga';
import getReducer from './getReducer';
import createPromiseMiddleware from './createPromiseMiddleware';
import { run as runSubscription, unlisten as unlistenSubscription } from './subscription';
import * as utils from './utils';

const { noop, findIndex } = utils;

// Internal model to update global state when do unmodel
const dvaModel = {
  namespace: '@@dva',
  state: 0,
  reducers: {
    UPDATE(state) {
      return state + 1;
    },
  },
};

/**
 * cxi:
 * @tutorial - dva-core 这个文件唯一一个 non-trivial 的 export 就是这个 create 函数
 * @description - 此函数只在内部使用，没有 export 给业务代码。
业务代码中写的 app.use() 中的那个 `app` 由这个 create 函数生成的。
调用 create 也会冻结 createOpts，供之后 app.start 使用。
 *
 * @param hooksAndOpts - 形状如下
{
  history,
  initialState,
  namespacePrefixWarning, // DiamondYuan 新添加
  onError,
  onAction,
  onStateChange,
  onReducer,
  onEffect,
  onHmr,
  extraReducers,
  extraEnhancers,
}
 * @param createOpts - 形状如下
  {
    initialReducer: {[k:string]: ReduxCanonicalReducer }
    setupMiddlewares: (middleware: [Middleware]) => Middleware[],
    setupApp: () => void，
  }

  目前 setupApp 实例也只是做了 app._history = patchHistory(history);

 * @returns app
 {
   // 这些是在 本文件的 create 调动时生成的，
    _models;
    _store;
    _plugin;
    use;
    model;
    start;

    // 这些是在 app.start() 执行时又生成的
    _getSaga?;
    replaceModel?;
    unmodel?;

    // 这个是在 app.start 内部又调用 setupApp 后生成的
    _history?;

    // 这个是在 dva/index.js#default 中生成的
    router?;  // 这个函数是用来给 _router 赋值的
    _router?: (injected: { history, app, ..extraProps }) => React.ReactElement
    _getProvider?; // _getProvider for HMR

 }
 * @call_site
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva/src/index.js
58:   const app = create(opts, createOpts);
59:   const oldAppStart = app.start;
 */

/**
 * Create dva-core instance.
 *
 * @param hooksAndOpts
 * @param createOpts
 */
export function create(hooksAndOpts = {}, createOpts = {}) {
  const { initialReducer, setupApp = noop } = createOpts;

  const plugin = new Plugin();
  plugin.use(filterHooks(hooksAndOpts));
  const app = {
    _models: [prefixNamespace({ ...dvaModel })],
    _store: null,
    _plugin: plugin,
    use: plugin.use.bind(plugin),
    model,
    start,
  };
  // dva/index.js 又会給上面定义的 start 函数做一个 proxy，做法见下，
  /**
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva/src/index.js
60:   const oldAppStart = app.start;
           ~~~~~~~~~~~~~~~~~~~~~~~~~
...

67:   app.start = start;
      ~~~~~~~~~~~~~~~~~
68:   return app;
69:
70:   function router(router) {
71:     invariant(
72:       isFunction(router),
73:       `[app.router] router should be function, but got ${typeof router}`,
74:     );
75:     app._router = router;
76:   }
77:
78:   function start(container) {
               ~~~~~~
...

95:     if (!app._store) {
96:       oldAppStart.call(app);
          ~~~~~~~~~~~
97:     }
   */

  return app;

  /**
   model 函数用法举例，比如在 .umi/ 目录下就有
     app.model({ namespace: 'global', ...(require('/Users/xichen/Desktop/test-umi-antdpro/src/models/global.ts').default) });
   */

  /**
   * Register model before app is started.
   *
   * @param m {Object} model to register
   */
  function model(m) {
    if (process.env.NODE_ENV !== 'production') {
      checkModel(m, app._models);
    }
    const prefixedModel = prefixNamespace({ ...m });
    app._models.push(prefixedModel);
    return prefixedModel;
  }

  /**
   * Inject model after app is started.
   *
   * @param createReducer
   * @param onError
   * @param unlisteners
   * @param m
   */
  /** 别看这里定义了这些入参，最终除了 m 都被 bind 了，见下
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/index.js
366:     app.model = injectModel.bind(app, createReducer, onError, unlisteners);
367:
   */
  function injectModel(createReducer, onError, unlisteners, m) {
    m = model(m);

    // 想象这些都是在 redux#createStore 调用后又做的事情
    // 这个 app._store 是真真正正的 redux store，被 extend 了一些属性而已
    const store = app._store;
    store.asyncReducers[m.namespace] = getReducer(m.reducers, m.state, plugin._handleActions);

    // 这些都是在 redux/createStore 调用后才提供的能力
    // 所以 replaceReducer 才存在
    store.replaceReducer(createReducer());
    if (m.effects) {
      store.runSaga(app._getSaga(m.effects, m, onError, plugin.get('onEffect'), hooksAndOpts));
    }
    if (m.subscriptions) {
      unlisteners[m.namespace] = runSubscription(m.subscriptions, m, app, onError);
    }
  }

  /**
   * Unregister model.
   *
   * @param createReducer
   * @param reducers
   * @param unlisteners
   * @param namespace
   *
   * Unexpected key warn problem:
   * https://github.com/reactjs/redux/issues/1636
   */
  // 别看这里定义了这些入参，最终除了 namespace 都被 bind 了，具体见下约 L371
  function unmodel(createReducer, reducers, unlisteners, namespace) {
    const store = app._store;

    // Delete reducers
    delete store.asyncReducers[namespace];
    delete reducers[namespace];
    store.replaceReducer(createReducer());
    store.dispatch({ type: '@@dva/UPDATE' });

    // Cancel effects
    store.dispatch({ type: `${namespace}/@@CANCEL_EFFECTS` });

    // Unlisten subscrioptions
    unlistenSubscription(unlisteners, namespace);

    // Delete model from app._models
    app._models = app._models.filter(model => model.namespace !== namespace);
  }

  /**
   * Replace a model if it exsits, if not, add it to app
   * Attention:
   * - Only available after dva.start gets called
   * - Will not check origin m is strict equal to the new one
   * Useful for HMR
   * @param createReducer
   * @param reducers
   * @param unlisteners
   * @param onError
   * @param m
   */
  // 别看这里定义了这些入参，最终除了 m 都被 bind 了，见下约 L372
  function replaceModel(createReducer, reducers, unlisteners, onError, m) {
    const store = app._store;
    const { namespace } = m;
    const oldModelIdx = findIndex(app._models, model => model.namespace === namespace);

    if (~oldModelIdx) {
      // Cancel effects
      store.dispatch({ type: `${namespace}/@@CANCEL_EFFECTS` });

      // Delete reducers
      delete store.asyncReducers[namespace];
      delete reducers[namespace];

      // Unlisten subscrioptions
      unlistenSubscription(unlisteners, namespace);

      // Delete model from app._models
      app._models.splice(oldModelIdx, 1);
    }

    // add new version model to store
    app.model(m);

    store.dispatch({ type: '@@dva/UPDATE' });
  }

  // 这里面是【贼重要】的逻辑，启动 saga 那些就是在这里做的。dva/index.js 里面也有 start 函数 ，那个 start 函数在执行前，会先执行此处的 start 函数，相当于做了一个 proxy

  /**
   * Start the app.
   *
   * @returns void
   */
  function start() {
    /** onError
     * @use_site - 本文件的下面这行 sagas.push(app._getSaga(m.effects, m, onError, plugin.get('onEffect'), hooksAndOpts));
     * @call_site
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/getSaga.js
60:      const ret = yield effect(...args.concat(createEffects(model, opts)));
61:       yield sagaEffects.put({ type: `${key}${NAMESPACE_SEP}@@end` });
62:       resolve(ret);
63:     } catch (e) {
64:       onError(e, {
          ~~~~~~~~~~~~~~~
65:         key,
66:         effectArgs: args,
67:       });
68:       if (!e._dontReject) {
69:         reject(e);
70:       }
71:     }
     *
     * @param {*} err : 就是 catch 到的 error 传到这里
     * @param {*} extension：形状是 { key, effectArgs: any[] }
     * 一个例子：
{
  "key": "user/fetchCurrent",
  "effectArgs": [
    {
      "type": "user/fetchCurrent"
    }
  ]
}
     */
    // Global error handler
    const onError = (err, extension) => {
      if (err) {
        if (typeof err === 'string') err = new Error(err);
        err.preventDefault = () => {
          err._dontReject = true;
        };
        plugin.apply('onError', err => {
          throw new Error(err.stack || err);
        })(err, app._store.dispatch, extension);
      }
      // 向上注释：根据 plugin.prototype.apply 的实现细节，可以推出：
      // 此处的入参 `err, app._store.dispatch, extension` 之后就是传给
      // 回调 err => { throw new Error(err.stack || err); }，也就
      // 意味着 app._store.dispatch，和 extension 在回调中并没有被使用
    };

    const sagaMiddleware = createSagaMiddleware();
    const promiseMiddleware = createPromiseMiddleware(app);

    // 尽管 getSaga 函数内部并没有使用任何的this，但是这里
    // 还是用了 bind(null)，应该是云谦防御性编程
    app._getSaga = getSaga.bind(null);

    const sagas = [];

    /** initialReducer
     * @tutorial - 目前来讲 initialReducer 是如下：
     File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva/src/index.js
42:     initialReducer: {
43:       router: connectRouter(history),
44:     },
     */
    const reducers = { ...initialReducer };

    /**
     * @tutorial - 把业务定义的 reducers 变成 Redux 格式的 reducer
     */
    for (const m of app._models) {
      reducers[m.namespace] = getReducer(m.reducers, m.state, plugin._handleActions);
      if (m.effects) {
        sagas.push(app._getSaga(m.effects, m, onError, plugin.get('onEffect'), hooksAndOpts));
      }
    }
    const reducerEnhancer = plugin.get('onReducer');
    const extraReducers = plugin.get('extraReducers');
    invariant(
      Object.keys(extraReducers).every(key => !(key in reducers)),
      `[app.start] extraReducers is conflict with other reducers, reducers list: ${Object.keys(
        reducers,
      ).join(', ')}`,
    );

    // Create store
    app._store = createStore({
      reducers: createReducer(),
      initialState: hooksAndOpts.initialState || {},
      plugin,
      createOpts,
      sagaMiddleware,
      promiseMiddleware,
    });

    const store = app._store;

    // Extend store
    store.runSaga = sagaMiddleware.run;
    store.asyncReducers = {};

    // Execute listeners when state is changed
    const listeners = plugin.get('onStateChange');
    for (const listener of listeners) {
      store.subscribe(() => {
        listener(store.getState());
      });
    }

    // Run sagas
    sagas.forEach(sagaMiddleware.run);

    // Setup app
    setupApp(app);

    // Run subscriptions
    const unlisteners = {};
    for (const model of this._models) {
      if (model.subscriptions) {
        unlisteners[model.namespace] = runSubscription(model.subscriptions, model, app, onError);
      }
    }

    // Setup app.model and app.unmodel
    app.model = injectModel.bind(app, createReducer, onError, unlisteners);
    app.unmodel = unmodel.bind(app, createReducer, reducers, unlisteners);
    app.replaceModel = replaceModel.bind(app, createReducer, reducers, unlisteners, onError);

    /**
     * Create global reducer for redux.
     *
     * @returns {Object}
     */
    function createReducer() {
      return reducerEnhancer(
        combineReducers({
          ...reducers,
          ...extraReducers,
          ...(app._store ? app._store.asyncReducers : {}),
        }),
      );
    }
  }
}

export { saga };
export { utils };
