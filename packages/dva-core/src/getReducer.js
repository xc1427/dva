import defaultHandleActions from './handleActions';
/**
 * @param {*} reducers - ReducersMapObject. 用户定义的 reducers object
 * @param {*} state - 用户定义的 dva model 上的 state，也即 defaultState
 * @param {*} handleActions - plugin._handleActions
 */
export default function getReducer(reducers, state, handleActions) {
  // Support reducer enhancer
  // e.g. reducers: [realReducers, enhancer]
  if (Array.isArray(reducers)) {
    return reducers[1]((handleActions || defaultHandleActions)(reducers[0], state));
  } else {
    return (handleActions || defaultHandleActions)(reducers || {}, state);
  }
}
