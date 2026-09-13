# Unity FPS Engine 行为参考与 Player Feel Pass 最小计划

分析日期：2026-09-13。对象：当前 `G:/codex/taierzhuang-fps` 工作区（含已有未提交修改），不是 `G:/codex` 根目录的同名 npm 项目，也不是 baseline / before 副本。

## 1. 范围与证据

采用 ECC `codebase-onboarding` 的“目录侦察 → 调用链追踪 → 按现有架构映射”方法。本轮只交付此文档，不生成 CLAUDE.md，不修改游戏代码、Unity 源包或其目录。

- 输入包：`D:/下载/FPS Engine v1.4.16 (16 Dec 2025)/FPS Engine v1.4.16 (16 Dec 2025).unitypackage`，83,817,962 bytes。
- SHA-256：`FB2AD3E9E9ED15B8D395BD2C555CE204546A9A32EBB5D26F14072A6E997AF884`。
- 只读解析包内 GUID / pathname / asset 映射；分析副本位于 `G:/codex/.tools/unity-fps-reference/`，不作为游戏依赖，不加入项目源码。
- 以下 Unity 路径均为包内真实路径。为便于阅读，`U/` 表示 `Assets/Cowsins/Scripts/`；`P/` 表示 `Assets/Cowsins/Prefabs/`；`SO/` 表示 `Assets/Cowsins/ScriptableObjects/`。在分析副本根目录下拼接即可找到对应文件。
- 当前项目路径均相对于 `G:/codex/taierzhuang-fps/`；文件后的方法名是定位入口。
- 证据等级：**代码事实**来自读取的脚本与调用关系；**示例配置**来自指定 Prefab / asset；**建议值**是待试玩调参的起点，不是 Unity 原值或已经实现的效果。
- 未运行 Unity Editor、参考演示或本轮 Babylon 试玩；未验证动画剪辑在 Unity 中的最终播放效果。目录标注版本未作厂商版本认证。本文是静态行为对照，不宣称已复现 Unity 手感。

不能采用的迁移方式：复制 MonoBehaviour 生命周期、复刻 Unity 对象树、引入刚体来替换当前移动碰撞、移植完整状态工厂/依赖注入/库存框架。`TacticalRouteGraph`、Capture、Spawn/Respawn、AI 及其调度器保留原职责和规则。

## 2. 总体判断

最值得参考的是输入到速度的渐变、蹲姿与落地的反馈包络、武器局部效果分层、状态互斥和换枪准备阶段。当前项目已具备成熟基础：实际位移驱动脚步、ADS 几何锚点、非累计姿态合成、1.5s 枪栓权威时间线、有限音效/弹壳池。这些应继续使用。

| 优先项 | 是否值得采用 | 结论 |
| --- | --- | --- |
| 1 Player movement | PARTIAL | 借鉴意图/实际运动分离，保留 World 碰撞 |
| 2 acceleration / deceleration | YES | 补速度响应；不移植 AddForce 数值 |
| 3 sprint / crouch / jump | PARTIAL | 优先蹲姿视点过渡及着地边沿；扩展移动能力延期 |
| 4 camera bob / sway | PARTIAL | 小幅、可衰减、按真实运动合成 |
| 5 ADS | PARTIAL | 保留已校准锚点，统一有效 ADS 门禁与过渡 |
| 6 weapon recoil | YES | 借鉴单发包络和 ADS 幅度独立配置 |
| 7 camera recoil | PARTIAL | 保留可回正 kick；不搬自动武器曲线积分 |
| 8 bolt-action firing cycle | NO | 未发现专用参考状态机；保留当前 BoltTimeline |
| 9 reload | PARTIAL | 保留 3.2s 一次补满，借鉴进入/完成/终止边界 |
| 10 damage / death feedback | PARTIAL | 补连续淡出，复用现有命中/死亡回调 |
| 11 footsteps | PARTIAL | 当前距离驱动更合适，只补运动状态一致性 |
| 12 weapon switching | PARTIAL | 两槽短收起/举起过渡，不引入库存框架 |

YES 表示行为设计值得采用，不表示复制脚本；PARTIAL 表示已有实现可保留或参考实现存在不适配部分；NO 仅针对该项从 Unity 迁移。

当前调用链：`main.ts → Game.ts`；每步先 `Player.update(dt)`，后 `Weapon.update(dt,time)`。Player 管输入、位置和相机；Weapon 管开火门禁、弹药/冷却、第一人称姿态；`Combat.shoot/damage` 管命中与生命结算；Game 连接 HUD、音效和复活。渲染循环的游戏 dt 上限为 0.05s，HUD 约每 0.08s 刷新。任何新效果都必须考虑这个顺序，不能增加另一套伤害或时间来源。

## 3. 十二项对照

### 01. Player movement

**Unity参考脚本：**

- `U/Movement/PlayerMovement.cs`：初始化刚体和行为对象。
- `U/Behaviours/Movement Behaviours/BasicMovementBehaviour.cs`：`Movement`、`CalculateMoveDirection`、`LimitDiagonalVelocity`。
- `U/Behaviours/Movement Behaviours/GroundDetectionBehaviour.cs`、`U/Player/PlayerState/PlayerDefaultState.cs`：接地与物理步调用。

