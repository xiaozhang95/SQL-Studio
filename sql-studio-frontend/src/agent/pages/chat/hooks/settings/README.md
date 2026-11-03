# useAISettings

管理模型配置读取、Modal开关、受控Form、保存/清除、busy/error/notice。初始化GET可取消；show将Key清空并填充已保存模型，close/save成功重置敏感输入。已有配置留空保留Key，clear使聊天回到待配置状态。保存反馈只表示本机持久化成功，不进行付费模型测试。无浏览器持久化。

模型选项来自status.models，用户可选DeepSeek Flash/Pro；底部chooseModel使用空Key提交已有模型配置，保留已存Key，成功后更新选中项；清除Key后保留模型选择。
