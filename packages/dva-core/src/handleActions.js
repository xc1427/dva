import invariant from 'invariant';

function identify(value) {
  return value;
}

/**
 * 生成一个只对某个 actionType 做出反应的 reducer，
 * 等效于 CanonicalReducer 的一个 switch 分支
 * @param {*} actionType - m.reducers 的 key
 * @param {*} reducer - ValueOf<ReducersMapObject> - m.reducers 上面一个个的 reducer，(prefixNamespaced)
 */
function handleAction(actionType, reducer = identify) {
  return (state, action) => {
    const { type } = action;
    invariant(type, 'dispatch: action should be a plain Object with type');
    if (actionType === type) {
      return reducer(state, action);
    }
    return state;
  };
}

/**
 *
 * @param  {...any} reducers - 这里 reducers 的语义是并不是 redux
 * 的那种 CanonicalReducer ， 而是一个预制对某个 actionType 有回应的 中间态 reducer，类型是 ReturnType<typeof handleAction>
 * , 需要转回 redux 的那种 CanonicalReducer, 所以命名上才说 *reduce*
 * @returns - CanonicalReducer
 * @tutorial - 此函数 reduceReducers 配合 上面的 handleAction，实现了一种效果 ：把 m.reducers 的形式转化为 CanonicalReducer
 */
function reduceReducers(...reducers) {
  /**
   * @description - 这个返回的函数就是一个 CanonicalReducer 类型
   * @param previous - 在最终 call site 处，previous 是 state
   * @param current - action
   */
  return (previous, current) => reducers.reduce((p, r) => r(p, current), previous);
}

/**
 *
 * @param {Object} handlers - ReducersMapObject. 就是用户定义的 m.reducers, 是经过 prefixNamespace 的
 * @param {Object} defaultState - dva model 定义上的 state
 * @returns - CanonicalReducer
 */
function handleActions(handlers, defaultState) {
  // 这下面的 type 就是 actionType, 就是 m.reducers 的 key
  const reducers = Object.keys(handlers).map(type => handleAction(type, handlers[type]));
  const reducer = reduceReducers(...reducers);
  return (state = defaultState, action) => reducer(state, action);
}

export default handleActions;
