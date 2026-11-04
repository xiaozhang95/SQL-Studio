# SidebarWidthProvider

SidebarWidthProvider({children:ReactNode})由App包裹工作台与Agent，提供useSidebarWidth共用状态。默认272px，setter校验有效数值并限制到200–560px；restoreWidth恢复工作台已有宽度，迟到恢复不覆盖用户已调整的新值。状态与回调绑定Provider生命周期，无模块级可变宽度。

现有工作台始终挂载，负责通过轻量布局索引保存和恢复共享width。Provider不请求API、不另建存储；窗口测量只影响各页visibleWidth，不修改偏好。卸载释放内存；异步保存保证与错误展示沿用工作台原有机制。详见[共享宽度hook](../../hooks/useSidebarWidth/README.md)。
