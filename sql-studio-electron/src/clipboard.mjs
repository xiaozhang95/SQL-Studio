/** Write plain text only for an authorized workbench request; failures stay silent. */
export function createClipboardWriter(writeText, isAllowed) {
  return (event, text) => {
    if (!isAllowed(event) || typeof text !== 'string') return false
    try {
      writeText(text)
      return true
    } catch {
      return false
    }
  }
}
