import defaultHandleActions from './handleActions';

export default function getReducer(reducers, state, handleActions, namespace) {
  console.log('debug cxi', 'namespace', namespace);
  // Support reducer enhancer
  // e.g. reducers: [realReducers, enhancer]
  if (Array.isArray(reducers)) {
    return reducers[1]((handleActions || defaultHandleActions)(reducers[0], state));
  } else {
    const ret = (handleActions || defaultHandleActions)(reducers || {}, state, namespace);
    console.log('debug cxi', '(handleActions || defaultHandleActions)(reducers || {}, state)', ret);
    return ret;
  }
}
