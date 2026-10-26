import { acceptCompletion, completionStatus } from '@codemirror/autocomplete'
import { Prec, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'

type Suggestion = { at: number; text: string }
type Options = { complete: (prefix: string, suffix: string, document: string, signal: AbortSignal) => Promise<string>; loading: (value: boolean) => void }
class Ghost extends WidgetType {
  readonly text: string
  constructor(text: string) {
    super()
    this.text = text
  }
  eq(other: Ghost) {
    return this.text === other.text
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'ai-ghost'
    span.textContent = this.text
    span.setAttribute('aria-hidden', 'true')
    return span
  }
}
/** 装饰从未进入文档；只有 Tab 的事务才把建议写入撤销历史。 */
export function aiCompletion(options: Options) {
  const show = StateEffect.define<Suggestion | null>()
  const suggestion = StateField.define<Suggestion | null>({
    create: () => null,
    update(value, tr) {
      if (tr.docChanged || (tr.selection && !tr.startState.selection.eq(tr.state.selection))) value = null
      for (const effect of tr.effects) if (effect.is(show)) value = effect.value
      return value
    },
    provide: (field) =>
      EditorView.decorations.from(field, (value): DecorationSet => (value ? Decoration.set([Decoration.widget({ widget: new Ghost(value.text), side: 1 }).range(value.at)]) : Decoration.none))
  })
  const plugin = ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | undefined
      controller: AbortController | undefined
      version = 0
      readonly view: EditorView
      constructor(view: EditorView) {
        this.view = view
      }
      cancel() {
        this.version++
        clearTimeout(this.timer)
        this.controller?.abort()
        options.loading(false)
      }
      update(update: ViewUpdate) {
        if (update.docChanged || (update.selectionSet && !update.startState.selection.eq(update.state.selection)) || update.focusChanged) {
          this.cancel()
          if (!update.view.hasFocus) return
          // 仅真实输入触发；选区移动不主动调用模型。
          if (update.docChanged && update.transactions.some((tr) => tr.isUserEvent('input') && !tr.isUserEvent('input.ai'))) this.schedule()
        }
      }
      schedule() {
        this.cancel()
        const version = this.version
        this.timer = setTimeout(() => void this.run(version), 650)
      }
      async run(version: number) {
        const { state } = this.view
        const selection = state.selection.main
        if (!selection.empty || !this.view.hasFocus || state.selection.ranges.length !== 1) return
        const at = selection.head
        const prefix = state.sliceDoc(Math.max(0, at - 10000), at)
        if (!prefix.trim()) return
        const controller = new AbortController()
        this.controller = controller
        options.loading(true)
        try {
          const text = await options.complete(prefix, state.sliceDoc(at, Math.min(state.doc.length, at + 4000)), state.sliceDoc(0, Math.min(state.doc.length, 16000)), controller.signal)
          if (version !== this.version || controller.signal.aborted || this.view.state.doc !== state.doc || this.view.state.selection.main.head !== at) return
          this.view.dispatch({ effects: show.of(text ? { at, text } : null) })
        } catch {
          // 无结果或请求失败均保持安静，编辑和本地补全仍可使用。
        } finally {
          if (version === this.version && !controller.signal.aborted) options.loading(false)
        }
      }
      destroy() {
        this.cancel()
      }
    }
  )
  const dismiss = (view: EditorView) => {
    view.plugin(plugin)?.cancel()
    const visible = !!view.state.field(suggestion)
    if (visible) view.dispatch({ effects: show.of(null) })
    options.loading(false)
    return visible
  }
  return [
    suggestion,
    plugin,
    Prec.highest(
      keymap.of([
        {
          key: 'Tab',
          run: (view) => {
            if (completionStatus(view.state) === 'active') {
              dismiss(view)
              return acceptCompletion(view)
            }
            const current = view.state.field(suggestion)
            if (!current) return false
            view.plugin(plugin)?.cancel()
            view.dispatch({ changes: { from: current.at, insert: current.text }, selection: { anchor: current.at + current.text.length }, userEvent: 'input.ai' })
            return true
          }
        },
        { key: 'Escape', run: dismiss },
        {
          key: 'Alt-\\',
          run: (view) => {
            view.plugin(plugin)?.schedule()
            return true
          }
        }
      ])
    ),
    EditorView.domEventHandlers({
      blur: (_event, view) => {
        dismiss(view)
      }
    })
  ]
}
