```javascript
function groupBy(array, keyFn) {
  return array.reduce((result, item) => {
    if (item == null) return result;
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
    return result;
  }, {});
}
```

**说明：**
- 使用 `Array.prototype.reduce` 将数组归约为按 key 分组的对象
- `item == null` 同时过滤 `null` 和 `undefined`
- `keyFn` 的返回值（字符串或数字）作为分组 key
- 对应 key 的值是一个数组，存放该组的所有元素