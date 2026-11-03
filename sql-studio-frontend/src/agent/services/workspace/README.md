# 工作区API

workspace(GET/PUT,input?,signal?,keepalive?)读取或CAS保存Go本地布局；输入revision/state，返回校验后的Workspace。409明确提示多窗口冲突，不静默重试覆盖。无localStorage/IndexedDB。keepalive仅用于离页尽力保存，不保证强制结束浏览器时完成。
