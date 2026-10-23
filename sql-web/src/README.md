# 前端源码

- [页面](pages/README.md)：工作区与页面私有组件/hooks。
- [公共 hooks](hooks/README.md)：主题。
- [配置](constant/README.md)、[契约](typings/README.md)、[服务](services/README.md)、[工具](utils/README.md)。
- [品牌资产](assets/databases/README.md)。

App.tsx/main.tsx 为框架入口；其余实际模块使用独立目录和 README。全局与页面样式使用 SCSS，颜色引用 Ant Design 原生 token，不手写主题主色；入口加载 antd/dist/reset.css 和 app.scss。SQL 编辑器继承页面系统字体，不指定新字体/字号。信息 Tag 使用蓝色 solid，Button 保留组件默认样式；表操作位于对象树右键菜单，底部展示多个结果。

全部原生组件覆盖集中在 app.scss；App 不覆盖 placeholder、文字和图标原色。顶栏通过 useSQLImport 导入本地 SQL 文件，结果页签为下划线 Tabs。
