# Kite 文档发布管理平台架构 Review

## 评审定位

本次评审从「资深平台架构师 + 内容管理系统产品架构师」视角出发，重点检查以下问题：

1. 草稿、版本、发布快照是否清晰分离
2. 状态流转是否显式、是否合法
3. 审批流是否配置化，还是硬编码
4. 发布渠道是否解耦，是否支持部分失败与重试
5. 权限是否细粒度，是否区分操作权限和数据权限
6. 是否具备业务审计、发布记录、回滚能力
7. 多语言、多渠道、资源依赖是否有统一治理
8. 哪些地方存在人工补偿、手工修复、日志找问题等低效流程

---

## 总结判断

Kite 已经具备文档、审批、通知、Webhook、多语言、OpenAPI 等基础能力，但目前仍然更像一套**协作文档系统**，而不是成熟的**文档发布管理平台**。

核心问题不在于“有没有表、有没有 UI”，而在于这些能力还没有形成完整闭环：

- 文档发布本质上仍是 `documents.status` 的状态切换，而不是一次独立的发布事务
- 审批存在，但并不是发布的强约束
- Webhook / Integration / Notification Channel 有基础设施，但没有接入真实生产发布流
- 审计、回滚、快照、失败补偿、多语言发布治理都不完整

最重要的结论是：**公开站点当前读取的是文档当前行，而不是不可变发布快照**。这会直接影响发布可追溯性、回滚能力、合规审计能力和多渠道扩展能力。

---

## A. 明确的工程问题

### A1. 草稿、版本、发布快照没有清晰分层

- `documents` 同时承载编辑态与发布态，`status` 是唯一分隔手段。见 `lib/schema-documents.ts:40-68`
- `document_versions` 仅保存历史内容快照，但它是“修订历史”，不是“已发布版本”。见 `lib/schema-documents.ts:137-154`
- `transitionDocument()` 只是更新 `documents.status`，没有创建发布快照、发布记录或发布流水。见 `lib/queries/documents.ts:439-457`
- 公开站点直接读取 `documents.content`，没有独立的已发布读模型。见 `lib/queries/public-docs.ts:54-115`

**结论：** 当前“发布”不是一个独立领域对象，而是一次文档状态更新。

### A2. 状态机虽显式，但前后端不一致

- 后端允许的流转定义在 `ALLOWED_TRANSITIONS`：  
  `draft -> review|archived`  
  `review -> draft|published|archived`  
  `published -> archived`  
  `archived -> draft`  
  见 `lib/constants.ts:19-24`
- 前端对所有非 `draft` 文档都提供 `Revert to Draft` 按钮。见 `components/docs/doc-status-bar.tsx:383-412`
- 但后端并不允许 `published -> draft`，会导致 UI 能点、接口失败。

**结论：** 状态机定义存在，但产品语义和实现语义不一致。

### A3. 审批流存在，但不是强制门禁

- 文档进入 review 由前端先创建审批单，再调用文档状态迁移。见 `components/docs/submit-for-review-dialog.tsx:116-145`
- 但发布接口 `POST /api/documents/[id]/transition` 并不校验审批结果。见 `app/api/documents/[id]/transition/route.ts:20-56`
- review 状态下只冻结“非 reviewer”，reviewer 仍保留 `canTransition`。见 `lib/queries/document-permissions.ts:217-230`

**结论：** “审批前不能发布”只是 UI 文案，不是后端规则。

### A4. 权限模型过粗，操作权限与数据权限混在一起

- 系统只区分 `view/edit/manage` 三档文档权限。见 `lib/schema-documents.ts:85-106`
- 在权限推导里，`canTransition = canEdit`。见 `lib/queries/document-permissions.ts:102-114`
- 这意味着“能编辑”天然等于“能提交发布 / 归档 / 回退流程”，没有单独的 `publish`、`approve`、`rollback` 操作权限。
- `private` 文档在没有显式 ACL 时，对普通成员并不真正私有：  
  `hasCustomPermissions === false` 时，成员依旧可通过默认角色权限访问。见 `lib/queries/document-permissions.ts:85-100`

