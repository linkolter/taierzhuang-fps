# Player Feel Pass 实施与验收

实施完成日期：2026-09-14。依据 `UNITY_FPS_REFERENCE.md` 第 5 节及用户本轮具体实施要求，依次执行 P0 → P4。使用 ECC coding-standards 约束修改范围与可读性，沿用现有 Babylon.js / TypeScript 系统。

## 工作保护与实际文件

从 `performance-baseline-pass`（HEAD `dc25ccd`）创建 `player-feel-pass`。开始时工作区已有 GLB、ADS、地图美术、性能与 Battlefield 工作；保留全部已有修改，未 reset、覆盖检出或提交。

实施前副本及 176 个文件 SHA-256 清单位于 `G:/codex/.tools/player-feel-backup/`。最终比对记录为 `test-results/player-feel/changed-from-P0.json`。相对该副本，本轮只修改以下六个源码文件：

| 文件 | 实际修改 |
| --- | --- |
| `src/config/gameConfig.ts` | 独立 playerFeel 加减速与眼高时间参数 |
| `src/player/Player.ts` | XZ 速度及积分、碰撞反馈、视觉眼高、接地边沿、有效 ADS、生命周期清理 |
| `src/weapons/ViewmodelAnchors.ts` | 落地、换枪与 ADS 后坐倍率配置；锚点几何未改 |
| `src/weapons/Weapon.ts` | 连接接地反馈、空中 bob 衰减、ADS 许可、枪身后坐倍率、300ms 换枪 |
| `src/game/Game.ts` | 脚步使用 grounded；每渲染帧更新受击淡出 |
| `src/ui/HUD.ts` | 0.4s 受击淡出及换枪文字 |

新增 `tests/player-feel.test.ts`、`tests/player-feel-browser.mjs`、`tests/player-feel-matrix.mjs`。更新 `tests/input-and-tunnel.mjs`、`tests/hanyang-browser.mjs`、`tests/feedback-browser.mjs`，原因见测试章节。

原有 AI、调度、TacticalRouteGraph、Capture、Spawn/Respawn 规则、Combat、地图与碰撞源码、public 资源及 package 文件的实施前后哈希一致。Player 的 respawn 入口沿用原规则，只通过原 clearInput 入口清理新增状态。Unity 包未被导入或修改。

## 最终参数

| 项目 | 数值 |
| --- | --- |
| walk / sprint / crouch | 原值 4.2 / 6.5 / 2.2 m/s |
| acceleration / brake / reverse brake | 35 / 50 / 60 m/s² |
| jump / gravity | 原值 5.2 / 16 |
| 站姿 / 蹲姿眼高 | 原值 1.56 / 1.03m |
| 蹲下 / 起身视觉过渡 | 150 / 180ms，smoothstep |
| 落地枪身下沉 | 峰值 0.015m，120ms 正弦包络 |
| 相机 bob | 0，无新增相机摇晃 |
| ADS | 原值 210ms；FOV 0.9；原锚点 |
| ADS 枪身后坐平移 / 旋转倍率 | 0.65 / 0.55 |
| 相机 recoil | 原 ADS 0.034 / hip 0.05；hip pitch 原值保留 |
| 汉阳造 | 原容量 5、枪栓周期 1.5s、换弹 3.2s |
| 换枪 | 300ms；150ms 更换可见武器；下移峰值 0.28m |
| HUD 受击 | 原周期 0.4s，从 0.8 淡至 0；低血量底值 0.25 |

伤害、散布、近战周期、冲刺条件、碰撞尺寸、脚步材质算法均保留。

## P0：实施前基线

数据：`test-results/player-feel/P0/measurements.json`、`P0/sight.json`、`test-results/performance/player-feel-P0.json`。

相同序列使用实际 Player / Weapon：前进 1s 后松键 0.5s；重置后前进 0.5s、反向 0.5s、松键 0.5s；另外测试跳跃、蹲起、ADS、开火、装填和换枪。

