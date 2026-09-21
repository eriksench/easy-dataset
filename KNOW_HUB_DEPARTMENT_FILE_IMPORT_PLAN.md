# Easy Dataset 与 Know Hub 部门文件联动方案

## 1. 目标与范围

本方案已于 2026-09-20 按推荐架构完成首版实现；本文同时保留设计依据、接口约定和验收标准，便于后续联调与扩展用户部门映射。

目标是在 Easy Dataset 的“选择文件”入口增加两种来源：

1. 本地文件：保持现有选择、转换、上传和处理行为不变。
2. 部门文件：展示 Know Hub 中“信息中心”的文档，支持检索、分页和多选；确认后将文件导入当前 Easy Dataset 项目，并进入与本地文件相同的文本切分、PDF 处理和领域树处理链路。

当前阶段按需求忽略用户身份和真实部门映射，所有部门文件查询和下载校验均固定使用：

```text
departName = 信息中心
```

## 2. 现状调研

### 2.1 Easy Dataset 当前上传链路

- 上传入口在 `components/text-split/components/UploadArea.js`。按钮使用 `component="label"` 包裹隐藏的 `<input type="file" multiple>`，所以点击按钮会立即打开本地文件选择器。
- `components/text-split/FileUploader.js` 将本地 `FileList` 转成数组，执行大小和扩展名校验，并维护待上传文件列表。
- 点击“上传并处理文件”后，前端逐个执行 `getContent(file)`：
  - PDF、Markdown 保留原内容；
  - TXT 改名为 Markdown；
  - DOCX 通过 mammoth + turndown 转成 Markdown；
  - EPUB 转成 Markdown。
- 转换结果通过 `POST /api/projects/{projectId}/files` 以二进制方式上传。
- `app/api/projects/[projectId]/files/route.js` 目前只接收最终的 `.md` 或 `.pdf`，写入项目 `files` 目录、计算 MD5，并创建 `UploadFiles` 记录。
- 上传完成后，`FileUploader` 把 `{fileName, fileId}` 列表交给现有 `file-processing` 任务，继续 PDF 处理、文本切分和领域树处理。
- 当前单文件上限由 `FILE.MAX_FILE_SIZE` 定义为 300 MiB。上传循环为串行；发生中途失败时，已经成功的文件不会回滚。

结论：要达到“与本地上传一样的效果”，部门文件最终也必须产出相同的 `{fileName, fileId}`，再调用现有 `onUploadSuccess`/`file-processing` 链路。

### 2.2 Know Hub 当前查询接口

现有接口：

```http
POST /jeecg-boot/searchDepartFiles
Content-Type: application/json
```

本阶段请求固定为：

```json
{
  "departName": "信息中心",
  "fileName": "可选搜索词",
  "secretLevel": "可选密级",
  "pageSize": 10,
  "pageNo": 1
}
```

接口已经支持：

- 按 `file_bm_internal` 精确匹配部门；
- 按文件名模糊搜索；
- 按密级向下筛选；
- 分页；
- 普通来源和非结构化上传来源的 MinIO 定位信息解析。

返回字段包含 `id`（实际是 `file_identifier`）、`fileName`、`bucketName`、`filePath`、`secretLevel`、`file_ext`、压缩/加密标记和 `ywyyAescode`。

### 2.3 直接访问 MinIO 的问题

不建议让浏览器或 Easy Dataset 直接根据查询结果访问 MinIO，原因如下：

1. MinIO 密钥不能下发到浏览器。
2. 普通来源的 `filePath` 可能是完整 HTTP/HTTPS URL，而不一定是可直接传给 MinIO `getObject` 的 object name。
3. 查询结果明确存在 `fileIsencrypt`、`fileIszip` 和 `ywyyAescode`；直接下载到的可能是加密流或压缩流，不是 Easy Dataset 能直接解析的原文件。
4. Know Hub 已有多套解密逻辑，包含 AES/SM4、压缩后解密等情况，在 Node.js 中复制一份会造成算法漂移和密钥泄露风险。
5. 当前查询接口带 `@IgnoreAuth`，并且把 `ywyyAescode` 放进响应。Easy Dataset 不应把这些底层字段继续透传给浏览器或写入日志。
6. 查询结果没有可靠的文件大小；导入前仍需通过对象元数据或下载流计数执行 300 MiB 限制。

