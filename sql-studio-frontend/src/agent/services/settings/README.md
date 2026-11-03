# 模型配置服务

settings(method,input?,signal?)调用同源/api/settings/ai，GET读取脱敏状态、PUT保存、DELETE清除；返回Promise<AIStatus>。运行时核验字段，HTTP错误抛Error，支持AbortSignal。Key只在保存请求内提交，不写入浏览器存储或日志。

脱敏状态同时校验models(id/name)列表；保存可附选中的DeepSeek模型ID，与Key原子更新。支持目录由应用定义，不是账号额度探测。

observeSettings(onStatus,onError)订阅共享配置保存/移除事件、窗口回焦和页面重新可见，刷新脱敏GET状态；新请求取消前一请求，释放函数取消请求并移除监听。Key编辑弹窗复用公共AISettings。
