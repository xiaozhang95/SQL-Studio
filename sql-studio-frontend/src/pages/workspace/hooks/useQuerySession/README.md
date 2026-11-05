# 查询页面会话状态

useQuerySession() 拥有 tabs/activeTab/runs/resultViews/editorLayouts、运行页 ID、请求 ref、关闭页集合和短暂草稿保护。返回相应受控状态/setter、publishResult/replaceTableResult/startRun/finishRun/cancelQuery。每批开始固定发起页并创建 AbortController；结束只释放同一 controller 的锁，关闭页的迟到结果被忽略。对象数据保存仅替换对应 data 页结果。非活动草稿、结果的释放及恢复由工作区持久化组合调用 setter；恢复状态不自动执行 SQL。编辑器生命周期仍由 useWorkspaceEditor 管理。卸载取消本 hook 拥有的请求，隐藏工作台保持会话。
