import invariant from 'invariant';
import { isPlainObject } from './utils';

const hooks = [
  'onError',
  'onStateChange',
  'onAction',
  'onHmr',
  'onReducer',
  'onEffect',
  'extraReducers',
  'extraEnhancers',
  '_handleActions',
];

// call-site:
// File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/index.js
// 66:   plugin.use(filterHooks(hooksAndOpts));

// 入参：obj 将会是 hooksAndOpts， 形状如下
/**
 {
  history,
  initialState,
  onError,
  onAction,
  onStateChange,
  onReducer,
  onEffect,
  onHmr,
  extraReducers,
  extraEnhancers,
}
 */

// 功能：因为 hooksAndOpts 里既有 hooks 的部分，也有 opts，这个函数
// 把 hooks 的部分过滤出来
export function filterHooks(obj) {
  return Object.keys(obj).reduce((memo, key) => {
    if (hooks.indexOf(key) > -1) {
      memo[key] = obj[key];
    }
    return memo;
  }, {});
}

export default class Plugin {
  constructor() {
    this._handleActions = null;

    // hooks 的形状会是：Record<ElementOf<typeof hooks>, Function[]>
    this.hooks = hooks.reduce((memo, key) => {
      memo[key] = [];
      return memo;
    }, {});
  }

  /**
   * @call-site:
   File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/index.js
74:     use: plugin.use.bind(plugin),
75:
    @usage:
    业务中的 app.use() 的那个 use 就是调用的这里的 use
   */

  use(plugin) {
    invariant(isPlainObject(plugin), 'plugin.use: plugin should be plain object');
    const { hooks } = this;
    for (const key in plugin) {
      if (Object.prototype.hasOwnProperty.call(plugin, key)) {
        invariant(hooks[key], `plugin.use: unknown plugin property: ${key}`);
        if (key === '_handleActions') {
          this._handleActions = plugin[key];

          // extraReducers 这类 plugin 只能有一个，这里的赋值逻辑会使得后注册的覆盖旧的
        } else if (key === 'extraEnhancers') {
          hooks[key] = plugin[key];
          // 否则，正常滴，每类 plugin 是一个列表
        } else {
          hooks[key].push(plugin[key]);
        }
      }
    }
  }

  /**
   *
   * @param {*} key： ElementOf<typeof hooks>


   * @param {*} defaultHandler
   */
  apply(key, defaultHandler) {
    const { hooks } = this;
    const validApplyHooks = ['onError', 'onHmr'];
    invariant(validApplyHooks.indexOf(key) > -1, `plugin.apply: hook ${key} cannot be applied`);

    // 通过 key 取到 hook 函数组
    const fns = hooks[key];

    return (...args) => {
      if (fns.length) {
        // 让每个函数都执行一遍，
        for (const fn of fns) {
          fn(...args);
        }
      } else if (defaultHandler) {
        if (key === 'onError') {
          console.log('debug cxi', 'defaultHandler', defaultHandler);
          console.log('debug cxi', 'args in Plugin.prototype.apply', args);
        }
        defaultHandler(...args);
      }
    };
  }

  /**
   * @param key - ElementOf<typeof hooks>
   * @description - 返回对应于 key 的插件，`extraReducers` 和  `onReducer` 类单独处理
   */
  get(key) {
    const { hooks } = this;
    invariant(key in hooks, `plugin.get: hook ${key} cannot be got`);

    // 对于 extraReducer 和 onReducer 做特殊处理
    if (key === 'extraReducers') {
      return getExtraReducers(hooks[key]);
    } else if (key === 'onReducer') {
      return getOnReducer(hooks[key]);
    } else {
      return hooks[key];
    }
  }
}

/**
 * @功能：内部函数，把列表变成 extraReducer 要求的形状
 * @param {*} hook - extraReducers 的列表，每个 extraReducer 的形状是 { [k:string]: Reducer }
 * @return {[k: string]: Reducer}
 */
function getExtraReducers(hook) {
  let ret = {};
  for (const reducerObj of hook) {
    ret = { ...ret, ...reducerObj };
  }
  return ret;
}

/**

@功能：内部函数，得到一个综合所有 onReducer 的 reducer
@return reducer, 函数类型

 * @param {*} hook
hook 的形状是 ReducerEnhancer[]。 也就是说每个 `onReducer` 型的插件都应该是一个 ReducerEnhancer。
ReducerEnhancer 是什么？：包裹一个老的 reducer，然后生成一个新的 reducer。

ReducerEnhancer 的一个例子：
File: /Users/xichen/projj/github.com/xc1427/dva/examples/with-redux-undo/src/index.js
8: const app = dva({
9:   onReducer: reducer => (state, action) => {
                ~~~~~~~~~~~~~~~ 从这里开始就是 ReducerEnhancer
10:     const newState = undoable(reducer, {})(state, action);
11:     return { ...newState };
12:   },
13: });

@内部原理：
所有的 ReducerEnhancer 一层一层包裹，类似于洋葱模型。
 */
function getOnReducer(hook) {
  return function(reducer) {
    for (const reducerEnhancer of hook) {
      reducer = reducerEnhancer(reducer);
    }
    return reducer;
  };
}
