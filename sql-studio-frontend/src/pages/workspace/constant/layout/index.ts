/** 工作区尺寸只在此维护，状态恢复和拖动边界共用。 */
export const sidebarLayout = { defaultWidth: 272, minimumWidth: 200, maximumWidth: 560, minimumMainWidth: 520, keyboardStep: 24 } as const

export const resultPanelLayout = { defaultHeight: 260, minimumHeight: 260, editorReservedHeight: 280, keyboardStep: 24 } as const

export const resultSQLLayout = { columnWidth: 520 } as const
export const resultTableLayout = { indexWidth: 64, columnWidth: 200, selectionWidth: 32 } as const
export const resultTabLayout = { maximumVisibleTabs: 8 } as const
export const scopeCloseDialogLayout = { width: 560 } as const
export const objectTreeLayout = { rowHeight: 30, scrollSaveDelay: 150 } as const
