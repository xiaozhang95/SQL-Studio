# 内容卡片

ContentCard(props: ContentCardProps) 统一工作区 SQL 预览与 Agent 内容卡片的 small 尺寸、主题外框、默认大圆角和满宽布局。继承 CardProps（不开放 size/styles），支持 title、extra、children、ARIA 属性及 style；style 最后合并。code 默认为 false，开启后通过 Card styles 清除正文内边距与标题下边距，并裁切圆角内代码内容。

无受控业务状态、回调副作用、请求或缓存。折叠、复制和代码渲染由调用方处理。表格 section 外框仍由 app.scss 管理。