**核心行为：** 朝向坐标系中的前/右输入归一化；斜坡上投影到地面法线平面；移动施力与水平限速分开；空中降低输入作用；移动可控与整体可控分别检查。`OnIdleToMove/OnMovingToIdle` 在 BasicMovement 中依据移动方向而非碰撞后的位移，不能据此认定撞墙时必定静音。

**关键参数：** `acceleration`、`CurrentSpeed × WeightMultiplier`、`controlAirborne`、坡面额外施力。示例 `P/PlayerControllers/CowsinsFPSController.prefab`：walk=5、run=10、crouch=3、Rigidbody mass=1.5。当前：walk=4.2、sprint=6.5、crouch=2.2 m/s，radius=0.33、height=1.7m。

**依赖的Unity API：** `Rigidbody.AddForce/velocity`、`FixedUpdate`、`Time.deltaTime/fixedDeltaTime`、`Vector3.ProjectOnPlane`、`Quaternion.Euler`、接地物理查询。

**当前 taierzhuang-fps 对应模块：** `src/player/Player.ts:update`；`src/map/World.ts:move/canStand/floorAt`；`src/player/PlayerStuckRecovery.ts`；`src/config/gameConfig.ts`。已有对角归一化、沿轴碰撞、贴地、低顶限制，以及碰撞后计算 `moveSpeed`。

**是否值得采用：** PARTIAL

**Babylon实现建议：** 在 Player 内仅增加水平速度响应，将得到的位移交给原 `world.move`。位置真值仍是 Player.position；碰撞、台阶和地板仍由 World 处理；音效与动画继续使用实际位移，不使用期望速度。保留现有被卡恢复，恢复位移不得计入脚步与 bob。

**风险：** 用刚体替换当前逐轴碰撞会改变巷道、坡道和地道可通行性；不可照搬 Unity 的坡面施力、武器负重或速度上限。World 当前台阶阈值 0.36m 属于地图行为边界，本 pass 不改。

### 02. Acceleration / deceleration

**Unity参考脚本：** `U/Behaviours/Movement Behaviours/BasicMovementBehaviour.cs:FrictionForce/FindVelRelativeToLook/LimitDiagonalVelocity`；`U/Movement/PlayerMovementSettings.cs`。

**核心行为：** 输入方向施加加速度；松开某一轴或该轴输入与速度反向时施加反向摩擦；离地、起跳时跳过地面摩擦；水平速度单独封顶，小速度归零。它不是对最终位置做 Lerp，也不是单一“平滑移动”开关。

**关键参数：** 脚本默认 `acceleration=4500`、`controlsResponsiveness=0.175`、`controlAirborne=0.5`、`frictionThreshold=0.1`；示例控制器将 responsiveness 覆盖为 **0.4**。摩擦表达式含 acceleration、dt、局部速度和 responsiveness；AddForce 还受物理积分与质量影响，4500 不能解释成 Babylon 的 m/s²。

**依赖的Unity API：** `Rigidbody.AddForce/velocity`、`Quaternion × Vector3`、`Time.deltaTime`、物理步积分。

**当前 taierzhuang-fps 对应模块：** `src/player/Player.ts:update/clearInput/respawn`、`src/config/gameConfig.ts`；当前每帧直接以目标 speed 产生位移，起步、停止和掉头即时发生。

**是否值得采用：** YES

**Babylon实现建议：** Player 保留 XZ 水平速度；对“目标速度−当前速度”的向量做有界趋近，最大变化为 `a × dt`，防止分轴加速造成斜向额外增益。加速、松键制动、反向制动分开设置。建议首轮地面值：加速 35m/s²、松键制动 50m/s²、反向制动 60m/s²；从静止到4.2m/s约120ms，松键停止约84ms（连续模型估算，离散步需实测）。保留原最大速度、ADS速度倍率。与墙碰撞后按实际 X/Z 位移修正受阻速度，避免积累推墙惯性；空中控制策略先保持现状，不同轮引入。

**风险：** 制动增加约0.18m的连续模型停止距离，会影响掩体边缘站位；必须实测而非追求越平滑越好。失焦、解锁、死亡、复位、被卡恢复均需清零新增速度；不可让解锁后继续滑行。先在训练场验证，再测地道和坡道。

### 03. Sprint / crouch / jump

**Unity参考脚本：** `U/Behaviours/Movement Behaviours/VelocityHandlerBehaviour.cs:CanSprint`、`CrouchSlideBehaviour.cs:CheckUnCrouch/Tick`、`JumpBehaviour.cs:Enter/CanExecute/Tick`；`U/Movement/PlayerMovementSettings.cs`。

**核心行为：** 冲刺受瞄准、蹲伏、体力、输入方向及射击策略限制；蹲姿渐变，起身前检查顶部；起跳重置竖直速度后给冲量，接地事件重置跳数，具备冷却和可选 coyote 规则。滑铲、多段跳、墙跑等是该框架的扩展能力，不属于本项目本轮目标。

