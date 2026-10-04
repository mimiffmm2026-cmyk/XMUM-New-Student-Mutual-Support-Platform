```js
function groupBy(array, keyFn) {
  const result = Object.create(null);
  for (const item of array) {
    if (item == null) continue;
    const key = keyFn(item);
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}
```

用 `== null` 同时跳过 `null` 和 `undefined`；`Object.create(null)` 避免 `__proto__` 等键名污染原型链，键数字会被自动转成字符串。