**结论：** 当前是“协作权限模型”，不是“发布治理权限模型”。

### A5. 审计表存在，但业务审计没有闭环

- `audit_logs` 表设计完整，支持 `publish`、`status_change`、`approve`、`reject` 等动作。见 `lib/queries/audit-logs.ts:18-33`
- 但文档创建、更新、删除、状态切换、审批发起、审批决策都没有稳定调用 `emitAuditEvent()`。
- `emitAuditEvent()` 的实际调用主要集中在成员、团队、邀请、权限分配等非核心发布流。可搜索 `emitAuditEvent(` 验证。
- 审计查询接口仅限 `owner`。见 `app/api/audit-logs/route.ts:11-37`

**结论：** 有审计基础设施，但没有覆盖最关键的发布链路。

### A6. 发布渠道架构解耦了，但生产流程没有接上

- Webhook 事件枚举包含 `document.published`。见 `lib/schema-webhooks.ts:15-28`
- `dispatchWebhookEvent()` 已实现，并记录 delivery。见 `lib/queries/webhooks.ts:99-169`
- Slack / GitHub / Jira 的 provider handler 已实现。见 `lib/integrations/providers/*.ts`
- 但真实文档发布流中，没有地方调用 `dispatchWebhookEvent()` 或 provider handler。
- 目前这些能力主要只在测试接口里调用。见：
  - `app/api/webhooks/[id]/test/route.ts`
  - `app/api/integrations/[id]/test/route.ts`
  - `app/api/notification-channels/[id]/test/route.ts`

**结论：** 渠道基础设施存在，但生产事件没有打通。

### A7. 支持失败记录，但不支持重试、补偿、幂等

- `webhook_deliveries`、`channel_deliveries` 都记录了 `status`、`errorMessage`、`attemptCount`。见：
  - `lib/schema-webhooks.ts:63-86`
  - `lib/schema-notification-channels.ts:52-74`
- 实际发送时 `attemptCount` 总是写成 `1`。见：
  - `lib/queries/webhooks.ts:158-168`
  - `lib/notification-sender.ts:71-80`
- 没有重试队列、退避策略、幂等键、失败重放接口、批次级状态聚合。

**结论：** 失败可见，但不可恢复、不可运营。

### A8. 多语言已建模，但未纳入统一发布治理

- 翻译有独立表 `document_translations` 和版本表 `document_translation_versions`。见 `lib/schema-translations.ts:12-57`
- 翻译支持多版本，但 `status` 是自由文本，没有统一 enum 或状态机约束。见 `app/api/translations/[id]/route.ts:64-84`
- 公共发布查询不读取翻译，也没有 locale 级 published snapshot。见 `lib/queries/public-docs.ts:54-115`

**结论：** 多语言是“内容附属能力”，不是“发布治理能力”。

### A9. 资源依赖治理是 best-effort，不是发布约束

- 文档依赖 API 版本：`documents.apiVersionId`。见 `lib/schema-documents.ts:57`
- 文档关系支持自动解析和关系重建，但关系类型只有 `reference`。见 `lib/schema-documents.ts:156-189`
- 关系重建失败只写服务端错误日志，不会标记“依赖关系失效”或触发补偿。见：
  - `lib/queries/documents.ts:56-68`
  - `lib/document-relations.ts:454-478`

**结论：** 依赖存在，但没有进入发布前校验和发布后监控。

---

## B. 隐含的业务规则

这些规则多数不是产品配置，而是从代码中“推导出来”的：

### B1. `private` 的真实含义不是“默认私有”

只有当文档配置了显式 ACL 时，`private` 才真正收紧访问；否则成员依旧按默认角色权限访问。

### B2. 编辑权默认等于流转权

