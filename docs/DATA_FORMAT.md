# 数据格式说明 (DATA_FORMAT)

本文档定义项目内部所有标准化数据的字段、可选值与生成规则。

## 1. 标准化公司记录 (`normalized_companies.json`)

数组, 每个元素是一条公司作息记录。

| 字段               | 类型       | 说明                                                |
| ------------------ | ---------- | --------------------------------------------------- |
| `id`               | string     | 唯一 ID, 格式 `rec_{row}_{idx}` (多城市展开时带 idx) |
| `company_name`     | string     | 清洗后的公司名 (去前后空格)                          |
| `company_name_raw` | string     | 原始公司名 (保留)                                    |
| `city`             | string     | 标准化城市名 (匹配到坐标库后)                        |
| `city_raw`         | string     | 原始城市字段 (e.g. `"北京/上海"`)                    |
| `city_list`        | string[]   | 拆分后的城市数组 (e.g. `["北京","上海"]`)            |
| `province`         | string     | 省份 (从城市坐标库查找)                              |
| `geo_level`        | enum       | `city` / `district` / `address` / `coordinate` / `unknown` |
| `lng`              | number/null | 经度 (WGS84)                                        |
| `lat`              | number/null | 纬度 (WGS84)                                        |
| `section`          | enum       | `955` / `965` / `996` (来自 Excel 区域)              |
| `work_system`      | enum       | 见下方"工作制度"                                    |
| `weekend_type`     | enum       | 见下方"周末类型"                                    |
| `risk_level`       | enum       | `low` / `medium` / `high` / `very_high` / `unknown`  |
| `time_raw`         | string     | 原始时间字段 (Excel 数字或文本)                      |
| `event_date`       | string     | 标准化日期 `YYYY-MM-DD` (无法解析则为空)            |
| `rule_text`        | string     | 规则文本 (e.g. `"9:00-18:00-5; 午休1h"`)            |
| `evidence_text`    | string     | 证据拼接 (用 ` \| ` 分隔)                            |
| `evidence_list`    | string[]   | 证据数组                                            |
| `source_type`      | string     | 固定 `uploaded_excel` (V1)                           |
| `source_name`      | string     | 原始文件名                                          |
| `source_sheet`     | string     | 工作表名                                            |
| `source_row`       | number     | Excel 原始行号 (1-based)                             |
| `confidence`       | enum       | `A` / `B` / `C` / `D` / `E`                          |
| `updated_at`       | string     | ISO 8601 时间戳                                     |

### 1.1 `work_system` 可选值

| 值       | 匹配规则 (正则)                                                        |
| -------- | --------------------------------------------------------------------- |
| `007`    | `/007/`                                                                |
| `997`    | `/997/`                                                                |
| `996`    | `/996\|9106\|早9晚9\|早九晚九\|11116/`                                  |
| `995`    | `/995/`                                                                |
| `965`    | `/965\|9-6-5\|9:00-18:00-5\|9点.*6点.*5\|9:00-5:30-5\|915-530-5/`      |
| `955`    | `/955\|9-5-5\|9:00-17:00-5/`                                           |
| `大小周`  | `/大小周\|单双休/`                                                      |
| `单休`    | `/单休\|做六休一\|上六休一\|一周6天\|周六加班/`                          |
| `排班`    | `/排班\|轮休\|倒班\|两班倒/`                                            |
| `加班`    | `/加班\|义务加班\|无偿加班/`                                            |
| `高强度`  | 996 区域兜底 (无明确关键词时)                                          |
| `未知`    | 无匹配                                                                 |

### 1.2 `weekend_type` 可选值

| 值          | 判断规则                                                  |
| ----------- | --------------------------------------------------------- |
| `双休`       | section=955, 或规则包含 `双休/做五休二/五天工作制`         |
| `单休`       | 规则包含 `单休/做六休一/9106/996/997/007`                  |
| `大小周`     | 规则包含 `大小周/单双休`                                   |
| `排班/轮休`  | 规则包含 `排班/轮休/倒班/两班倒`                           |
| `未知`       | 无匹配                                                    |

### 1.3 `risk_level` 评级规则