**关键参数：** 示例 controller：`canRunBackwards=0`、`canRunSideways=1`、`canRunWhileShooting=0`、`crouchTransitionSpeed=6`、`roofCheckDistance=3.5`、`jumpForce=20`、`jumpCooldown=0.25s`；脚本 jumpForce 默认550，不能当作示例实际值。示例 `canCoyote=0`、`coyoteJumpTime=0.1`。脚本中 `MovementContext.CoyoteJumpTime` 未发现从 settings 赋值，因此不能宣称该0.1s已接通生效。

**依赖的Unity API：** `Rigidbody.AddForce(...,ForceMode.Impulse)`、`Transform.localScale`、`Vector3.MoveTowards`、`Physics.Raycast`、UnityEvent。

**当前 taierzhuang-fps 对应模块：** `src/player/Player.ts:update`、`src/map/World.ts:canStand`、`src/config/gameConfig.ts`。Shift冲刺，ADS/蹲伏阻止冲刺；任意方向可冲刺。C或受浏览器键盘捕获保护的Ctrl蹲伏；低顶强制蹲伏；Space单次排队，落地且非蹲伏才跳。jump=5.2m/s、gravity=16m/s²；眼高1.56/1.03m，碰撞高1.7/1.2m；当前眼高直接切换。

**是否值得采用：** PARTIAL

**Babylon实现建议：** 首轮只平滑渲染眼高，建议150ms蹲下、180ms站起；蹲下碰撞立即采用现有1.2m，站起仍必须通过完整 `canStand` 检查。保持 jump/gravity、方向冲刺和空中控制原规则；通过前后接地状态产生一次起跳/着地反馈，不把速度顶点当作着地。coyote、跳跃缓冲、禁止后退冲刺作为后续单独玩法决策。

**风险：** 平滑角色整体缩放会改变碰撞和武器尺度；视点过渡应限制在安全高度，站起途中顶上有障碍要回落。当前以 `velocityY===0` 判断脚步接地，撞顶也会归零，新增着地事件应同时核对 `floorAt`。低顶与C/Ctrl浏览器行为必须保留。

### 04. Camera bob / sway

**Unity参考脚本：** `U/Effects/CameraEffects.cs:UpdateHeadBob/UpdateBreathing/LandingShakeRoutine`；`U/Effects/WeaponEffects.cs:UpdateBobbing/ApplyCombinedEffects`；`U/Effects/WeaponSpecificEffects.cs:SimpleSway/PivotSway`。

**核心行为：** 相机有步态、呼吸、移动倾斜和落地冲击；枪身有独立步态、跳跃/着地包络、鼠标滞后摆动。WeaponEffects 将基准姿态、bob与jump组合；SimpleSway限幅且ADS时缩小到1/5、加快趋近。Unity相机bob以绝对时间驱动并增量写变换；枪身bob含每帧固定 `+0.01`。这些具体写法不能视为帧率无关的模板。

**关键参数：** Camera示例：headBobAmplitude=1、frequency=10、crouchMultiplier=0.5；脚本实际位移除400、旋转除100，**amplitude=1不等于1m**；breathing=0.2/2；landShakeIntensity=0.1、duration=0.1s。SimpleSway脚本默认 amount=.02、maxAmount=.06、smoothAmount=6、tiltAmount=4°、maxTiltAmount=5°、smoothTiltAmount=12。最终枪械prefab可覆盖这些默认值。

**依赖的Unity API：** `Transform.position/localPosition/Rotate/RotateAround`、`Mathf.Sin/Cos`、`Quaternion.Lerp/Slerp`、`AnimationCurve`、Coroutine、Time。

**当前 taierzhuang-fps 对应模块：** `src/weapons/Weapon.ts:update`、`src/weapons/ViewmodelAnchors.ts`、`src/player/Player.ts:update`。枪身已有距离相位 `speed×dt×2.4`，幅度走路.007m/冲刺.014m，ADS抑制83%；bob权重以 `1-exp(-16dt)`平滑；sway X上限.012m/Y上限.01m，系数.0003、平滑14。相机当前没有步态或落地包络。枪身bob目前没有明确接地门禁。

**是否值得采用：** PARTIAL

**Babylon实现建议：** 保留锚点重建和现有枪身bob；离地逐渐减小bob权重，着地触发独立、只运行一次的短包络。相机bob可先默认0，落地位移建议从0.015m/120ms试起，ADS减弱；避免初次就加入旋转晃动。需要步态同步时共享实际行走距离或脚步相位，而不是再造计时器。鼠标sway若要调帧率差异，区分每帧累计像素与角速度，不能给mouselook额外乘dt。

**风险：** 相机本身是当前射线来源，相机位移/旋转会影响瞄准。最低风险先做枪身落地反馈；相机效果若启用，必须验收射线、近裁面与瞄具中心，不允许暗中换一套Combat射线。任何包络都从基准重建，不叠加到上一帧变换造成漂移。

### 05. ADS

**Unity参考脚本：** `U/Behaviours/Weapon Behaviours/AimBehaviour.cs:Tick/Exit/ForceAimReset`；`U/Camera/CameraFOVManager.cs`；`U/Behaviours/Movement Behaviours/CameraLookBehaviour.cs`；`U/Weapons/WeaponIdentification.cs`。

