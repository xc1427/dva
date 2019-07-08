import { NAMESPACE_SEP } from './constants';

export default function createPromiseMiddleware(app) {
  return () => next => action => {
    const { type } = action;
    if (isEffect(type)) {
      return new Promise((resolve, reject) => {
        // 这里 next 的效果就是，当 sagaMiddleware 接收到 action 时，已经是加入了 __dva_resolve 和 __dva_reject 属性的 action。

        /** saga 中间件源码
    return function (next) {
      return function (action) {
              ~~~~~~~~~~~~~~~~~~~ 也就是说这个位置
        if (sagaMonitor && sagaMonitor.actionDispatched) {
          sagaMonitor.actionDispatched(action);
        }
        var result = next(action); // hit reducers
        sagaEmitter.emit(action);
        return result;
      };
    };
         */
        // 实际上要求 middleware 列表中必须把 sagaMiddleware 放置在 promiseMiddleware 的前面。
        // 同时我实验了在 dev_tools 是无法看到 __dva_resolve, __dva_reject 两个属性的，究其原因，应该是 devtool-extension 会在一开始 dispatch 的时候就复制了一份 action 录入。
        next({
          __dva_resolve: resolve,
          __dva_reject: reject,
          ...action,
        });
      });
    } else {
      return next(action);
    }
  };

  function isEffect(type) {
    if (!type || typeof type !== 'string') return false;
    const [namespace] = type.split(NAMESPACE_SEP);
    const model = app._models.filter(m => m.namespace === namespace)[0];
    if (model) {
      if (model.effects && model.effects[type]) {
        return true;
      }
    }

    return false;
  }
}
