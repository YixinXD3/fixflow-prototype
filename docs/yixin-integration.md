# Yixin · 三方流程整合与交接

## 基线与改动边界

2026-10-29，展示仓库基线 `f423d81`（包含经理、顾客审批、共享保存及技师求助模块）。这份工作在 `YixinXD3/fixflow-prototype` 的最新代码上增量实现；没有用旧本地 dist 覆盖组员模块，也未修改课程团队仓库。

- Week10 / YX10A–B：维修详情新增内部结构化交接，覆盖已做测试、当前发现、下一步；仍复用 Help 及独立阻塞。
- Week11 / YX11A–B：交接保存作者、ISO 时间、维修单 ID 和独立记录 ID；追加历史，顾客页面不展示内部内容。
- Week13 / YX13A–C：统一入口、同维修单角色跳转、下一步提示、响应式展示框架、测试与版本记录。
- 真实参与者测试、Tianshu 互审和课堂签核尚未进行，不能以本次开发者检查代替。

## 代码职责

| 文件 | 本轮内容 |
| --- | --- |
| journey.js / journey.css | 展示流程导航、六阶段状态、下一位操作角色、手机折叠入口 |
| handover.js | 内部交接规则与输入表单；先保存成功再更新页面，失败保留输入 |
| customer.js | 小型 FixFlowJourney 导航接口，复用当前顾客记录映射及角色；完成后不再提示需要发布新阶段更新 |
| manager/workspace.js | 支持 #manager/维修ID，沿用原有未保存离开检查 |
| app.js | 收件日期使用维修单时间，旧示例无日期则明确显示未记录 |
| index.html | 在现有模块之后加载交接与流程导航，保留原加载顺序 |

求助、经理业务规则、顾客审批、供应商流程和共享存储源文件保持原样。

## 演示脚本（全程同一标签页）

1. 打开入口。桌面左侧是 Repair journey；手机从顶部 Open 展开。
2. New customer request → 输入设备和故障 → Select Technician → 默认经理安排 → Submit Repair Request。
3. Open Manager workspace → 选择技师（例如 Taylor）→ Save assignment。
4. Open Technician workspace 自动选择实际负责人并打开同一维修单。Start Repair → Add handover，填写测试、发现和下一步。记录只对内部可见。
5. 按需使用 Publish Customer Update 单独发布对顾客的说明，不将内部交接复制给顾客。
6. 切换 Manager → 填写原因、工作与费用 → Publish proposal。
7. Open Customer workspace → Approve / Decline / Need clarification。修订由经理处理，历史沿用组员模块。
8. 批准后回到 Technician → Continue Repair。批准不等于恢复或完成。
9. Repair Complete → Confirm Repair Complete，此时仍为 Awaiting Customer Confirmation。
10. Open Customer workspace → Confirm repair completion → Completed；刷新检查结果保留。

分支：技师 Help 创建求助，用原 Demo technician 切换接收人接受/回复，再切回发起人解决。缺件用 Shortage Material 提交，经理记录跟进与 Received；有多个阻塞时分别解除，最后由负责技师 Continue Repair。

## 本次实际验证

- 原有逻辑测试：58/58 通过。
- 新增交接测试：4 项；导航契约测试：5 项（运行结果见下方命令）。
- 本地浏览器完整走通：新建 → Taylor 指派 → 开始 → 内部交接 → 经理方案 AUD 80 → 顾客批准 → 继续 → 待确认 → 顾客完成确认。
- 交接和 Completed 均在刷新后保留；顾客页面未显示交接内容。
- 390×844：document.documentElement.scrollWidth = 390，无横向页面溢出。
- 1440×960：检查桌面流程导航与顾客页面布局。浏览器错误日志为空。
- 待人工复核：经理未保存草稿点击角色切换触发原生确认后，自动化连接超时，未完成取消按钮浏览器验证；对应导航取消契约由自动逻辑测试检查。
- 未运行完整旧浏览器自动化套件；本次真实 UI 走查不代表所有分支均已经浏览器验证。

```sh
node --test tests/customer-actions.test.cjs tests/manager-integration.test.cjs tests/manager-followup.test.cjs tests/manager-supplier.test.cjs tests/tianshu-workflow.test.cjs tests/handover.test.cjs tests/journey.test.cjs
python3 -m http.server 5173 --bind 127.0.0.1
```

## 数据与限制

沿用 `fixflow-prototype-v1` 和现有顾客元数据；没有新建三套维修单。`jobs[].handovers[]` 保存 `{id,jobId,authorId,createdAt,tests,finding,next}`。接手技师从同一维修单读取历史，保存不改变状态、缺件、求助、审批或公开进度。

角色切换属于展示身份，不是真实权限系统；数据仅在同一浏览器标签页会话保存，不支持跨设备协同。没有后端、真实邮件、支付、采购或 AI。刷新可保留，关闭会话可能丢失。使用原有 Reset Demo Data 前先保留需要的数据。

## 交给团队的整合方式

将本轮差异应用到团队仓库 `apps/fixflow/public/` 对应位置，先与最新 main 比较后合并，不整目录覆盖。测试文件放团队既有测试目录并调整相对路径。以展示仓库提交 diff 为增量清单；此文档不表示课程主分支已经合并，也不代签组员 review。
