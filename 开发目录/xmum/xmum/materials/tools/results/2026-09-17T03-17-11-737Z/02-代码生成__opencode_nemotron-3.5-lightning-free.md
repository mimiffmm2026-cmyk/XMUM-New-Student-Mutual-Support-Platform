功能已实现。`groupBy(array, keyFn)` 函数：

- **遍历数组**，使用 `item == null` 检测并跳过 `null`/`undefined`
- 调用 `keyFn(item)` 获取分组键（支持返回字符串或数字）
- 将元素按键推入对应数组，未见键则先创建空数组
- 返回分组后的对象

```js
// 使用示例
const users = [
  {name: 'Alice', age: 25},
  {name: 'Bob', age: 30},
  {name: 'Charlie', age: 25},
  null,      // 被忽略
  undefined  // 被忽略
];

groupBy(users, u => u.age);
// { '25': [{name:'Alice', age:25}, {name:'Charlie', age:25}],
//   '30': [{name:'Bob', age:30}] }
```