| Hz | 首帧达到满速 / 停止 / 反向采样时间 | 松键停止距离 | 反向序列终点 X | 跳跃峰值 |
| --- | --- | --- | --- | --- |
| 30 | 33.33ms | 0m | -82m | 0.760000m |
| 60 | 16.67ms | 0m | -82m | 0.802222m |
| 120 | 8.33ms | 0m | -82m | 0.823333m |

原眼高在首次更新就由 1.56 切到 1.03m；换枪立即改变 slot。ADS 210ms 后 blend=1、FOV=0.9；射击扣至 4 发、cooldown=1.5；换弹 3.2s 后恢复 5 发。10 次 ADS 射击含装填的原瞄具回位测试通过，camera pitch 无累计变化。

原垂直积分本身存在帧率差异；本轮将每个 Hz 的原峰值作为对应基准，不改变重力积分。

## P1：地面加减速

复用 targetVelocity、currentVelocity 与位移向量；有界趋近目标速度。对达到目标前的加速段与剩余匀速段分别积分；反向时在速度对目标方向投影归零的精确时刻，从 60 切至 35m/s²。早期简单按帧切换造成约 0.056m 误差，已在推进 P2 前修复。

World.move 每次更新仍为最终位置真值；受阻轴由实际位移/dt 修正速度，无阻轴保留帧末速度。原空中即时控制保留。最高速度约束也在 ADS、蹲下等降速时生效。

| Hz | 满速位移采样时间 | 停止采样时间 | 反向采样时间 | 停止距离 | 反向终点 X |
| --- | --- | --- | --- | --- | --- |
| 30 | 166.67ms | 133.33ms | 100ms | 0.1764m | -81.7354m |
| 60 | 150ms | 116.67ms | 83.33ms | 0.1764m | -81.7354m |
| 120 | 133.33ms | 100ms | 75ms | 0.1764m | -81.7354m |

这里时间按测试的逐帧实际位移阈值判定，含采样量化；连续模型达到 4.2m/s 为 120ms，制动归零为 84ms。三个 Hz 的终点及停止距离误差约 2.8e-14m，满足 ≤0.05m。

实际 World 障碍撞墙测试、解除阻挡后的首步速度测试通过。全部 7 个当前 RAMPS 坡口进入地下枢纽再返回通过。死亡、respawn、reset、失焦、pointer unlock、恢复路径清零。阶段数据保存在 `P1/measurements.json`，最终版本重新验证在 `P4/measurements.json`。

## P2：蹲姿与接地

只插值眼高；World.canStand 继续决定能否站立及原碰撞高。低顶安全优先，视觉过渡若会进入顶面则直接限制到蹲姿眼高，不为了动画穿顶。

150ms 蹲到 1.03m，180ms 站到 1.56m；两个过渡中点均为 1.295m。30/60/120Hz 跳跃峰值逐一与 P0 相同。

grounded 同时检查脚底距地面及下降方向；头顶撞击导致 velocityY=0 时，若仍离地，不触发落地。单元测试验证撞头后真正落地只触发一次。实际浏览器跳跃产生一次落地，枪身峰值下沉 0.015m，120ms 回到 0。空中 bob 权重样本从 0.974996 降至 0.039743。没有添加相机 bob。

## P3：ADS 与后坐

adsIntent 保存右键意图；effectiveADS 实时查询存活、输入门禁、武器槽、reload 和 switching。保留 ads 访问接口兼容现有调用方。Player 的速度、FOV 目标和 mousemove 灵敏度使用同一有效状态。

换弹/大刀/切枪期间无一帧新进入 ADS；已存在的 ADS blend 仍按原 210ms 平滑退出。换弹期间保持右键，结束后可继续进入 ADS。实际鼠标事件验证换弹时 100px 转动使用 hip 灵敏度，yaw 增量 0.2。

