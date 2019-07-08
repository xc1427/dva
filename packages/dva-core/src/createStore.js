import { createStore, applyMiddleware, compose } from 'redux';
import flatten from 'flatten';
import invariant from 'invariant';
import window from 'global/window';
import { returnSelf, isArray } from './utils';

export default function({
  reducers,
  initialState,
  plugin,
  sagaMiddleware,
  promiseMiddleware,
  createOpts: { setupMiddlewares = returnSelf },
}) {
  // extra enhancers
  const extraEnhancers = plugin.get('extraEnhancers');
  invariant(
    isArray(extraEnhancers),
    `[app.start] extraEnhancers should be array, but got ${typeof extraEnhancers}`,
  );

  // createStore 劫持了 redux 本身的 createStore，sagaMiddleware 和 promiseMiddleware 是写死在入参 。。。
  // 。。 里的。routerMiddleware 是通过 createOpts.setupMiddlewares 传进来的。调用链路是这样的：

  // - 外界 app.dva()，执行  dva/src/index.js#const app = create(opts, createOpts);
  // - createOpts 里面已经有 routerMiddleware，在 dva/src/index.js
  // - createOpts 被冻结在 dva-core/src/index.js# export function create(hooksAndOpts = {}, createOpts = {}) {
  // - 当 app.start() 时候 dva-core/src/index.js# 如下
  /**
   *
    // Create store
    app._store = createStore({
      reducers: createReducer(),
      initialState: hooksAndOpts.initialState || {},
      plugin,
      createOpts,
      sagaMiddleware,
      promiseMiddleware,
    });
   */
  // - 此时 sagaMiddleware 和 promiseMiddleware 在 dva-core/src/index.js 里面传入

  const extraMiddlewares = plugin.get('onAction');
  const middlewares = setupMiddlewares([
    promiseMiddleware,
    sagaMiddleware,
    ...flatten(extraMiddlewares),
  ]);

  const composeEnhancers =
    process.env.NODE_ENV !== 'production' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
      ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({ trace: true, maxAge: 30 })
      : compose;

  const enhancers = [applyMiddleware(...middlewares), ...extraEnhancers];

  return createStore(reducers, initialState, composeEnhancers(...enhancers));
}
