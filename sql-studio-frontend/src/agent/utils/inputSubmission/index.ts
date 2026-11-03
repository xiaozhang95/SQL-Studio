type InputKey = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'isComposing' | 'keyCode'>
export function shouldSendOnEnter(event: InputKey) {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229
}