**核心行为：** 瞄具点朝相机前方目标移动，带近裁面距离、瞄具附件偏移和旋转；进入/退出事件联动FOV、移动速度；换枪强制复位；灵敏度使用独立ADS倍率。枪身定位、FOV、输入倍率是不同通道。

**关键参数：** 示例 `SO/Weapons/Rifle.asset`：aimDistance=.25、aimingSpeed=30（Lerp速率，非30ms）、aimingFOV=38°、movementSpeedWhileAiming=6、allowAimingIfReloading=0；示例controller ADS灵敏度倍率=.4。该Rifle为30发自动武器，不能套用其ADS速度和视场到汉阳造。

**依赖的Unity API：** `Camera.nearClipPlane/fieldOfView`、`Transform.TransformVector`、`Vector3.Lerp`、`Quaternion.Lerp/Euler`、UnityEvent。

**当前 taierzhuang-fps 对应模块：** `src/weapons/ViewmodelAnchors.ts:calibrate`、`src/player/Player.ts:update/mousemove`、`src/weapons/Weapon.ts:update/reload/select`；相关已有依据见 `docs/HANYANG_SIGHT_CALIBRATION.md`。真实前后瞄具几何已校准；210ms smoothstep；FOV 1.18→.90rad；ADS灵敏度=.6，移动倍率=.65；换弹及大刀禁止ADS。

**是否值得采用：** PARTIAL

**Babylon实现建议：** 保留 `HANYANG_SIGHTS` 与 Hip/ADS Anchor；保持210ms和当前FOV值。先区分右键意图与“本帧允许ADS”的有效状态，并在Player计算FOV/移速前确定许可，避免Weapon下一步才否决；需要平滑灵敏度时可用同一blend从1过渡到.6，但不顺带修改伤害/散布切换规则。冲刺FOV可借现有sprintBlend平滑，勿再另建FOV管理架构。

**风险：** 当前Player先更新、Weapon后清除ADS，换弹中右键可能造成短暂不一致；这是静态发现，需浏览器重现。Unity的 `CameraFOVManager.SetFOV` 在IsAiming时会拒绝更新，须注意事件调用时序；不能机械复制。姿态偏移和相机新效果不得损坏已校准照门/准星。角度采用弧度，不能写入38作为Babylon FOV。

### 06. Weapon recoil（枪身后坐）

**Unity参考脚本：** `U/Effects/ProceduralShot.cs:Shoot/ApplyShotMotion`；`U/Effects/ProceduralShot_SO.cs`；`U/Behaviours/Weapon Behaviours/ShootBehaviour.cs:OnShootHitscanProjectile`。

**核心行为：** 只有实际成功射击才触发程序化枪身运动；XYZ位移和XYZ转角独立曲线，在归一化时间内求值；再次射击停止上次包络；ADS分别缩小平移与旋转。它与名为RecoilSystem的视角曲线是两件事。

**关键参数：** `playSpeed`、6条曲线、`translationDistance/rotationDistance`、`aimingTranslationMultiplier/aimingRotationMultiplier`；名义时长为 `1/playSpeed`（须大于0）。示例Rifle的 `proceduralShotPattern` 引用为空，不能声称本文已从该枪取得有效曲线。曲线末值是否回零会影响停留姿态。

**依赖的Unity API：** `AnimationCurve.Evaluate`、`Transform.localPosition/localRotation`、`Quaternion.Euler`、Coroutine启停、ScriptableObject。

**当前 taierzhuang-fps 对应模块：** `src/weapons/Weapon.ts:attack/update`、`src/weapons/ViewmodelAnchors.ts:VIEWMODEL.recoil`。成功开枪置recoil=1；以 `exp(-10dt)`衰减；枪身后移.10m、俯仰-.11rad。当前枪身后坐没有专门ADS幅度倍率，且cooldown归零时强制清零。

**是否值得采用：** YES

**Babylon实现建议：** 先保留现有衰减形状与峰值，把ADS平移/旋转倍率放进现有VIEWMODEL配置，建议初试.65/.55；只有确实需要更清晰的“冲击—回位”节奏时，才用短归一化包络替代单指数，末值明确归零。仍由Weapon局部姿态合成处理，不创建Unity式全局ProceduralShot单例，不依靠GLB动画来决定可开火时间。

**风险：** 增大枪身位移会近裁切或让枪机穿镜头；ADS枪身运动不能被误认为命中方向变化。不能把首个射击事件提前到“玩家点击”而非“弹药和冷却验证通过”时。末发、死亡、reset均要终止或清零包络。

### 07. Camera recoil（相机后坐）

**Unity参考脚本：** `U/Behaviours/Weapon Behaviours/RecoilSystem.cs:Tick/ProgressRecoil`；`U/Behaviours/Movement Behaviours/CameraLookBehaviour.cs:Tick`；`U/Effects/CameraEffects.cs:ShootShake/HandleCamShake`；`U/Behaviours/Weapon Behaviours/ShootBehaviour.cs`。

