# 导航锁

[源码](index.tsx)

在同步执行、AI 历史切换等不可中断的操作期间，阻止左侧 Rail 切换页面。页面卸载或忙碌状态结束时自动释放。

## 导出

- `NavigationLockProvider`：维护当前锁定状态，包裹应用主体。
- `useNavigationLock()`：返回 `{ locked, setLocked }`。
- `useNavigationLockEffect(locked)`：把页面的忙碌布尔值映射到全局锁，卸载时清理。

## 边界

组件不负责提示或阻止浏览器前进后退，只用于全局导航按钮的禁用；工作区自身执行查询不锁定页面切换。