# 导航锁提供者

`NavigationLockProvider({ children })` 在 App 内提供当前导航锁状态，默认解锁。后代通过 [导航锁上下文](../../contexts/navigationLock/README.md) 读取状态并在关键操作期间注册锁定。提供者只管理本地状态，卸载后释放。
