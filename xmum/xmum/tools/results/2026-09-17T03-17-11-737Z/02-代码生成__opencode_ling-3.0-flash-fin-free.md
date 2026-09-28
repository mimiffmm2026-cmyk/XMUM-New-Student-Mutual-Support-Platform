```javascript
function groupBy(array, keyFn) {
  return array.reduce((groups, item) => {
    if (item === null || item === undefined) return groups;
    const key = keyFn(item);
    const groupKey = String(key);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {});
}
```

**说明：** 使用 `reduce` 遍历数组，跳过 `null`/`undefined` 项，通过 `keyFn` 计算分组键（统一转为字符串作为对象属性），将同键元素归入同一数组。键名统一为字符串以避免数字键的隐式转换问题。