# Agent侧栏

useAgentSidebar()组合useSidebarResize与useSidebarWidth，共用工作台连接栏的宽度偏好。默认272px、范围200–560px、主区至少520px；拖动结束/键盘调整更新两页共享宽度，双击恢复相同默认值。宽度通过始终挂载的工作台布局索引保存并在刷新时恢复，不写入Agent独立布局；窄屏仍用Drawer。