因此，推荐由 Know Hub 负责定位 MinIO 对象并输出解密、解压后的原始文件流；Easy Dataset 只按文件 ID 发起服务端导入。

## 3. 推荐架构

```text
浏览器
  ├─ 本地文件 ───────────────> Easy Dataset 现有上传接口
  │                              └─ 保存文件/记录 -> file-processing
  │
  └─ 部门文件选择
       ├─ 查询 ───────────────> Easy Dataset 查询代理
       │                          └─ searchDepartFiles（部门固定为“信息中心”）
       └─ 确认导入（只提交 ID） -> Easy Dataset 部门导入接口
                                  └─ Know Hub 原文件下载接口
                                       └─ MinIO 定位、解密、解压、流式返回
                                  └─ 标准化为 md/pdf、保存文件/记录
                                  └─ 返回 {fileName, fileId}
                                  └─ 复用 file-processing
```

职责边界：

- 浏览器：来源选择、列表展示、多选和进度展示；不接触 MinIO 地址、密钥或 AES 编码。
- Easy Dataset 服务端：固定部门、代理检索、按 ID 批量导入、格式标准化、落盘和创建数据库记录。
- Know Hub 服务端：再次校验文件属于“信息中心”，解析真实 bucket/object，读取 MinIO，并按现有规则解密/解压后输出原文件。

## 4. 交互设计

### 4.1 文件来源弹窗

把现有按钮从 `component="label"` 改为普通按钮。点击后打开“选择文件来源”弹窗，提供两个入口：

- 本地文件：关闭来源弹窗后，通过 `inputRef.current.click()` 打开原生文件选择器。
- 部门文件：打开部门文件选择弹窗，不触发原生文件选择器。

拖拽上传仍只代表本地文件，不改变现有含义。

### 4.2 部门文件选择弹窗

建议使用 MUI `Dialog`，包含：

- 标题：`选择部门文件`；副标题显示 `当前部门：信息中心`。
- 文件名搜索框，300 ms 防抖。
- 可选密级筛选：全部、公开、内部、秘密、机密。
- 表格或列表列：复选框、文件名、格式、密级。
- 分页，默认每页 10 条。
- 已选数量；翻页后保留已选 ID。
- `取消` 与 `添加所选文件` 按钮。
- 不属于 `.pdf/.md/.txt/.docx/.epub` 的文件显示但禁止勾选，并解释“不支持该格式”。

部门文件加入待上传区后，与本地文件一起显示，并增加“本地/部门”来源标签。查询接口当前没有大小字段，部门文件可先显示“大小未知”，导入时由服务端强制校验。

### 4.3 上传与进度

- 点击现有“上传并处理文件”后：
  - 本地项走原有上传逻辑；
  - 部门项调用新的批量导入接口。
- 两类文件成功后统一合并为 `{fileName, fileId}` 数组，只调用一次现有 `onUploadSuccess`，从而只创建一次文件处理任务并沿用领域树选择结果。
- 导入期间展示总体进度和当前文件名。
- 批量导入允许部分成功：成功文件继续处理，失败文件保留在待上传列表并展示逐项错误。响应必须明确返回 `succeeded` 与 `failed`，不能只返回一个通用 500。

## 5. 接口设计

### 5.1 Easy Dataset：部门文件查询代理

```http
GET /api/integrations/know-hub/depart-files
    ?fileName=
    &secretLevel=
    &pageNo=1
    &pageSize=10
```

服务端调用 `searchDepartFiles`，但请求体中的 `departName` 由服务端硬编码为“信息中心”，浏览器无权传入或覆盖。

向浏览器返回经过裁剪的结构：

```json
{
  "total": 2,
  "items": [
    {
      "id": "file-identifier",
      "fileName": "部门管理办法.pdf",
      "extension": "pdf",
      "secretLevel": "内部",
      "supported": true
    }
  ]
}
```

不要向浏览器返回 `bucketName`、`filePath`、`fileIsencrypt`、`fileIszip` 或 `ywyyAescode`。

### 5.2 Know Hub：按 ID 下载部门原文件

建议新增：

```http
GET /jeecg-boot/departFiles/{fileIdentifier}/content?departName=信息中心
```

处理步骤：

