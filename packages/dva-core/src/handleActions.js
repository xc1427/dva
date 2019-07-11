import invariant from 'invariant';

function identify(value) {
  return value;
}

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

function reduceReducers(...reducers) {
  return (previous, current) => reducers.reduce((p, r) => r(p, current), previous);
}

function handleActions(handlers, defaultState, namespace) {
  console.log('debug cxi', 'handleActions::handlers', handlers);
  const morehandler = {
    [`${namespace}/setState`]: (state = defaultState, action) => {
      const { payload } = action;
      return { ...state, ...payload };
    },
    ...handlers,
  };
  const reducers = Object.keys(morehandler).map(type => handleAction(type, morehandler[type]));
  console.log('debug cxi', 'handleActions::morehandler', morehandler);
  const reducer = reduceReducers(...reducers);
  console.log('debug cxi', 'handleActions::reducer', reducer);
  return (state = defaultState, action) => reducer(state, action);
}

export default handleActions;
