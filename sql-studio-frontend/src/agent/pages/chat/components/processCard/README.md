# ProcessCard

受控title/expanded/onExpand/children/icon；icon默认蓝鲸，执行过程传入CodeOutlined，两者宽高取fontSize token（默认14px）。Think保留标题折叠，展开内容放入Ant Design默认small Card，思考正文与执行步骤均有独立卡片边框和内边距；标题位于卡片外，无正文装饰线或隐藏按钮。卡片与最终回答共享左边线；标题与卡片间距为marginXS（8px），自身不添加纵向padding，外部区块间距由TurnContent统一控制。折叠时卸载卡片及内容，无请求与持久化副作用。
