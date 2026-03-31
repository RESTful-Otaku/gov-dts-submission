/** Sets checkbox indeterminate state (DOM property, not attribute). */
export function setIndeterminate(node: HTMLInputElement, value: boolean) {
  node.indeterminate = value
  return {
    update(value: boolean) {
      node.indeterminate = value
    },
  }
}
