# ExportExcel

value/title受控，导出当前已获取表格及目录数据为xlsx。懒加载exceljs，无额外SQL或模型请求；原字符串保持字符串，公式样式文本不转换为公式，重复列名保持位置，NULL为空单元格。截断结果明确标记；busy防重复点击，错误局部展示。
