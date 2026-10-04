```javascript
function groupBy(array, keyFn) {
  const result = {};
  for (const item of array) {
    if (item === null || item === undefined) continue;
    const key = keyFn(item);
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}
```

说明：遍历数组跳过 `null/undefined` 元素，用 `keyFn(item)` 计算分组键（字符串或数字会自动转为对象键），不存在则建空数组后推入。