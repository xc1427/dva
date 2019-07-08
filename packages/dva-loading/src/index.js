const SHOW = '@@DVA_LOADING/SHOW';
const HIDE = '@@DVA_LOADING/HIDE';
const NAMESPACE = 'loading';

function createLoading(opts = {}) {
  const namespace = opts.namespace || NAMESPACE;

  const { only = [], except = [] } = opts;
  if (only.length > 0 && except.length > 0) {
    throw Error('It is ambiguous to configurate `only` and `except` items at the same time.');
  }

  const initialState = {
    global: false,
    models: {},
    effects: {},
  };

  const extraReducers = {
    [namespace](state = initialState, { type, payload }) {
      const { namespace, actionType } = payload || {};
      let ret;
      switch (type) {
        case SHOW:
          ret = {
            ...state,
            global: true,
            models: { ...state.models, [namespace]: true },
            effects: { ...state.effects, [actionType]: true },
          };
          break;
        case HIDE: {
          const effects = { ...state.effects, [actionType]: false };
          const models = {
            ...state.models,

            // 相当于先从 effects loading 状态中过滤出来和本 namespace 相关的
            // 然后再看，如果此 namespace 下至少有一个是 effects loading 是 true，
            // 的 namespace 的 loading 就是 true。
            [namespace]: Object.keys(effects).some(actionType => {
              const _namespace = actionType.split('/')[0];
              if (_namespace !== namespace) return false;
              return effects[actionType];
            }),
          };

          // 只要有一个 model 是 loading 状态，那么 global 就是 loading 状态
          const global = Object.keys(models).some(namespace => {
            return models[namespace];
          });
          ret = {
            ...state,
            global,
            models,
            effects,
          };
          break;
        }
        default:
          ret = state;
          break;
      }
      return ret;
    },
  };

  /**
   *
   * @param {*} effect - sagaWithCatch，可以简单认为是对应业务代码在 model 中定义的 effect

   File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/getSaga.js
62:   function* sagaWithCatch(...args) {


   * @param {*} sageEffectCommand - 就是标准的 put， call 这些，没有经过 dva 处理
   * @param {*} model - 就是标准的 model，没有经过任何的处理
   * @param {*} actionType - 就是每个 effect 对应的 key


   * @call_site
File: /Users/xichen/projj/github.com/xc1427/dva/packages/dva-core/src/getSaga.js
180: function applyOnEffect(fns, effect, model, key) {
181:   for (const fn of fns) {
182:     effect = fn(effect, sagaEffects, model, key);
183:   }
184:   return effect;
185: }

   * @returns - 返回一个和入参 effect 相同 signature 的函数

   */
  function onEffect(effect, { put }, model, actionType) {
    const { namespace } = model;
    if (
      (only.length === 0 && except.length === 0) ||
      (only.length > 0 && only.indexOf(actionType) !== -1) ||
      (except.length > 0 && except.indexOf(actionType) === -1)
    ) {
      return function*(...args) {
        yield put({ type: SHOW, payload: { namespace, actionType } });
        yield effect(...args);
        yield put({ type: HIDE, payload: { namespace, actionType } });
      };
    } else {
      return effect;
    }
  }

  return {
    extraReducers,
    onEffect,
  };
}

export default createLoading;
