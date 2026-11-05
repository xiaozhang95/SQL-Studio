# 菜单连接状态

useConnectionStatus(open:boolean) 返回 status 和 check()。status 为 checking、unconfigured、connected 或 failed。调用方在菜单展开时调用 check()，首次检查读取本机配置，已配置时再通过模型列表接口验证连通性。已连接和未配置结果复用 60 秒，失败结果复用 10 秒。过期后在下次展开时刷新。

缓存和在途请求仅属于当前菜单实例。关闭菜单允许在途检查完成，快速重开复用同一请求。ai-settings-saved 会取消旧检查并使缓存失效，菜单打开时立即刷新，关闭时等下次展开。卸载取消请求并释放订阅。状态只存在内存，不保存 Key 或模型列表。
