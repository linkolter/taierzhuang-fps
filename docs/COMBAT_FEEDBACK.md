# 战斗反馈实现与检查

本轮沿用 Vite + TypeScript + Babylon.js、Combat Map V2、8v8、A/B/C、Tickets 和 TacticalRouteGraph。用户原有的路线调度、碰撞索引、地形分块与性能诊断改动继续保留。

## 实现入口

- `src/map/ProceduralMaterialFactory.ts`：八张 256×256 DynamicTexture，按场景缓存。`MapMaterials.ts` 复用原材质，木枪托共享 OldWood；旧墙底部污渍通过合批前顶点颜色表达。参考用户两张图的灰黄墙、灰瓦、旧木与低饱和泥地配色。
- `src/audio/AudioSystem.ts`：三八式 crack/body/thump，五段枪机、装填、弹壳、大刀/军刀、四种脚步和分类命中；12–32 秒稀疏环境事件。所有声源共享同一个噪声缓冲，最多 24 个声音实例，结束断开节点。SurfaceBus / TunnelBus 含地道低通及 280ms 短混响；仅在环境变化时设置总线过渡。
- `src/weapons/Weapon.ts`、`BoltTimeline.ts`：210ms ADS、真实速度驱动 bob、反向 mouse sway、奔跑放低、相机/枪体分离后坐。原五发、1.5s 栓动、3.2s 装填与伤害不变；五段动画和声音共用时间轴。
- `src/effects/`：24 个共用弹壳、8 个烟雾面片、28 个世界闪光/命中面片、1 个第一人称闪光；全场共用一个短时枪口灯槽，强度归零但不切换灯光启用状态，避免反复更新材质着色器。
- `src/ai/CombatBehavior.ts`：2.5Hz 局部决策，HOLD / PUSH / FLANK，固定掩体与短距离横移；只遍历现有局部图连接，半径 ≤20m、扩展 ≤320 个节点。战略路线仍由原调度器处理。
- `src/ai/Bot.ts`、`PlayerPressureDirector.ts`、`Combat.ts`：约 5–7Hz 感知，距离→FOV→LOS；新遭遇 500–800ms、警戒 300–500ms、受击 200–400ms 反应。开火前复核胸部→枪口→目标，挡枪不扣弹并重新站位。最多三名敌军对真人保持正常精度，其余降低优先级、精度与积极性；AI 对 AI 不受此限制。
- `CoverPoints.ts`：原有掩体和街道遮挡物周边的 47 个明确站位，包括东西向与可通行的探出位置；没有新增地图几何。

## 自动验证

- `tests/combat-feedback.test.ts`：反应、目标切换、感知频率、枪口遮挡、射速、压力分配、局部路线与枪机顺序。
- `tests/feedback-browser.mjs`：真实浏览器验证五发/25 个拉栓事件、ADS 准星投影、材质共享、固定对象数量、弹壳回收、音频结束清理。
- `tests/feedback-soak.mjs`：默认 900 秒真实时间自动 8v8；控制原有真人槽位、正常受伤重生、正常装填；记录 CPU/帧间隔 P95/P99、路线、声音、碰撞和 GC 前后内存。跨回合自动重开，始终 16 名角色。

运行浏览器测试前启动 `npm run dev`。测试可通过 `PLAYWRIGHT_MODULE` 指向已安装的 Playwright；长测通过 `SOAK_SECONDS` 调整时长。输出写入被 git 忽略的 `test-results/`。性能为当前主机/浏览器实测，不代表所有设备。
