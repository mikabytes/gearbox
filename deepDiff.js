export default function deepDiff(obj1, obj2) {
  if (obj1 === obj2) {
  }

  const diff = {}
  const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])
  for (const key of keys) {
    const val1 = obj1[key]
    const val2 = obj2[key]
    if (val1 !== val2) {
      diff[key] = val2
    }
  }
  return diff
}