1. 使用 `file_identifier + file_bm_internal` 查询，不能只按 ID 查询。
2. 根据普通/非结构化来源解析 bucket 和 object name；若数据库存的是 URL，需要安全解析 URL path 并剥离 bucket 段。
3. 使用 Know Hub 现有 MinIO 和解密代码输出原始内容；压缩封装只解出目标原文件，不把内部存储 ZIP 直接交给 Easy Dataset。
4. 返回 `application/octet-stream`，并使用 RFC 5987 编码的 `Content-Disposition` 文件名。
5. 找不到、部门不匹配时返回 404；对象不存在返回 404；解密失败返回 422；存储异常返回 502。
6. 不在 URL、响应头和日志中暴露 AES 编码或 MinIO 凭证。

建议把 `OfficController` 中的 MinIO 解码逻辑抽成独立服务，预览和新下载接口共同调用，避免复制分支逻辑。

### 5.3 Easy Dataset：批量导入部门文件

```http
POST /api/projects/{projectId}/depart-files/import
Content-Type: application/json

{
  "fileIds": ["id-1", "id-2"]
}
```

服务端必须只接受文件 ID，不接受浏览器传入的 bucket、object path 或任意下载 URL，防止越权和 SSRF。

建议响应：

```json
{
  "succeeded": [
    { "sourceId": "id-1", "fileId": "easy-file-id", "fileName": "制度.pdf" }
  ],
  "failed": [
    { "sourceId": "id-2", "fileName": "资料.docx", "message": "文件超过 300 MiB" }
  ]
}
```

每个文件的服务端处理流程：

1. 调用 Know Hub 原文件下载接口，设置连接超时、读取超时和最大响应大小。
2. 根据响应文件名重新校验扩展名，并使用 `path.basename` 清理路径。
3. 限制单文件最大 300 MiB；即使没有 `Content-Length`，也要在读取流时计数并中止超限下载。
4. 与本地上传保持一致地标准化格式：PDF 保留；MD 保留；TXT 改为 MD；DOCX 使用 mammoth + turndown；EPUB 复用现有转换器。
5. 复用从现有 files POST 路由抽出的“保存文件 + 计算 MD5 + 创建 UploadFiles”服务。
6. 使用临时文件加原子重命名；数据库写入失败时清理临时文件，避免半成品。
7. 返回与本地上传相同的 `fileName/fileId`。

导入并发建议限制为 2～3，避免同时下载多个大文件耗尽内存。PDF/MD 可尽量流式落盘；DOCX/EPUB 转换仍需受控缓冲。

## 6. 代码改造清单

### 6.1 Easy Dataset

建议新增：

- `components/text-split/components/FileSourceDialog.js`
- `components/text-split/components/DepartmentFileDialog.js`
- `app/api/integrations/know-hub/depart-files/route.js`
- `app/api/projects/[projectId]/depart-files/import/route.js`
- `lib/integrations/know-hub.js`
- `lib/services/document-import.js`

建议修改：

- `UploadArea.js`：按钮改为来源弹窗入口；保留隐藏 input，由 ref 主动触发。
- `FileUploader.js`：待上传项改为带 `source` 的统一模型；合并本地上传和部门导入结果；统一 PDF 检测、删除、错误和进度状态。
- `app/api/projects/[projectId]/files/route.js`：把落盘和数据库逻辑提取到共享服务，避免部门导入复制实现。
- `lib/file/file-process/get-content.js`：抽取可在浏览器/Node 复用的标准化函数，或增加等价的服务端 Buffer 入口。
- `lib/api/file.js` 和 `lib/api/index.js`：增加部门查询、导入方法。
- `locales/zh-CN/translation.json`、`locales/en/translation.json`：增加来源、部门列表、筛选、导入进度和错误文案；同时把现有支持格式文案补上 `.epub`。
- `.env` 示例/部署说明：增加 Know Hub 基础地址和服务间凭证配置，不提交真实值。

建议环境变量：

```text
KNOW_HUB_BASE_URL=http://know-hub-host:port/jeecg-boot
KNOW_HUB_INTEGRATION_TOKEN=由部署环境注入
```

部门名称本阶段由服务端常量固定为“信息中心”；后续接入用户信息时再替换为服务端身份映射结果。

### 6.2 Know Hub

建议新增或抽取：

- 部门文件内容下载 Controller。
- `DepartFileContentService`：按部门和 file identifier 取元数据、解析 MinIO 位置、解密/解压并返回流。
- 下载接口 DTO/异常映射和接口文档。

建议修改：