**核心行为：** 曲线后坐以实际射击推进 `1/magazineSize`；连射期间求pitch/yaw目标，再由Look以offset×dt积分到视角。松扳机、换弹或Press射击方式进入offset回零分支；**offset回零不等于相机角度自动回到原准点**。另一通道是有上限的Trauma噪声震动并随时间衰减，服务每发射击的视觉冲击。

**关键参数：** 示例Rifle x/yRecoilAmount=50/4、ADS=20/2、relaxSpeed=6、camShakeAmount=.04、camShakeAimMultiplier=.8。CameraEffects中Trauma限0–1，shoot power=20、movementAmount=.8、rotationAmount=17、decay=1.3。这些不等于单发转角。更重要：AimBehaviour局部倍率赋值未连到射击端公开属性，`WeaponController.AimingCamShakeMultiplier`只读初值为1，不能宣称示例ADS震动倍率实际生效。

**依赖的Unity API：** `AnimationCurve`、`Mathf.Lerp/PerlinNoise/Clamp01`、`Time.deltaTime`、Quaternion、Transform。

**当前 taierzhuang-fps 对应模块：** `src/player/Player.ts:cameraKick/update`、`src/weapons/Weapon.ts:attack`。ADS每枪kick+=.034rad，腰射+=.05rad；每步 `exp(-8dt)`回落；相机pitch使用 `pitch-cameraKick`。腰射另加永久pitch偏移-.014rad，ADS没有该偏移。

**是否值得采用：** PARTIAL

**Babylon实现建议：** 保留现有确定性垂直kick及ADS无累计漂移的行为；把峰值/回落率归拢为配置，新增上限和重置验收即可。自动武器横纵曲线、噪声摇晃、永久视角积分不进入最小pass。若要改腰射永久偏移，作为单独手感决策，不以Unity移植名义悄悄删除。

**风险：** 相机kick、永久pitch、枪身recoil混合后容易重复后坐；同时相机射线直接参与命中。现有attack在DOM事件中读取相机射线，而相机旋转在Player.update应用，故不要仅凭赋值顺序断言“本发已经包含新增kick”；需记录实际onFire射线验证，不能在本pass无意改变射击时序。

### 08. Bolt-action firing cycle

**Unity参考脚本：** 未发现专用bolt/chamber/rack行为脚本。相关但不等价：`U/Player/PlayerState/WeaponState/WeaponShootingState.cs`、`U/Weapons/ShootStyles/HitscanShootStyle.cs:HandleHitscanProjectileShot/AllowShootAfterDelay`、`U/Weapons/WeaponAnimator.cs`、`U/Behaviours/Weapon Behaviours/ShootBehaviour.cs`。

**核心行为：** 通用Press模式要求重新按下；Hitscan自身有canShoot门禁，以 `weapon.fireRate` 等待后恢复；成功开火触发动画/音效。`timeBetweenShots`是一次开火内多颗弹/连发的间隔，不是枪栓周期。未找到“开锁→后拉→抛壳→推栓→闭锁→允许下一发”的专用逻辑证据；不能仅因存在shooting动画就认定具有可靠栓动状态机。

**关键参数：** 示例Rifle `shootMethod=1 (PressAndHold)`、`fireRate=.2s`、`bulletsPerFire=1`、`timeBetweenShots=0`。当前汉阳造cycle=1.5s；BOLT_EVENTS归一化时点.09/.24/.43/.62/.83，即135/360/645/930/1245ms；到1500ms才恢复开火。

**依赖的Unity API：** Coroutine、`WaitForSeconds`、Animator、UnityEvent、`Physics.Raycast`（通用射击，不是栓动依赖）。

**当前 taierzhuang-fps 对应模块：** `src/weapons/BoltTimeline.ts:BOLT_EVENTS/boltPose`、`src/weapons/Weapon.ts:attack/update`、`src/weapons/HanyangRifle.ts:setBolt`、`src/effects/ShellCasingPool.ts`、`src/audio/AudioSystem.ts`。

**是否值得采用：** NO

**Babylon实现建议：** 保留单一cooldown与归一化时间线，音效及抛壳事件用现有while跨越检查保证一次触发，模型姿态只是同一相位的采样。继续禁止循环中换弹/切武器，保留循环中ADS的现行行为；不能以Unity动画结束回调代替1.5s门禁。下一轮只增加/复用事件顺序与末发验收，不重写现有时间线。

**风险：** 这是“脚本未发现”的有边界结论，不排除动画资产含机械动作；未运行Unity验证。多个独立计时器会使抛壳、闭锁、射击许可错位，低帧率下也可能漏发。不得为了感觉更快缩短原射速。

### 09. Reload

**Unity参考脚本：** `U/Behaviours/Weapon Behaviours/ReloadBehaviour.cs:DefaultReload/StopReload`；`U/Player/PlayerState/WeaponState/WeaponReloadState.cs`、`WeaponDefaultState.cs`；`U/Weapons/WeaponAnimator.cs:StartReload`。