ADS 枪身后坐峰值平移 -0.065m、旋转 -0.0605rad；相机 kick 仍 0.034。回位每帧从原锚点重建，无累积变换。未重新标定 HANYANG_SIGHTS、Hip / ADS Anchor，未改变射线或伤害/散布。

最终 `sight-calibration-browser.mjs` 实际执行 10 次 ADS→Fire→Bolt→ADS，中间正常装填；最大后瞄具误差 0.001454px、前瞄具误差 0.000862px、矩阵回位误差 1.49e-7，camera pitch 最终 0，原 GLB 共用检查通过。数据：`test-results/sight-calibration/measurements.json`。

## P4：换枪与受击

pendingSlot 在 Weapon 内保存请求。前 150ms 收枪，半程切槽，后 150ms 抬枪。全程拒绝攻击、ADS、reload 和重复切换；原枪栓、装填、近战周期未结束时拒绝发起切换。同槽位忽略；测试以剩余 3 发切出再切回，仍为 3 发。

死亡、reset、失焦、解锁及恢复清理 pendingSlot、切换计时和落地效果，不改变原弹药/冷却规则。HUD 基于现有 hurtUntil 和游戏时间计算，不创建异步任务；0/100/200/300/400ms opacity 分别为 0.8/0.6/0.4/0.2/0。连续命中刷新有界反馈，低血量返回原 0.25 底值。

`test-results/player-feel/P4/matrix.json` 中 29 项通过，覆盖持续按键、1.49s 拒绝与 1.51s 接受、最后一发只扣弹/抛壳一次、装填互斥、有效 ADS、后坐倍率、落地、切枪互斥及生命周期清理。大 dt 跨多个事件点仍按顺序各触发一次；RELOAD_EVENTS 原来包含两个不同时间的 reload-press，均按原事件点分别执行。

## 测试与旧入口适配

| 实际执行 | 结果 |
| --- | --- |
| `npm test` | 58/58，通过（含 5 项新增 Player Feel 测试） |
| `npm run build` | 通过；2287 modules；保留 Vite 大 chunk 提示 |
| `tests/player-feel-browser.mjs` | P0/P1/P2/P3/P4 的 30/60/120Hz 序列通过 |
| `tests/player-feel-matrix.mjs` | P3 与最终 P4 通过 |
| `tests/input-and-tunnel.mjs` | 实际键鼠、换枪、7 个坡口往返通过 |
| `tests/sight-calibration-browser.mjs` | 10 次射击回位、遮挡/近裁切、共享通过 |
| `tests/hanyang-browser.mjs` | 16 支实例、共享、装填/枪栓及延迟加载通过 |
| `tests/feedback-browser.mjs` | 5 次射击、25 个 bolt 声事件、弹壳/音频回收、ADS 通过 |
| `tests/battlefield-browser.mjs` | 通过 |

现有入口中有与实施前美术/地图状态不符的断言：input-and-tunnel 使用旧地道坐标，改为当前 RAMPS 路径；feedback 引用已被 GLB 移除的备用瞄具，改为实际 Anchor，原“8 个程序纹理、木纹共用”断言改为当前 1 个 OldWood 备用纹理与 16 支 GLB 共用 3 个材质。保留场景资源数前后相等、256 纹理尺寸、弹壳容量 24、音频上限和准星误差检查。hanyang 与输入测试的立即切换等待改为覆盖 300ms 合约。没有修改地图或美术去迎合过时测试。

最终浏览器日志位于 `test-results/player-feel/`；feedback 截图已检查，ADS 枪身与 HUD 正常显示。生产包主 chunk 约 6371.40kB，gzip 1406.17kB（P0 约 6367.06 / 1404.95kB）；本轮不扩展打包优化范围。