- 将预览 Controller 中已有解码代码下沉到共享服务。
- 为 `searchDepartFiles` 和内容下载接口增加服务间认证或至少内网访问控制。
- 搜索响应后续考虑移除 `ywyyAescode`；若必须兼容旧调用方，至少确保 Easy Dataset 代理不透传。
- 补充 URL 型 `filePath` 到 MinIO object name 的规范化测试。

## 7. 安全与可靠性

- MinIO 凭证只保存在 Know Hub 服务端；不写入 Easy Dataset 前端配置。
- Easy Dataset 浏览器只看到业务文件 ID 和展示字段。
- 部门值必须在 Easy Dataset 服务端和 Know Hub 下载端各校验一次，均固定为“信息中心”。
- 生产环境不要继续依赖裸 `@IgnoreAuth`；至少增加共享服务令牌、IP/网络策略和调用审计。
- 不记录 `ywyyAescode`、MinIO 密钥、完整签名 URL或文件正文。
- 文件名进行 basename、非法字符和保留名处理，最终路径必须确认位于当前项目 `files` 目录内。
- 限制 `fileIds` 数量，例如单次最多 20 个；限制单文件大小、总大小、并发数和超时。
- 对同名文件明确策略。建议首版沿用现有行为前先修复覆盖风险：同名不同内容拒绝并提示；同 MD5 可提示已存在。

## 8. 测试方案

### 8.1 Know Hub

- `searchDepartFiles` 固定部门、文件名、密级和分页测试。
- 普通来源、非结构化来源和 URL 型 `filePath` 的 bucket/object 解析测试。
- 未加密、加密、压缩、压缩后加密文件的内容一致性测试。
- 错误部门、未知 ID、MinIO 对象不存在、解密失败测试。
- 验证响应文件名、内容类型，以及日志不包含 AES 编码。

### 8.2 Easy Dataset

- 查询代理必须发送 `departName=信息中心`，并忽略/拒绝客户端伪造部门。
- 查询代理不得向浏览器返回底层 MinIO/AES 字段。
- 导入 PDF、MD、TXT、DOCX、EPUB 后的文件名和内容与本地上传结果一致。
- 超过 300 MiB、非法扩展名、路径穿越文件名、重复文件、上游超时和部分失败测试。
- UI 测试：点击“选择文件”不再直接打开系统选择器；选择“本地文件”才打开；部门列表支持搜索、分页、多选和跨页保留。
- 回归测试：本地拖拽、本地多文件上传、PDF 策略弹窗、领域树选择和后续 file-processing 均保持可用。

## 9. 验收标准

1. 点击“选择文件”先出现来源弹窗，不立即打开本地文件选择器。
2. 选择“本地文件”时，行为与当前版本一致。
3. 选择“部门文件”时，只展示“信息中心”的文档，并支持文件名检索、分页和多选。
4. 不支持的格式不能勾选，前后端都再次校验。
5. 确认导入后，成功文件出现在 Easy Dataset 已上传文件列表中，并启动现有文件处理任务。
6. PDF 仍遵循现有 PDF 处理策略，DOCX/TXT/EPUB 的最终 Markdown 与本地导入语义一致。
7. 任一文件失败不会掩盖其他文件结果；用户能看到逐项失败原因并重试。
8. 浏览器网络请求和页面状态中不出现 MinIO 密钥、AES 编码或可任意访问的对象地址。

## 10. 实施顺序

1. Know Hub 抽取统一文件内容服务并新增按 ID、按部门下载接口。
2. Easy Dataset 增加 Know Hub 服务端客户端和查询代理，先完成列表展示。
3. 抽取 Easy Dataset 的文件持久化/标准化共享服务，完成部门批量导入接口。
4. 改造来源弹窗、部门选择弹窗和统一待上传状态。
5. 接入现有 file-processing，补齐部分失败和进度展示。
6. 完成自动化测试、部署配置和生产安全加固。

## 11. 备选方案：Easy Dataset 直连 MinIO

如果明确要求 Easy Dataset 服务端直接访问 MinIO，可增加 MinIO Node SDK，并把连接信息放在 Easy Dataset 服务端环境变量中。该方案只适合确认所有目标文件均未加密、未使用内部压缩封装，且 `bucketName/objectName` 始终规范的环境。

鉴于当前数据模型和代码已证明存在多种加密/压缩路径以及 URL 型 `filePath`，直连方案需要在 Easy Dataset 复制 Know Hub 的解密协议，不推荐作为正式实现。
