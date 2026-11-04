# 数据库状态图标

[组件索引](../README.md) · [源码](index.tsx)

EngineIcon 读取 getDatabaseAdapter(type).profile，不直接绑定引擎资产。type?:DatabaseType 省略为 MySQL；variant?:icon|logo 默认为 icon；connected?:boolean 默认为 true；size?:number 默认 icon 32px、logo 40px。树与连接下拉传 20px，类型列表传 32px；组件没有回调。

MySQL、MariaDB 与 PostgreSQL 已连接时统一使用绿色圆角底板和白色图形。SVG 源文件保持不变，通过图片 filter 白色化；悬停和选中不改变底板与图形。connected=false 时保留圆角方形底板和白色图形，底板使用主题变量 --inactive-icon，与未打开数据库图标共用 text-tertiary 灰色；折叠不改变连接状态。数据库、schema、表和视图沿用原生语义图标。

text-tertiary 是半透明色，灰色底板及兼容品牌模式的灰色状态圆点通过同色渐变叠在 --surface 上，先合成当前主题下的灰色，防止选中行的蓝色背景透入。只调整自有图标底板，不覆盖 Ant Design 默认样式或改变字体。

仍兼容 profile.iconPresentation=brand 的原色展示与独立状态圆点，可选 iconBackground 提供固定衬底；当前三个引擎均不启用此模式。图标为装饰，名称由相邻文字提供，资源来源见 [资产说明](../../../../assets/databases/README.md)。