系统没有单独的 `publish` / `archive` / `rollback` 权限，拥有编辑权的人在实现上通常也拥有流转权。

### B3. review 更像协作锁，不像审批门禁

进入 review 后，系统只限制非 reviewer 编辑和流转；并没有将“审批通过”作为 publish 的硬前置条件。

### B4. reviewer 天然具备流程豁免

由于 pending approval 时只冻结非 reviewer，所以 reviewer 在 review 阶段仍可能拥有流转能力。

### B5. 审批默认是“全员通过”

前端在提审时把 `requiredApprovals` 设置为所选 reviewer 总数。见 `components/docs/submit-for-review-dialog.tsx:124-135`

### B6. “一票否决”是硬编码规则

- 任一 reviewer `rejected`，审批直接 `rejected`
- `changes_requested` 不参与状态归约  
  见 `lib/queries/approvals.ts:169-186`

### B7. 翻译不是独立发布单元

翻译能编辑、能存版本，但不能单独发布、单独回滚、单独灰度，也不能控制 locale 级上线节奏。

### B8. 已发布内容不是不可变资产

由于公开站点读的是当前文档行，不是 snapshot，所以“已发布内容”并不真正不可变。

---

## C. 应该产品化的能力

### C1. Release Center（发布中心）

把“改状态”升级为“发版任务”：

- 发布对象
- 发布范围
- 发布批次
- 依赖检查
- 执行结果
- 失败补偿
- 回滚入口

### C2. Published Snapshot（发布快照）

每次发布都生成不可变快照，至少包含：

- 文档标题、slug、内容、摘要、导航信息
- locale
- 依赖清单
- checksum
- 发布人、发布时间、发布原因

### C3. 配置化审批策略

把审批从“临时选 reviewer”升级为策略中心：

- 审批模板
- 不同内容类型 / 分类 / 目录的审批规则
- 团队审批
- 阈值审批
- 一票否决
- `changes_requested` 返工闭环
- deadline、催办、升级

### C4. 渠道编排中心

将 Webhook / Integration / Notification Channel 纳入统一调度：

- 每个渠道独立 delivery 状态
- 部分失败可见
- 重试 / 重放
- 幂等
- 退避策略
- 人工补偿入口

### C5. 细粒度授权模型

将当前 `view/edit/manage` 升级为更明确的操作权限：

- `doc.view`
- `doc.edit`
- `doc.submit_review`
- `doc.publish`
- `doc.archive`
- `doc.rollback`
- `approval.request`
- `approval.decide`
- `delivery.replay`

同时区分：

- 操作权限
- 数据范围权限
- 审批角色权限
- 运营补偿权限

### C6. Localization Control Tower（多语言控制台）

支持：

- source / target 差异追踪
- 翻译完成度
- locale readiness
- 分语言上线
- 分语言回滚
- 语言覆盖率与缺口识别

### C7. Dependency Governance（依赖治理）

将文档、API、引用、资源、外链纳入统一依赖图，支持：

- 发布前 preflight
- 失效资源阻断
- API 依赖变更影响分析
- 资源清单
- broken link 报告

### C8. Ops Console（运维补偿台）

为运营和平台同学提供统一控制台：

- 失败 delivery 列表
- 可重试任务
- 超时审批
- stale relation
- 未完成翻译
- 待补偿发布批次

---

## D. 推荐的 P0 / P1 / P2 roadmap

## P0

- 统一前后端状态机，消除 `published -> draft` 等前后不一致行为
- 在后端强制审批门禁：未满足审批策略不得发布
- 新增 `publication` / `published_snapshot` / `publishedAt` / `publishedBy`
- 公开站点改为读取快照而非编辑态文档
- 为文档状态切换、审批决定、发布/回滚补齐审计事件
- 将真实文档事件接入 Webhook / Integration / Notification Channel
- 新增失败 delivery 重放接口和基本补偿能力
- 修正 `private` 语义和 reviewer 资格校验

