# 汉阳造第一人称机械瞄具校准

2026-09-12 完成。本轮范围为第一人称姿态、机械瞄具、枪机显示和开发调试。
未编辑伤害、散布、弹道、AI 决策、Capture / Tickets、地图或 GLB。
工作区已有的 SoldierModel / Combat / Game / HUD 等修改属于此前模型接入，本轮保留。

## 几何与对齐

模型只有 hanyang-sling、hanyang-body、hanyang-bolt-mesh 三个 mesh；前后瞄具合并在 body 中。
直接读取现有 GLB 的 POSITION / indices，检查侧视、俯视和瞄具截面；不重打包模型。
以下为经过 Babylon loader Z 反射之后的 rifle 局部坐标，单位米，+X 右、+Y 上、+Z 前。

| 辅助节点 | x | y | z |
| --- | ---: | ---: | ---: |
| RearSightAnchor | 0.000044 | 0.098250 | 0.406841 |
| FrontSightAnchor | 0.000031552 | 0.092061251 | 1.018499374 |

照门缺口底部 y≈0.097004、肩部 y≈0.099444；RearSightAnchor 取开放缺口的中心高度，位于真实照门截面内。
前准星取顶边中点。用四元数将 front−rear 旋到相机 +Z，再抵消旋转后 rear 的 x/y。
ADS 深度独立设为 0.46m，不移动玩家的相机位置。
三角面射线检查确认中心视线通过照门，首次击中位于前准星顶边，没有枪机或机匣遮挡。

## 最终姿态

相对玩家 Camera，单位米、欧拉角单位弧度，uniform scale=(1,1,1)。

| Anchor | position (x,y,z) | rotation (x,y,z) |
| --- | --- | --- |
| HipAnchor | (0.240000, -0.250000, 0.460000) | (0,0,0) |
| ADSAnchor | (-0.000052269, -0.102361169, 0.460000) | (-0.010117638, 0.000020351, -0.000000103) |

ADS 俯仰约 -0.5797°。Hip 比上一版向前 10cm、向下 2cm。
姿态定义集中于 `src/weapons/ViewmodelAnchors.ts`；Hip / ADS 插值后叠加 Sprint / Bolt / Reload / Recoil 偏移，逐帧从锚点重建，不累计变换。
ADS 使用 210ms smoothstep；垂直 FOV 从 1.18rad（67.6°）降为 0.90rad（51.6°），210ms 到位。

第一人称禁用自身克隆的 sling mesh；15 名 AI 的 sling 保持可见。
同一场景只请求 GLB 一次，共享 3 份几何、3 个材质、6 个底层 GPU 纹理；没有新增材质或复制贴图。
第一人称 renderingGroupId=2、world=0；沿用原有 receiveShadows=false。没有添加新 LOD 或改写世界武器比例。

## 枪机与回位

修正 GLB quaternion 覆盖 Euler rotation 的问题：保存初始旋转后，让刚性 bolt 节点按初始姿态驱动。
沿原时间线执行抬柄约 60.2° → 后拉 14cm → 前推 14cm → 闭锁；开锁期间仅轻微倾斜整枪。
保留 1.5s cycle、5 发弹仓、3.2s reload 和现有事件音效。
ADS 相机后坐使用会衰减的 cameraKick，去掉每枪永久累加的 ADS pitch 偏移；Hip 原有 pitch 后坐保留。
射击 origin、散布及传给 Combat 的方向计算未改动。

浏览器执行真实 attack / update 共 10 次，中间按原 5 发弹仓规则装填再进入 ADS，没有每枪 reset。
每次结束 root position 完全相同、枪机回到初始位置/零旋转；相机 pitch 无累计变化。
1440×900 下，10 次回位后前后 Anchor 距中心最大误差小于 0.002px，浮点矩阵误差小于 0.000003。
实际 post-spread shot ray 也已记录，每枪中心误差小于 1.1px；这部分散布按原规则保留，未通过修改弹道让其严格归零。

## 开发调试与裁切

开发服务器按 F4 切换，或以 `?adsdebug` 打开。默认关闭；production build 不包含该模块。
白圈=屏幕中心，青圈=rear，黄圈=front，粉色=当前射击轴；粉色虚线圈为最近一枪实际散布后的射线在 100m 处的投影。
面板分别报告实时几何误差及最近一枪开火时的实际射线误差，移动镜头后不会把历史射线冒充实时瞄准线。

保持 camera.minZ=0.05m、maxZ=240m。
对 Hip / ADS / Sprint / Reload / 完整 Bolt Cycle 的可见 mesh 顶点逐帧变换到相机空间；最近深度约 0.172834m，距 near plane 仍有 0.122834m。
截图中枪托延伸到画面下边缘是正常屏幕边界，不是 near plane 切断。未发现机匣裁切或枪机穿镜头。

## 验证与截图

- `npm run build` 通过；构建产物未包含瞄具 debug 模块。
- `npm test`：53/53 通过。
- `tests/hanyang-browser.mjs`：模型共享、14cm 行程、装填、切换、死亡、20 次 reset、延迟加载通过。
- `tests/sight-calibration-browser.mjs`：几何视线、210ms ADS、10 次实际开火回位、真实旋转矩阵、资源共享、逐顶点裁切检查通过，无浏览器错误。
- 原 GLB SHA256 前后一致：`E9FCB7723374798E2D880C1F428A8BAEA540202D570857CD05F2735E34DED955`。

结果目录：`test-results/sight-calibration/`。

1. `01-hip.png` — Hip Fire。
2. `02-ads.png` — 静止机械 ADS，debug 关闭。
3. `03-bolt-back.png` — 开火后 0.75 秒，抬柄并完全后拉。
4. `04-ai-third-person.png` — 中日双方 AI 持枪，枪带保留。

附加：`ads-debug.png`（包含真实射线）、`ads-detail.png`（瞄具局部原生截图）、`measurements.json`（逐次测量）。
