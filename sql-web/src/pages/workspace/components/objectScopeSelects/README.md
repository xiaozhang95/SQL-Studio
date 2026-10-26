# 对象范围选择器

ObjectScopeSelects({connection,database,table?,view?,connected?}) 复用EngineIcon与原生Select展示固定连接、库和对象；connected默认true（表设计页显式传入实际连接状态），view默认false。连接/库/表均为只读，防止草稿提交目标漂移；缺少库表不渲染对应选择器，长名称省略并保留title，窄布局换行。不发起请求或修改范围。

选项标签复用connection-option和connection-option-name，连接图标统一20px，避免32px默认图标撑高Select，长名称沿用查询页省略规则。