**核心行为：** 换弹进入先设置状态，短延迟后播放声音与动画，等待reloadTime，最后提交弹药并发完成事件；区分空仓与普通装填音效；可配置自动装填和有限备弹。换弹状态默认阻止ADS。该代码不是逐发装填/桥夹装填模拟。

**关键参数：** `autoReload/autoReloadDelay`、`reloadTime`、`magazineSize/totalBullets/limitedMagazines`、`allowAimingIfReloading`。默认手动前置等待.1s，声音另传.1s延迟；示例Rifle reloadTime=3.1s、magazineSize=30、limitedMagazines=0。不能把3.1s直接当作输入到装填完成的全部时长。

**依赖的Unity API：** `StartCoroutine/StopCoroutine`、`WaitForSeconds`、Animator、AudioClip、UnityEvent。

**当前 taierzhuang-fps 对应模块：** `src/weapons/Weapon.ts:reload/update/reset`、`src/weapons/BoltTimeline.ts:RELOAD_EVENTS`、`src/config/gameConfig.ts`、`src/audio/AudioSystem.ts`。5发容量，3.2s装填完成时一次补满；没有备弹耗尽系统；归一化事件.08/.26/.43/.62/.78/.92；换弹期间禁止开火/切换并逐步退ADS。

**是否值得采用：** PARTIAL

**Babylon实现建议：** 保持3.2s和一次补满规则；只明确开始、完成、因死亡/reset终止的边界；UI提示复用reloadTime，声音与枪机继续同一时间线。若以后区分空仓/非空仓，先仅改变可见反馈，时间及弹药规则另评估。有效ADS门禁在本帧姿态更新前确定。

**风险：** Unity `StopReload`调用 `StopCoroutine(reload())`创建了新IEnumerator，不能当作已经可靠取消原任务；完成前的IsReloading检查也不能替代本地明确的计时状态。不得照搬协程、重叠异步回调或有限备弹库存；当前未要求实现真实逐发压弹。

### 10. Damage / death feedback

**Unity参考脚本：** `U/Player/PlayerStats.cs:Damage/Die`、`U/Player/PlayerState/PlayerDeadState.cs`、`U/UI/UIController.cs:UpdateHealthUI/ReduceHealthStatesAlpha`。

**核心行为：** 生命变化和反馈通过事件连接；伤害先扣盾后扣血，通知UI后死亡；死亡只进入一次，移除控制，可选冻结刚体；UI选受伤颜色并淡出。护盾/自动治疗/坠落伤害是规则扩展，不是反馈的必要组成。

**关键参数：** `damageColor`、`fadeOutTime`、`freezePlayerOnDeath`、`maxHealth/maxShield`。注意fadeOutTime在代码中是每秒减少alpha的速率，字段名虽称Time却不是简单持续秒数。未将PlayerUI序列化颜色/淡出值作为已经试玩的视觉标准。

**依赖的Unity API：** UnityEvent、UI `Image.color`、Coroutine、`Time.deltaTime`、`Rigidbody.isKinematic`；原生命系统另用InvokeRepeating治疗。

**当前 taierzhuang-fps 对应模块：** `src/game/Combat.ts:damage` → `src/game/Game.ts:combat.onHit/onDeath` → `src/ui/HUD.ts:hurt/update`、`src/ui/style.css`、`src/audio/AudioSystem.ts`；`src/player/Player.ts`与`src/weapons/Weapon.ts`分别处理死亡视点/武器隐藏。已有受击音、死亡音、命中标记、部署界面；HUD受击0.4s内opacity=.8，之后低于35血且活着为.25，否则0。

**是否值得采用：** PARTIAL

**Babylon实现建议：** 保留Combat所有伤害、阵营/基地/保护门禁与Game死亡回调；只让HUD受击强度从峰值连续下降到既有低血底值，重复命中刷新/有界叠加强度。建议先保持0.4s时长；使用单个数值状态或CSS过渡，避免每次命中创建新任务。死亡反馈直接复用onDeath，不自行调用复活或改部署流程。

**风险：** HUD约80ms更新一次，单靠按帧数减少alpha会抖动；应按游戏时间算进度。Unity每次命中开启淡出协程，快速命中可能有多个协程同时写alpha，这种做法不采用。不能为了更有冲击力延迟既有死亡/部署界面，也不引入护盾、回血、坠落伤害。

### 11. Footsteps

**Unity参考脚本：** `U/Behaviours/Movement Behaviours/FootstepsBehaviour.cs:CanExecute/FootSteps/PlayFootstepSound`；`U/Movement/PlayerMovementSettings.cs`。

**核心行为：** 非接地且非墙跑、或Idle时不播放并重置计时；按CurrentSpeed推进计时；落脚时向下射线找地表layer，随机选AudioClip及pitch；layer索引预缓存。它使用目标CurrentSpeed驱动节奏，不是实际距离积累。

**关键参数：** 示例footstepSpeed=.7、volume=.3；计时重置为 `1-footstepSpeed`，每秒减 `CurrentSpeed/15`，恒速时周期为 `15×(1-footstepSpeed)/CurrentSpeed`；例5速度约.9s、10速度约.45s。pitch随机.7–1.3，射线长2.5m。

