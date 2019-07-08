import { NAMESPACE_SEP } from './constants';

/**
 * 通过这个函数，可想而知，如果已经做了 prefix，那么就直接返回 type 了，因为在 if 处判空
 * @param model - prefixNSed model
 */
export default function prefixType(type, model) {
  const prefixedType = `${model.namespace}${NAMESPACE_SEP}${type}`;

  // 把 /@@www 这样的给去掉
  const typeWithoutAffix = prefixedType.replace(/\/@@[^/]+?$/, '');
  if (
    (model.reducers && model.reducers[typeWithoutAffix]) ||
    (model.effects && model.effects[typeWithoutAffix])
  ) {
    return prefixedType;
  }
  return type;
}
