# 键详情编辑草稿

`useKeyEditor(key,detail,ttlMillis,onSave,clearError)` 在详情编辑器挂载时读取键名、完整值及初始 TTL，返回 name/value/ttl、remainingSeconds、maximumTTL、ttlInvalid、dirty、changeName/changeValue/changeTTL、cancel、异步 save，以及 copy、copyError、copiedName/copiedValue。ttlMillis 是父级最新读取的剩余毫秒数，仅用于右侧实时剩余秒数，不改动输入框。父级重新读取或切换键时卸载编辑器，草稿随之重置；输入不写入数据库，也不持久化。

TTL 输入框保持本次详情载入的初值或用户草稿，不随倒计时减少；负值初始显示为 0（永久有效）。remainingSeconds 从父级每秒读取的 TTL 换算，负值表示永久有效，与输入是否修改无关。后台更新不覆盖输入或改变 dirty 状态，hook 不创建额外时钟或过期日期预览。接受 0–315360000 的整数秒，空值或越界时禁用保存。取消清除 TTL 草稿并恢复载入时的输入，右侧仍显示服务器当前剩余时间。

仅修改 TTL 时提交 ttl；仅修改键名时提交 rename，修改值时提交 value、实际 valueType、原始 before 及可选新键名。rename/value 可一并携带用户明确编辑过的 TTL，未编辑时省略以保留当前期限。不能编辑的值仍可单独改名或设置 TTL。取消恢复当前读取值；保存请求、互斥、错误及结果刷新由父级 KeyBrowser 管理，失败保留草稿。不另弹编辑框或确认框。

copy('name'|'value') 将点击时的当前草稿写入本机剪贴板，不请求 Redis、不触发保存。成功反馈持续 2 秒，复制内容与当前输入不一致时不显示成功图标；重复复制重置反馈计时，卸载清理计时器。失败返回可翻译的 copyError，由详情统一展示。编辑名称或值、重新复制及取消时清理复制错误。
