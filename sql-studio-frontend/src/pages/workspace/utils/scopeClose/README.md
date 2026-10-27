# 按连接范围关闭页面

`pagesForScope(pages, connectionId, database?)` 精确选择目标连接的所有页面；指定库名时仅匹配该库，同名库不会跨连接。`sqlForPages(pages)` 返回查询页非空 SQL，单页保持原文，多页附页面/库说明合并为一个文件；不包含结果或密码，不修改输入。由 useWorkspace 展示保存/放弃/取消并等待后端关闭，再清理这些页面。
