import { indentLess, insertTab } from '@codemirror/commands'
import { keymap } from '@codemirror/view'

export const editorTabKeymap = keymap.of([{ key: 'Tab', run: (view) => !view.state.readOnly && insertTab(view), shift: indentLess }])