## P1

- 审批策略中心：模板、团队审批、催办、超时升级、返工闭环
- 渠道编排中心：部分失败、退避重试、幂等键、批次追踪
- locale 级发布控制：分语言上线 / 回滚 / 完成度治理
- 发布前依赖检查：API 依赖、引用关系、资源完整性、失效链接
- 发布记录与变更对比视图

## P2

- 定时发布、灰度发布、渠道分批发布
- 统一运营 / 审计看板
- 自动 changelog
- 发布日历
- 风险分级审批
- 变更影响面自动分析

---

## E. 对应的领域模型重构建议

建议把当前“文档 + 附属表”的模式，升级为作者域、审批域、发布域、交付域解耦的领域模型。

### E1. 文档作者域

#### `Document`

逻辑文档身份，不承载发布态，只承载长期稳定元数据：

- `documentId`
- `workspaceId`
- `category`
- `baseLocale`
- `createdBy`
- `ownership`

#### `DraftRevision`

编辑态修订对象，替代当前“文档当前内容 + document_versions 混合承载”的方式：

- `revisionId`
- `documentId`
- `locale`
- `title`
- `content`
- `derivedSummary`
- `editor`
- `createdAt`

### E2. 审批域

#### `ReviewSubmission`

一次具体的送审实例，应冻结其对应 revision，而不是只关联 document。

#### `ApprovalPolicy`

审批规则配置对象：

- 适用范围
- reviewer 生成规则
- required approvals
- veto policy
- deadline
- escalation

#### `ApprovalDecision`

审批动作对象，显式记录：

- reviewer
- decision
- comment
- decidedAt

### E3. 发布域

#### `Publication`

一次发布任务，是发布中心的核心对象：

- 发布范围
- 发布目标
- 操作者
- 原因
- 状态
- 开始 / 完成时间

#### `PublishedSnapshot`

不可变发布资产，公开站点只读取它。

建议它至少关联：

- `documentId`
- `revisionId`
- `locale`
- `publicationId`
- `publishedSlug`
- `content`
- `nav metadata`
- `dependency manifest`

### E4. 交付域

#### `ChannelDelivery`

每个渠道一条 delivery。

#### `DeliveryAttempt`

一次 delivery 可以有多次 attempt，天然支持：

- 部分失败
- 重试
- 退避
- 幂等
- 运维补偿

### E5. 多语言域

#### `LocaleVariant`

文档的某个语言变体。

#### `LocaleRelease`

语言级发布对象，支持：

- 某一语言单独上线
- 某一语言单独回滚
- 某一语言延迟发布

### E6. 依赖治理域

#### `DependencyEdge`

统一建模：

- 文档 -> 文档
- 文档 -> API
- 文档 -> 资源
- 文档 -> 外链

#### `PreflightCheck`

发布前校验结果对象，明确记录：

- 校验项
- 风险等级
- 是否阻断
- 修复建议

### E7. 审计与事件域

#### `BusinessEvent`

例如：

- 文档送审
- 审批通过
- 审批拒绝
- 发布开始
- 渠道失败
- 回滚完成

#### `AuditEvent`

保留合规侧审计：

- 谁
- 在什么时候
- 对哪个资源
- 做了什么
- 原因 / 元数据

---

## 最后的判断

当前 Kite 在“内容协作”方面已经有相当不错的基础，但若要成为真正的文档发布管理平台，必须完成以下跃迁：

1. 从 `Document.status` 驱动，升级为 `Publication + Snapshot` 驱动
2. 从“审批可选”升级为“审批门禁”
3. 从“通知/集成测试可用”升级为“生产事件真正出站”
4. 从“内容多语言”升级为“发布多语言治理”
5. 从“日志兜底”升级为“失败可追踪、可重试、可补偿、可回滚”

一句话总结：

**Kite 目前有发布平台的零件，但还没有形成发布平台的领域闭环。**
