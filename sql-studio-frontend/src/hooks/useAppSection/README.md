# 功能入口

useAppSection通过URL hash管理SQL工作区/Agent切换，支持浏览器前后导航及直接访问#agent；不改变SQL标签布局。工作区保持挂载以保留未保存草稿，Agent离开取消流并flush布局。无额外路由或持久化依赖。
