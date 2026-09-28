function groupBy(array, keyFn) {
  const result = {};
  for (const item of array) {
    if (item == null) continue;
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

module.exports = groupBy;