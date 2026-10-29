import 'antd/dist/reset.css'
import './src/app.scss'
import {App,Button,ConfigProvider,theme} from 'antd'
import zhCN from 'antd/locale/zh_CN'
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import WorkspaceTabs from './src/pages/workspace/components/workspaceTabs'
import ResultTabs from './src/pages/workspace/components/resultTabs'
import type {WorkspaceTab} from './src/typings/workspace'
const params=new URLSearchParams(location.search)
const titles=['qianguanguan · 结构','查询 1','mysql · 结构','这是一个特别长的数据库和表名称用于验证省略效果 · 数据','查询 5','查询 6','查询 7','末尾查询 8']
const initial:WorkspaceTab[]=titles.slice(0,Number(params.get('count')||8)).map((title,i)=>({id:String(i),title,kind:i%2?'query':'structure',connectionId:'fixture',database:'fixture',table:'',sql:'',resultStatus:'success'}))
const result={columns:[{name:'id',type:'int'}],rows:[['1']],rowCount:1,affectedRows:0,durationMs:1,isQuery:true,truncated:false,lastInsertId:''}
function Fixture(){
 const [tabs,setTabs]=useState(initial),[activeTab,setActive]=useState('0'),[busy,setBusy]=useState(false)
 const closeTab=(id:string)=>{setTabs(t=>t.filter(p=>p.id!==id));if(id===activeTab)setActive(tabs.find(t=>t.id!==id)?.id||'')}
 return <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'var(--surface)'}}><div style={{padding:8}}><Button onClick={()=>setBusy(v=>!v)}>切换运行状态</Button></div><WorkspaceTabs model={{tabs,activeTab,connections:[],designerDirty:{},runs:{},resultViews:{},tabBusy:busy,runningTabId:busy?'0':'',selectTab:setActive,closeTab,closeTabs:(id)=>closeTab(id)}} renderDesigner={()=>null}><div><div style={{padding:16}}>当前标签：{tabs.find(t=>t.id===activeTab)?.title}</div><ResultTabs run={{id:'fixture',source:'SELECT 1',result}} running={false} activeKey="0" onChange={()=>{}} /></div></WorkspaceTabs></div>
}
createRoot(document.getElementById('root')!).render(<ConfigProvider locale={zhCN} theme={{algorithm:params.get('theme')==='light'?theme.defaultAlgorithm:theme.darkAlgorithm,cssVar:{key:'sql-studio-theme'}}}><App><Fixture/></App></ConfigProvider>)
