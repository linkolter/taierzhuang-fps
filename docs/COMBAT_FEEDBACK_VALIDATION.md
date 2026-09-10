# 战斗反馈验收 · 2026-09-10

本次真实时间运行 901.85 秒，53999 帧，1920×1080；Chrome 153.0.8010.36，12th Gen Intel(R) Core(TM) i5-12600KF。启用 Web Audio，自动控制原有玩家槽位，保留正常受伤、死亡、重生与装填，始终为 1 名玩家 + 7 名中国 AI 对 8 名日军 AI。

| 指标 | 实测 |
| --- | --- |
| FPS（30 秒窗口均值） | 60.00 |
| CPU 每帧均值 | 1.69 ms |
| CPU P95 / P99（各 30 秒窗口的均值） | 2.32 / 3.25 ms |
| 最差窗口 CPU P95 / P99 | 3.40 / 3.70 ms |
| Mesh / 材质 / 纹理 / 灯 | 322 / 35 / 13 / 4，全程固定 |
| GC 后堆内存增量 | 12.99 MiB |
| AI 攻击 / 玩家射击 | 605 / 54 |
| 结算完成回合 | 1 |
| 碰撞异常 / 栓动射速违规 / 页面错误 | 0 / 0 / 0 |
| 对真人高精度敌军峰值 | 3 |

经过路线：main、south、north；7 名 AI 经过地道。观察到 MoveToObjective、Capture、MoveToCover、HoldCover、EngageEnemy、Dead、Peek、SearchEnemy、Flank、Strafe、TraverseTunnel、TakeCover、Melee 状态，HOLD / PUSH / FLANK 均参与交战。

弹壳固定 24 个，烟雾固定 8 个，世界 FX 固定 28 个；停止战斗后活跃音效节点为 0。GC 后增量包含已热身的路线缓存、着色器和测试统计，未以未回收瞬时堆峰值判断泄漏。

原始数据：`test-results/feedback-soak.json`；汇总：`test-results/feedback-summary.json`；枪械/纹理/音频回归：`test-results/feedback-regression.json`。这些输出位于本机，按项目既有规则由 git 忽略。

本机旧版 16 分钟报告的平均 CPU 帧耗时约 1.60ms、窗口 P99 均值约 3.15ms；旧报告为静态观察者，新测试含自动玩家和音频，比较用于排查明显回归，不视为严格相同负载基准。

## 最终回归

- TypeScript 检查与 Vite 生产构建通过；保留 Babylon 主包体积提示，本轮未改构建结构。
- 28 / 28 单元与地图测试通过，包括碰撞索引、战略调度、据点规则和新战斗反馈。
- 浏览器检查：11 / 11 玩家路线、4 / 4 AI 路线通过；全屏、鼠标锁定、Ctrl / C 移动、失焦清键、Esc 暂停通过自动输入检查。
- 生产版本启动通过，生产页面不暴露 `__game`；连续 100 次重置复用同一战略图及士兵模型，对象数量保持不变。
- 声音已验证合成、事件触发、空间节点连接与结束清理；音色仍属于轻量程序合成效果，未声称达到实录音频质感。
