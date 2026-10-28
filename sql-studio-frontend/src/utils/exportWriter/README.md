# 导出文件写入

createExportWriter(title) 在用户点击时选择 SQL 文件，返回 filename/destination/completion/write(sql)/close()/abort()。优先原生文件流；仅 close 完成后提交，abort 放弃本轮写入。不支持文件选择器时成功后触发浏览器下载，缓存上限 256 MiB，超限明确失败且不下载部分文件。名称替换非法字符，浏览器不提供完整路径时仅显示文件名，不伪造保存路径。

completion 区分原生文件保存成功和仅发起浏览器下载，不把下载触发当作已核验落盘。
