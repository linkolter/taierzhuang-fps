# Combat Map V3 · 白盒验收

状态：仅白盒；人工确认前不进入美术 Pass。

## ECC 地图依赖分析

按 ECC codebase-onboarding 的源码勘查、架构映射和数据流方法，范围限定在现有地图。

`main → Game → World.buildVillage → Village → Terrain / TopologyGeometry / TunnelGeometry`

`MapLayout → Terrain / Topology / 地表几何 / TunnelGeometry / CaptureSystem / F8`

`地表几何 → World.box → obstacles → ObstacleIndex → Navigation → TacticalRouteGraph`

`World.optimizeStatic → 静态合并 / 冻结矩阵 / StaticMeshIndex`

- 布局数据是地形、几何、据点和路线图的共同来源；不能只移动 F8 标签。
- 旧北侧双蛇形外观来自 TopologyGeometry 对每条路线两侧逐米围墙，不来自路线搜索。
- Terrain 按高度函数生成分块地形，并按照 RAMPS 切出入口；保留分块、顶点、孔洞生成框架。
- 碰撞和路线图根据新的白盒几何自然生成；不改查询、A*、缓存、调度和 AI 基础行为。
- 程序材质工厂及应用入口不改。地表使用独立 blockout-* 纯色材质，跳过旧地表装饰调用；地道框架保留。

## 最小修改路径

1. MapLayout：三角据点、标高、地表路线与建筑/围墙体块数据，三个出口及三条局部地道接线。
2. Terrain：仅更新标高函数与白盒地表材质，保留分块和地道开孔算法。
3. Village / TopologyGeometry / BlockoutSurface：替换地表建筑排列、蛇形围墙和装饰组装。
4. F8：复用正交相机，更新白盒标题、据点名、出口职责和两个转线口标注。
5. 测试：更新 V2 固定坐标断言，验证 V3 据点、地表连通、实际碰撞、七个出口与 F8 裁切。

本轮不改 main、Game、Player、枪械、AI 基础、Tickets、CaptureSystem 规则、TacticalRouteGraph、Navigation、碰撞索引、静态优化和程序材质工厂。

## 布局

| 据点 | X / Z | 地面高度 | 战斗空间 |
|---|---|---|---|
| A | -48 / 28 | +3 m | 西北祠堂院落；长屋、侧翼和开放院门 |
| B | 0 / -7 | 0 m | 村心水井；偏南开口广场、窄巷与地下室入口 |
| C | 48 / 28 | +5 m | 东北粮仓院落；不对称长屋、破墙与后院地道 |

北侧一条 +2～+5 m 高地通路；中部不规则院落和窄巷；南侧 -1～-2 m 沟渠、战壕与田埂体块。
地表仅两个主要转线口：(-8,14) 高地坡口，(24,-14) 南沟坡口。

| 出口 | 职责 | 调整 |
|---|---|---|
| T0 | A 侧 | 迁至 (-62,26)，短接原西部地下主干 |
| T3 | 高地 | 原位 (-20,28) |
| central | B 地下室 | 入口 (-2,-6)，横向坡道接 (-18,-6)，短接原主干 |
| T6 | 南沟 | 原位 (12,-28) |
| T7 | B/C 侧翼 | 原位 (28,7) |
| T9 | C 后院 | 迁至 (72,28)，沿高地横向接 (48,28)，短接原东部主干 |
| T10 | 东村口 | 原位 (76,4) |

## 验收方式

- npm test；npm run build。
- 实际静态网格包围盒验证横屏、竖屏、超宽屏取景。
- 真实地表路线和七个地道出口连通；验证地表跨线边只能经过两个转线口。
- F8 截图供人工判断三角构图、院落/窄巷/高地/南沟尺度；截图不代表已完成美术或竞技平衡验收。
