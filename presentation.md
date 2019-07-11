
## 痛点

### 繁琐
做一个 api 调用，要写 service, effect, reducer, connect, dispatch(action)

### guard
类型保护：
 - model，action，connect，dispatch
 - rsp ??? = yield call();

- yield 忘记写

### 编程模型
- 编程模型不完备 effects
- 场景太少
- 文档还是没有一阵见血

```js
*someEffect({ payload }, { call }) {
  const rsp = yield call(blablaService.query, `/api/servicepath`);
  payload.onSuccess(rsp);
}

// ..

dispatch({
  type: 'toto/someEffect',
  payload: {
    onSucess: (data) => this.setState({ data });
  }
 });

```

## 解法
繁琐：
- hook，
- setState, getState，
- 自动 effect 生成 ??

==> 可以做到简单，又不失强大

类型保护
- actionCreator, TS 3.5 +, 
- TS 3.6（Generator），
- 监听并自动生成 __DvaModelState
- yield 忘记写：linter

编程模型：
- 处理 watcher + action 概念明确 => 四种场景
- saga 1.x 内置更多便利的 effect：debounce, delay, takeLeading， retry，etc
- 可以再加上 polling
- 文档优化，丰富场景


> 总结下来，有四种信号监听，可以呈现一个完备的 "功能故事"：1. 用户预设的监听，监听到后同步更新 state（reducer），2. 用户预设的监听，监听到后可以借助 commands 进行监听后的异步编排（effect）；3. 用户自定义的监听，需要自己实现 "循环"，监听到后异步编排（watcher）。4. 用户自定义的监听，对于 「外部事件」的监听（subscription）。


## 为什么需要 action
- 提供清晰的思维模型 provides a good mental model。[ref](https://mp.weixin.qq.com/s/qWrSyzJ54YEw8sLCxAEKlA) 。本身在 redux 体系下，action 就是一个很重要的概念。目前只是在 dispatch 和 put 的时候展现，会让整个思维模型不清晰。一个体现就是 effects 一直没有解释清楚的概念，反映在业务里，很多项目代码里就把它当做函数调用，造成了很多奇葩的用法。既然无法对于开发者屏蔽，就应该明确展现。一个 model 对外提供的 API。
- 类型保护的需要。有了 actionCreator，可以完美解决 action 的类型问题，连同解决了 namespace 的问题。本质上说，actionCreator 是一种复杂的 enum。

## 是否考虑换成其他的数据流
非 redux 的应该无法兼容。
some advice ref: https://cdn.nlark.com/yuque/0/2019/png/115084/1561892750249-fbe34433-310f-4cc2-9592-40b8411e7192.png