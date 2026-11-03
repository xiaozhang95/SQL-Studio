# SQL Studio 数据库 Agent

数据库Agent已合入现有前后端。按原方式构建sql-studio-frontend，后端从sql-studio-backend运行go run main.go，打开默认8080页面，点击顶部Agent。也可直接打开/#agent，返回按钮回到SQL工作台，原查询草稿保留。没有第二个服务或独立前端工程。

## 界面

实际使用@ant-design/x 2.5.0的Conversations、Bubble、Sender和Think；参考[官方项目](https://github.com/ant-design/x)与[Sender接口](https://ant-design-x.antgroup.com/components/sender)。左侧新建和本地历史支持确认删除；底部蓝鲸模型菜单提供配置API Key，使用现有SQL Studio的ai配置。只读标签、模型与发送在输入区底部。Enter发送，Shift+Enter换行，中文候选确认不提交。

思考与执行过程分别为可折叠、可隐藏的卡片；显示过程可恢复，隐藏不删除原始记录或查询结果。结果独立展示表格，保留重复列、精确数值文本、NULL、分页和SQL预览。亮暗/跟随系统复用SQL Studio全局主题。消息细滚动条、末尾跟随保留；上滚阅读不被新片段拉回。

## 后端和数据

- modules/agent：上下文、会话、工具白名单和流式编排，只依赖model/agent与消费接口。
- app：将同一个connections、metadata和query实例注入Agent，不在进程内绕行HTTP；SQL窗口与Agent共用4个查询并发槽位，Agent固定allowWrite=false、limit=100。
- deepseek/agent：官方思考SSE和工具调用传输。SQL续写/优化保留现有deepseek客户端，共用同一ai配置；没有第二份运行时Key配置。
- agentstate：StateDir/agent下保存conversations/index.json、id-revision.json及layout.json；恢复不调用模型/数据库。完整原文与送模上下文分离。

每轮180秒、最多10次主模型调用和16次工具操作。按1M窗口采用700000保守输入上界，较早完整轮次生成事实摘要，保留近期完整工具配对和reasoning_content；估算不是精确tokenizer。单工具HTTP时代的256KiB界限在进程适配器中保留，模型上下文单工具32KiB；超限明确提示。新SSE路由每10秒心跳，单独续期写截止时间，断开取消并完成最终检查点，普通HTTP超时不放宽。

接口位于/api/agent，见[API](API.md)。Agent布局与SQL工作区布局独立，但共用同一Go进程和全局外观。API Key只由后端读取，前端不回填、不写浏览器持久化；存储方式沿用SQL Studio的ai分区。

## 全新数据

独立sql-chat-agent目录及旧会话、布局、Key已删除，不做迁移、不读取旧目录，也不提供旧目录环境变量。新Agent在SQL Studio的StateDir/agent创建记录，Key与模型共用SQL Studio现有ai分区。

## 验证

自动检查与隔离浏览器验证记录见[Agent验证](AGENT_VERIFICATION.md)。真实DeepSeek账号和真实数据库联调单独报告，替身通过不代表真实服务通过。