| 等级        | 触发条件                                                                        |
| ----------- | ------------------------------------------------------------------------------- |
| `very_high` | 规则/证据包含 `拖欠工资/无偿加班/裁员无补偿/强制996/严重违法/猝死/降薪`, 或 work_system ∈ {996, 997, 007, 高强度} |
| `high`      | work_system ∈ {大小周, 单休}                                                     |
| `medium`    | work_system ∈ {965, 995, 加班, 排班}                                             |
| `low`       | work_system = 955                                                                |
| `unknown`   | 无法判断                                                                         |

### 1.4 `confidence` 可信度评级

| 等级 | 标准                                                |
| ---- | --------------------------------------------------- |
| `A`  | 多条证据 (≥3) + 明确规则文本                        |
| `B`  | 至少 1 条证据 + 明确规则文本                         |
| `C`  | 只有规则文本, 无证据                                 |
| `D`  | 955 区域 (只有城市和公司名) 或旧数据来源不完整       |
| `E`  | 无法验证 (V1 暂不使用)                              |

### 1.5 `geo_level` 地理精度

| 值           | 含义                                            |
| ------------ | ----------------------------------------------- |
| `city`       | 城市本级坐标 (当前 V1 主要级别)                 |
| `district`   | 区县级坐标 (V1.5 引入)                          |
| `address`    | 详细地址解析坐标 (V1.5 引入)                    |
| `coordinate` | 用户直接提供经纬度 (V2 引入)                    |
| `unknown`    | 无法定位 (城市坐标库无匹配)                      |

---

## 2. 城市聚合 (`city_summary.json`)

按 `city` 字段聚合, 每个城市一条记录。

| 字段              | 类型   | 说明                                       |
| ----------------- | ------ | ------------------------------------------ |
| `city`            | string | 标准化城市名                               |
| `province`        | string | 省份                                       |
| `total`           | number | 总记录数                                   |
| `count_955`       | number | section=955 的记录数                       |
| `count_965`       | number | section=965 的记录数                       |
| `count_996`       | number | section=996 的记录数                       |
| `count_high`      | number | risk_level ∈ {high, very_high} 的记录数    |
| `count_very_high` | number | risk_level=very_high 的记录数              |
| `count_low`       | number | risk_level=low 的记录数                    |
| `count_medium`    | number | risk_level=medium 的记录数                 |
| `count_unknown`   | number | risk_level=unknown 的记录数                |
| `risk_score`      | number | 强度评分 0-100, 加权平均 (low=0, medium=30, high=65, very_high=100, unknown=50) |
| `risk_dominant`   | enum   | 主导工作强度等级 (该城市记录中最多的等级)       |
| `lng`             | number | 经度                                       |
| `lat`             | number | 纬度                                       |

---

## 3. GeoJSON (`map.geojson`)

标准 GeoJSON FeatureCollection, 每个城市一个 Point Feature。

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [121.4737, 31.2304] },
      "properties": {
        "city": "上海",
        "province": "上海",
        "total": 94,
        "risk_score": 26,
        "risk_dominant": "low",
        "count_955": 64,
        "count_965": 2,
        "count_996": 28
      }
    }
  ]
}
```

可直接导入到 [geojson.io](https://geojson.io), QGIS, Mapbox, deck.gl 等工具。

---

## 4. 强度评分计算公式

```
risk_score = Σ(RISK_WEIGHT[risk_level_i]) / total

RISK_WEIGHT = {
  low: 0,
  medium: 30,
  high: 65,
  very_high: 100,
  unknown: 50
}
```

取值范围 0-100, 数值越大代表该城市公司作息风险越高。

`risk_dominant` 取该城市记录中数量最多的 risk_level, 用于决定地图点位颜色。

---

## 5. 颜色配色 (UI 一致)

| risk_level | fill     | label    |
| ---------- | -------- | -------- |
| low        | #22c55e  | 低强度   |
| medium     | #eab308  | 中强度   |
| high       | #f97316  | 高强度   |
| very_high  | #dc2626  | 极高强度 |
| unknown    | #9ca3af  | 未知     |