**依赖的Unity API：** `Physics.Raycast`、`LayerMask.NameToLayer`、`AudioSource.pitch/PlayOneShot`、`AudioClip[]`、`Random.Range`。

**当前 taierzhuang-fps 对应模块：** `src/audio/Footsteps.ts:FootstepTracker`、`src/game/Game.ts:step`、`src/map/World.ts:footstepAt`、`src/audio/AudioSystem.ts`。实际距离触发，步长walk=1.65/sprint=1.9/crouch=1.25m；地道优先、已有表面标记其次、白盒区域兜底；音效已有pitch .985–1.015和音量.97–1.03随机，voice上限24。

**是否值得采用：** PARTIAL

**Babylon实现建议：** 保留距离算法、地表查询、音色及voice上限，不添加每帧向下射线，也不改成按键计时。只让脚步与bob消费一致的实际移动/接地信息；空中静音、撞墙静音、恢复传送不走步数。跳跃/落地音若增加，应是接地边沿的单独音效事件；模式音量差异可延期。

**风险：** 随机pitch .7–1.3对当前合成音过大，已有轻微随机足够。以velocityY===0单独作为grounded可能把顶头误作接地；跟第03项共用修正，勿改World表面规则。不要因为落地同时满足行走而叠加多次落脚音。

### 12. Weapon switching

**Unity参考脚本：** `U/Behaviours/Weapon Behaviours/WeaponInventorySystem.cs:HandleInventory/ChangeWeaponIndex/SelectWeapon/UnHolster`；`U/Player/PlayerState/WeaponState/WeaponUnholsterState.cs`；`U/Weapons/WeaponAnimator.cs:OnUnholster`；`U/Behaviours/Weapon Behaviours/AimBehaviour.cs:ForceAimReset`。

**核心行为：** 数字键/滚轮选择合法槽位；先发换枪事件清理ADS，再选择并显示武器，触发举枪声音、动画和Unholster状态；该状态约.5s后回默认，可配置举枪期间换弹。并非已经实现任意时长的通用“收枪→换槽→举枪”三段动画。

**关键参数：** `inventorySize`、`allowNumberKeyWeaponSwitch/allowMouseWheelWeaponSwitch`、`allowReloadWhileUnholstering`、holster/unholster音效；`WeaponUnholsterState`中.5s为硬编码门禁，不应套用为当前双武器默认值。

**依赖的Unity API：** Input System `Keyboard.current/wasPressedThisFrame`、`GameObject.SetActive`、Animator Rebind/Update、AudioClip、UnityEvent、Time。

**当前 taierzhuang-fps 对应模块：** `src/player/Player.ts:onWeapon/keydown`、`src/weapons/Weapon.ts:select/reset/update`、`src/game/Game.ts`的输入回调。1=汉阳造，2=大刀；reloadTime或cooldown大于0拒绝切换；否则立即切显示、退出ADS，没有举枪门禁。select当前没有显式槽位范围/同槽过滤。

**是否值得采用：** PARTIAL

**Babylon实现建议：** 在现有Weapon内增加pendingSlot与短切换阶段即可：合法不同槽位→短收起→切换可见对象→举起→允许动作。建议总长250–350ms，期间禁止攻击/换弹/ADS，不引入库存数组或对象工厂；保留原cooldown/reload阻止切换的规则，重复同槽忽略，切换途中重复输入策略先采用忽略。沿用现有模型，不复制网格；reset直接恢复默认槽，不走动画。

**风险：** 原select无存活门禁，新增过渡应明确死亡后不能启动/残留；两个槽共用root，位姿残留可能让大刀沿用枪的ADS。不能借换枪清除枪栓cooldown、缩短近战周期或补弹。新增音效名称若没有对应声音定义会落入现有默认impact-earth，故不要先发不存在的音效事件。

## 4. 参考实现中不可照抄的细节

这批代码有可借鉴的设计，但不是所有配置和注释都能证明效果已生效：

1. `RecoilSystem`对Press模式直接回正offset；`CameraLookBehaviour`又将offset作为角度增量积分。不能将其描述成栓动武器的自动回准弹簧。
2. ADS震动倍率的局部变量与公开属性未连通；coyote配置也未发现注入context。需以实际消费路径判断，不只读Inspector字段。
3. CameraEffects增量叠加bob/呼吸，WeaponEffects含固定每帧相位增量；WeaponSpecificEffects在Update中使用fixedDeltaTime。迁移建议用dt和基准姿态合成，避免复制帧率依赖。
4. ReloadBehaviour取消协程的实例问题、UI受伤淡出协程重叠风险，不带入当前同步update流程。
5. 示例Rifle是30发自动枪，其0.2s射击间隔、38°FOV和6速度ADS均不代表汉阳造目标。

## 5. Player Feel Pass 最小迁移计划（后续轮次，不在本轮执行）

### 固定边界

保留当前玩家最高速度4.2/6.5/2.2、jump=5.2、gravity=16、5发容量、cycle=1.5s、reload=3.2s、伤害75/150、散布.014/.0015、ADS210ms及瞄具锚点。新增加减速会改变短程移动时间，必须单独验收。不得修改TacticalRouteGraph、Capture、SpawnSystem/复活规则、AI/调度预算、地图碰撞参数、世界武器比例或GLB。

