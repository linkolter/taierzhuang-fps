# Ironhold 设计参考

参考：https://github.com/StarKnightt/operation-ironhold （2026-09-10 阅读 main 的 README.md、index.html、tools/test-harness.js、tools/autoplay-bot.js、LICENSE）。

- Canvas 底色、颗粒、斑驳和重复图案 → Babylon DynamicTexture；八种村庄材质初始化生成、按场景缓存，沿用按米计量 UV 和静态合批。
- 噪声包络、振荡器与分层枪声 → Web Audio 系统；三八式 crack/body/thump、分阶段枪机音，地表/地道总线。声音结束断开全部节点。
- 鼠标滞后、步幅摆动、约 0.2 秒瞄准过渡 → 原 Weapon 表现层；沿用五发弹仓、1.5 秒栓动和伤害。弹壳、闪光、灯光、烟尘有固定容量。
- 反应时间、枪口复核、掩体与侧移 → CombatBehavior 局部机动；TacticalRouteGraph 保留战略路线。PlayerPressureDirector 只降低额外敌军对真人的积极性和精度。
- 开发工具的命中一致性检查、自动对局与对象数量监测 → 本项目独立测试，使用当前碰撞索引与诊断接口。

明确不用 Three.js、单文件组织、工业地图、现代枪械/装备/HUD/无线电、双跳、护甲、自动武器连射、全场两人开火硬上限。

归属：参考项目为 MIT，Copyright (c) 2026 StarKnightt。按本项目接口独立编写，未移植实质源码；THIRD_PARTY_NOTICES.md 同时保留来源和完整 MIT 文本。
