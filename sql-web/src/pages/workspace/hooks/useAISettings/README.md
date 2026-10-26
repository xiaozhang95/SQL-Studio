# AI 配置状态

useAISettings() 管理 open/ready/loading/saving/error/configured、provider/model/apiKey/completionEnabled、模型列表和模型请求状态；公开 show/close/save/changeKey/refreshModels。每次打开读取 /api/state/ai，再通过适配器加载官方模型。模型请求单独 AbortController，关闭或换 Key 时取消，并通过弹窗代次丢弃迟到结果。Key 仅存在本次输入，不进入工作区或浏览器存储。

保存要求当前模型来自本次已成功加载列表；revision 防止多窗口覆盖。空 Key 保留旧值。保存成功广播 ai-settings-saved，失败保留表单；模型获取失败可点击获取模型重试。无全局模型缓存；Key输入停顿500ms后自动获取模型，换Key、关闭和移除均取消防抖及旧请求。清空新输入且原Key仍存在时重新加载已保存Key的模型。

remove()通过DELETE /api/ai/config及当前revision清除配置；removing/busy管理互斥状态。成功清空表单并广播配置更新，优化入口和续写同步停用；失败保留弹窗和错误。

移除后重新输入Key会自动发现模型并选择默认可用项，成功后允许保存；空列表使用请选择模型占位，不展示未经发现的裸模型ID。