不新增Unity式状态层级；少量局部数值/阶段仍由Player和Weapon持有，Game只连接必要反馈。优先限定改动文件为Player.ts、Weapon.ts、ViewmodelAnchors.ts、gameConfig.ts；确有反馈需求再动Game.ts、HUD.ts、style.css、AudioSystem.ts，且仅限玩家反馈接线。

### 分步交付

| 阶段 | 最小改动 | 验收/停止条件 |
| --- | --- | --- |
| P0 基线记录 | 不改变行为；记录训练场起停/掉头、蹲起、ADS、10发回位、换弹与切换；复用已有调试和测试 | 保存现有瞄具/射线误差、声音事件计数、位移与时间，标记工作区原有修改 |
| P1 地面速度响应 | Player内有界XZ速度趋近；配置加速/停止/反向速率；失焦/reset/恢复清零 | 30/60/120Hz相同输入下比较终点/停止距离（建议差异≤.05m）；不超原速度，不推墙蓄力，不新增穿模 |
| P2 姿态与接地反馈 | 眼高150/180ms过渡；保留碰撞门禁；一个可靠接地边沿；枪身落地包络，空中bob衰减 | 地道低顶不能起身；顶头不触发落地；原跳高不变；被卡恢复不发脚步；相机bob首版默认0 |
| P3 ADS与后坐一致性 | 在Player姿态前确定有效ADS；保留210ms/锚点；枪身ADS后坐倍率配置；相机kick数值保持 | 换弹/大刀/切换不能短暂进入ADS；连续10发含装填后回位无累计漂移；实际onFire射线不变更语义 |
| P4 短换枪与反馈收尾 | Weapon内250–350ms局部过渡；HUD受伤0.4s连续淡出；不改脚步材质算法 | 同槽无动作、切换无免费射击/补弹；死亡/reset无残留；受击连续命中不叠无限任务 |

最小落地按P0→P1→P2→P3→P4，每阶段可独立回退；任何瞄具、碰撞、规则或性能回归先停止推进并修复本阶段。若需再压缩范围，首轮实现只做P1+眼高过渡，其余保留方案，不把“参考了12项”等同于必须改动12项。

### 栓动与互斥验收矩阵

| 场景 | 必须维持的结果 |
| --- | --- |
| 持续按住射击/循环中反复点击 | 不能绕过单次输入和1.5s周期；不凭点击多扣弹或多抛壳 |
| 循环中R/1/2，闭锁后再输入 | 循环中拒绝，冷却归零后按原规则接受 |
| 最后一发→完整循环→装填 | 恰好消耗1发、抛1壳；装填完成才恢复5发 |
| 换弹中ADS/开火/切枪 | 有效ADS=false，无开火，不跳过装填计时 |
| 蹲伏低顶松键、起跳顶头 | 保持安全碰撞高；顶头不是落地 |
| 死亡/解锁/失焦/reset | 输入与新增速度/效果状态按既有生命周期清理；不延迟既有部署规则 |
| ADS射击回位 | 前后瞄具回原锚点，ADS pitch无永久累加；枪身与相机效果不改伤害/散布 |
| 帧间跨越多个事件点 | BOLT_EVENTS与RELOAD_EVENTS按顺序恰好一次，不丢不重 |

### 后续验证入口

现有 `npm test` / `npm run build`；浏览器脚本包括 `tests/input-and-tunnel.mjs`、`tests/sight-calibration-browser.mjs`、`tests/hanyang-browser.mjs`、`tests/feedback-browser.mjs`、`tests/battlefield-browser.mjs`。改动对应范围后阅读各脚本入口并执行相关项，不能只凭文件名当作测试通过。

速度变化需要有意义的dt序列/反向/撞墙验收；武器变化需要弹药与事件计数、10发含真实装填回位验收。保留现有规则测试，确认Capture/Respawn/AI行为未受接线影响。反馈不新增永久每帧分配、无限协程、额外全场景射线或无上限音源；24 voices和既有效果池上限保持。只有出现新性能疑点才扩大到performance baseline，不为文档变更运行长时间游戏压力测试。

### 延期项

coyote/jump buffer、体力、滑铲、墙跑、多段跳、改冲刺方向规则、自动武器后坐曲线、相机噪声震动、逐发真实装填、有限备弹、多槽库存、音频素材替换均不属于最小pass。其必要性不能由Unity“支持该功能”推导。

## 6. 本轮完成情况

已完成12项静态对照，标明脚本、行为、参数来源、Unity API、现有模块、采用判断、实现建议与风险；最小计划仅为后续执行依据。本轮未执行游戏代码修改、Unity导入/运行、build或游戏测试；不会把此前校准文档中的通过结果冒充本轮验证结果。

文档核查通过：12项均有全部8个要求字段，显式文件路径均存在；98个源码/测试/项目配置与CLAUDE.md文件的写文档前后SHA-256一致，Unity包SHA-256复核一致。Git状态保留原有修改，仅新增本文档；分析副本位于项目仓库之外。