复现时先启动 Vite 于 `127.0.0.1:5173`，设置 `GAME_URL=http://127.0.0.1:5173`。浏览器脚本通过 PLAYWRIGHT_MODULE 指向本机已安装 Playwright；input-and-tunnel 的 ESM import 需要 `file:///.../playwright/index.mjs`，其余 createRequire 入口使用模块目录。专项脚本用 `FEEL_PHASE=P4` 验证最终实现，P0 数据为修改前采集，不能用最终源码覆盖。性能入口使用 `PERF_SECONDS=300`、`PERF_LABEL=player-feel-P4`、`PERF_QUALITY=MEDIUM`。

## 五分钟 8v8 实时性能

使用已有 `tests/performance-baseline.mjs`，MEDIUM、1920×1080、Chrome headless，玩家 + 7 友军 AI + 8 敌军 AI。15s 预热后采集 300s，每 30s 一段；脚本驱动真实时间游戏，不加速 step。这是浏览器自动试玩，并非人工主观手感评价。

已完成：300s 采样，包含收尾等待的 wallSeconds=302.352；浏览器 Chrome 153.0.8010.36，CPU i5-12600KF。原始数据为 `test-results/performance/player-feel-P4.json`，汇总为 `test-results/player-feel/performance-comparison.json`。测试期间源码哈希保持一致。

| 指标 | P0（60s） | P4（300s） |
| --- | --- | --- |
| 30s 分段 FPS 均值 | 60.013 | 59.993；分段范围 59.974–60.039 |
| CPU 每帧均值 | 2.890ms | 2.552ms；前 60s 为 2.546ms |
| 主线程每帧均值 | 3.692ms | 3.253ms；前 60s 为 3.229ms |
| 收尾 GC 后 heap | 108.502MiB | 110.573MiB |
| AI 感知 / 决策 / LOS actors 峰值 | 3 / 2 / ≤4 | 3 / 2 / 4，均在预算内 |
| 收尾 AudioNode / voices | 9 / 0 | 9 / 0 |

P4 在 120/240/300s GC 后 heap 为 109.265 / 110.130 / 110.618MiB，后两次相对 120s 增长最终 1.353MiB，未超过 8MiB 检查阈值；这不等同于证明无限时间无泄漏。末三段 FPS 相对前三段下降未超过 5%。浏览器错误 0，驱动记录 35 次攻击尝试与 2 次部署；攻击尝试计数不等于成功命中或实际发射数。

场景 349 meshes / 65 materials / 72 textures / 4 lights / 159 transformNodes / 15 AI 始终相同。效果/弹壳/烟雾池容量 28 / 24 / 8 不变；采样活动量均未超上限。30s 快照中 voices 最大 6、活动音频节点最大 41；快照不是帧内绝对峰值，专项声音压力测试另验证 22 voices ≤24 并全部回收。

当前测试未观察到明显性能回退。P0 与 P4 采样时长、运行会话及战局演化不同，因此不把 CPU 均值降低解释为此修改带来的性能提升；本次未启用 GPU 计时，也不能据此推断其他机器的帧率。

## 与参考方案的具体化、局限与延期

- 换枪在建议 250–350ms 范围内选用 300ms；落地选用 120ms 正弦包络；眼高使用有限时长 smoothstep。
- 加速度使用精确分段位移积分，以满足跨帧率端点要求；原空中控制和垂直积分保留。
- 低顶眼高安全限制优先于完整视觉过渡；清理回调仅处理局部新增反馈。Game 只增加 grounded 脚步判断与 HUD 淡出接线。
- 右键意图保持到 mouseup，装填结束后恢复瞄准许可；许可禁止的是新进入 ADS，原 blend 平滑退出仍保留。
- 没有扩展新的 Unity 风格组件、库存、输入框架、计时任务或新的世界射线。
- 延期：coyote / jump buffer、体力、滑铲、墙跑、多段跳、冲刺方向规则调整、自动武器后坐、相机噪声、逐发装填、有限备弹、多槽库存、音频素材替换，以及所有地图/美术/AI/新武器工作。

本轮验收只覆盖上述自动化场景与当前机器，主观手感仍可由玩家实际操作评价；此轮到 P4 验收与本文档为止。
