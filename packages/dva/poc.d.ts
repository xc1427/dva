import { SagaIterator, Saga } from 'redux-saga';
import { take, put, all, race,  call, cps, fork, join, cancel, select,
  actionChannel, cancelled, flush, getContext, setContext, takeMaybe, apply, putResolve, spawn, retry, delay, PutEffect,   } from 'redux-saga/effects';
import { ActionCreator } from 'typescript-fsa';

type Commands<T_ModelState> = {
  take: typeof take,
  put: typeof put,
  all: typeof all,
  race: typeof race,
  call: typeof call,
  cps: typeof cps,
  fork: typeof fork,
  join: typeof join,
  cancel: typeof cancel,
  select: typeof select,
  actionChannel: typeof actionChannel,
  cancelled: typeof cancelled,
  flush: typeof flush,
  getContext: typeof getContext,
  setContext: typeof setContext,
  takeMaybe: typeof takeMaybe,
  apply: typeof apply,
  putResolve: typeof putResolve,
  spawn: typeof spawn,
  retry: typeof retry,
  delay: typeof delay,
  setState: (partialState: Partial<T_ModelState>) => PutEffect<{ type: string }>
}
// export type Saga<Args extends any[] = any[]> = (...args: Args) => SagaIterator;

/**
 * takeLeading
 * takeEvery
 * takeLatest
 * throttle
 * debounce
 */

type DvaSaga<T_FirstArg, T_ModelState> = Saga<[T_FirstArg, Commands<T_ModelState>]>;
type TakeLatest<T_FirstArg, T_ModelState> = [Saga<[T_FirstArg, Commands<T_ModelState>]>, { type: 'takeLatest' }];
type TakeEvery<T_FirstArg, T_ModelState> = [Saga<[T_FirstArg, Commands<T_ModelState>]>, { type: 'takeEvery' }];
type Throttle<T_FirstArg, T_ModelState> = [Saga<[T_FirstArg, Commands<T_ModelState>]>, { type: 'throttle', ms: number }];
type Debounce<T_FirstArg, T_ModelState> = [Saga<[T_FirstArg, Commands<T_ModelState>]>, { type: 'debounce', ms: number }];

type ActionCreatorMap = {[k:string]:ActionCreator<any>};

type DvaEffects<T_ModelState, T_EffectActionCreatorMap extends ActionCreatorMap> = {
  [K in keyof T_EffectActionCreatorMap]:
  | DvaSaga<ReturnType<T_EffectActionCreatorMap[K]>, T_ModelState>
  | TakeLatest<ReturnType<T_EffectActionCreatorMap[K]>, T_ModelState>
  | TakeEvery<ReturnType<T_EffectActionCreatorMap[K]>, T_ModelState>
  | Throttle<ReturnType<T_EffectActionCreatorMap[K]>, T_ModelState>
  | Debounce<ReturnType<T_EffectActionCreatorMap[K]>, T_ModelState>;
};

type DvaReducers<T_ModelState, T_ReducerActionCreatorMap extends ActionCreatorMap> = {
  [K in keyof T_ReducerActionCreatorMap]: (state: T_ModelState, action: ReturnType<T_ReducerActionCreatorMap[K]>) => T_ModelState;
};

type DvaModel<T_Namespace, T_ModelState, T_ReducerActionCreatorMap extends ActionCreatorMap, T_EffectActionCreatorMap extends ActionCreatorMap> = {
  namespace: T_Namespace;
  state: T_ModelState;
  reducers?: DvaReducers<T_ModelState, T_ReducerActionCreatorMap>;
  effects?: DvaEffects<T_ModelState, T_EffectActionCreatorMap>;
  subscription?: any;
};

export type DvaModelStateSlice<T_DvaModel extends DvaModel<string, any, ActionCreatorMap, ActionCreatorMap>> = {
  [P in T_DvaModel['namespace']]: T_DvaModel['state'];
};