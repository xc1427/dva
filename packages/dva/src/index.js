import React from 'react';
import invariant from 'invariant';
import { createBrowserHistory, createMemoryHistory, createHashHistory } from 'history';
import document from 'global/document';
import {
  Provider,
  connect,
  connectAdvanced,
  useSelector,
  useDispatch,
  useStore,
  shallowEqual,
} from 'react-redux';
import { bindActionCreators } from 'redux';
import { utils, create, saga } from 'dva-core';
import * as router from 'react-router-dom';
import * as routerRedux from 'connected-react-router';

const { connectRouter, routerMiddleware } = routerRedux;
const { isFunction } = utils;

// 这个就是业务中 dva() 调用时候那个函数 `dva`
// opts 之后传给 dva-core#create 函数，最为第一个入参 hookAndOpts
// 以下是 opts 可以取的所有值 [ref](https://dvajs.com/api/#app-dva-opts)
/**
 const app = dva({
  history,
  initialState,
  namespacePrefixWarning,  // DiamondYuan 新添加
  onError,
  onAction,
  onStateChange,
  onReducer,
  onEffect,
  onHmr,
  extraReducers,
  extraEnhancers,
});
 */
export default function(opts = {}) {
  const history = opts.history || createHashHistory();
  const createOpts = {
    initialReducer: {
      router: connectRouter(history),
    },
    /**
     *
     * @param {*} middlewares - 在 call site 内置的 middleware 会被传递进来，这里能做的一般也就是 ...middleware
     * 内置的 middleware 有 promiseMiddleware, sagaMiddleware, onAction 插件带来的 middleware
     */
    setupMiddlewares(middlewares) {
      return [routerMiddleware(history), ...middlewares];
    },
    setupApp(app) {
      // setupApp 作为 createOpts.setupApp 在 dva-core#create 里面被回调
      app._history = patchHistory(history);
      // app._history = patchHistory(history);
    },
  };

  /**
   * @tutorial create 函数会给与 app 以 model 、use 、start 等方法
   * @param {} opts - hooksAndOpts
   * @param {} createOpts - 主要就是 redux createStore 需要的参数，这也是为什么这个地方叫做 `create`
   */
  const app = create(opts, createOpts);
  const oldAppStart = app.start;

  // router 和 start 都是定义在闭包里面的两个函数
  app.router = router;

  app.start = start;
  return app;

  /**
   * @description - 这个函数是给 _router 赋值用的
   * @param {*} router - 形状 (injected: { history, app, ..extraProps }) => React.ReactElement; 例子见下
   *
function RouterConfig({ history }) {
  return (
    <ConnectedRouter history={history}>
      <Route path="/" exact component={IndexPage} />
    </ConnectedRouter>
  );
}

export default RouterConfig;

   */
  function router(router) {
    invariant(
      isFunction(router),
      `[app.router] router should be function, but got ${typeof router}`,
    );
    app._router = router;
  }

  function start(container) {
    // container 可以是诸如 "#root" 的字符串，用 querySelector 找元素
    if (isString(container)) {
      container = document.querySelector(container);
      invariant(container, `[app.start] container ${container} not found`);
    }

    // 并且是 HTMLElement
    invariant(
      !container || isHTMLElement(container),
      `[app.start] container should be HTMLElement`,
    );

    // 路由必须提前注册
    invariant(app._router, `[app.start] router must be registered before app.start()`);

    if (!app._store) {
      oldAppStart.call(app);
    }

    //cxi: 经过 oldAppStart.call(app) 之后，app._store 就有值了，值就是
    // redux store

    const store = app._store;

    // export _getProvider for HMR
    // ref: https://github.com/dvajs/dva/issues/469
    app._getProvider = getProvider.bind(null, store, app);

    // If has container, render; else, return react component
    if (container) {
      // ReactDOM.render 本身就是一个 imperative 的过程，这里没毛病
      render(container, store, app, app._router);
      app._plugin.apply('onHmr')(render.bind(null, container, store, app));
    } else {
      return getProvider(store, this, this._router);
    }
  }
}

function isHTMLElement(node) {
  return typeof node === 'object' && node !== null && node.nodeType && node.nodeName;
}

function isString(str) {
  return typeof str === 'string';
}

/**
 * 关于 extraProps 用在哪里了.
 * 当 start 函数的入参 container 为空时，start 函数会只把 DvaRoot 返回（实质上还是一个 Provider），
 * 而非去做 ReactDOM.render()。此时返回的 DvaRoot 就可以接受这些 extraProps, 并注入给 app.route 函数的入参（又是个函数，也就是下面的 route）的入参使用。

 如下的函数就是一个 app.route 的入参的例子，

 function RouterConfig({ app, history, ...extraProps }) {
  return (
    <ConnectedRouter history={history}>
      <Route path="/" exact component={IndexPage} />
    </ConnectedRouter>
  );
}

业务可以灵活地使用 <DvaRoot prop1={..} props2={..} /> 来包裹它自己的业务,
prop1, prop2 可以注入给 RouterConfig，上面 extraProps 为 { prop1, prop2 }

 *
 */
function getProvider(store, app, router) {
  const DvaRoot = extraProps => (
    <Provider store={store}>{router({ app, history: app._history, ...extraProps })}</Provider>
  );
  return DvaRoot;
}

/**
 * @description - ReactDOM.render 的 wrapper
 * @param {*} container
 * @param {*} store
 * @param {*} app
 * @param {*} router - router 就是 组件树
 */
function render(container, store, app, router) {
  const ReactDOM = require('react-dom'); // eslint-disable-line
  ReactDOM.render(React.createElement(getProvider(store, app, router)), container);
}

// 把 history 的 listen 给换了一下
function patchHistory(history) {
  const oldListen = history.listen;
  history.listen = callback => {
    // 仔细想想，其实并没有改变 react-router/history 的 api，这里还是一个 proxy
    callback(history.location, history.action);
    // return unlisten
    return oldListen.call(history, callback);
  };
  return history;
}

export fetch from 'isomorphic-fetch';
export dynamic from './dynamic';
export { connect, connectAdvanced, useSelector, useDispatch, useStore, shallowEqual };
export { bindActionCreators };
export { router };
export { saga };
export { routerRedux };
export { createBrowserHistory, createMemoryHistory, createHashHistory };
