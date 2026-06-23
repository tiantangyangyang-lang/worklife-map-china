// ============================================================
// 中国主要城市中心点经纬度 + 省份映射
// 数据来源: 国家测绘局公开数据 (简化版)
// ============================================================

export interface CityCenter {
  city: string;
  province: string;
  lng: number;
  lat: number;
}

/** 主要城市经纬度 + 省份 */
export const CITY_CENTERS: Record<string, CityCenter> = {
  '北京': { city: '北京', province: '北京', lng: 116.4074, lat: 39.9042 },
  '上海': { city: '上海', province: '上海', lng: 121.4737, lat: 31.2304 },
  '深圳': { city: '深圳', province: '广东', lng: 114.0579, lat: 22.5431 },
  '深圳市': { city: '深圳', province: '广东', lng: 114.0579, lat: 22.5431 },
  '广州': { city: '广州', province: '广东', lng: 113.2644, lat: 23.1291 },
  '杭州': { city: '杭州', province: '浙江', lng: 120.1551, lat: 30.2741 },
  '成都': { city: '成都', province: '四川', lng: 104.0665, lat: 30.5728 },
  '南京': { city: '南京', province: '江苏', lng: 118.7969, lat: 32.0603 },
  '武汉': { city: '武汉', province: '湖北', lng: 114.3055, lat: 30.5928 },
  '天津': { city: '天津', province: '天津', lng: 117.1901, lat: 39.1252 },
  '苏州': { city: '苏州', province: '江苏', lng: 120.5853, lat: 31.2989 },
  '西安': { city: '西安', province: '陕西', lng: 108.9398, lat: 34.3416 },
  '厦门': { city: '厦门', province: '福建', lng: 118.0894, lat: 24.4798 },
  '长沙': { city: '长沙', province: '湖南', lng: 112.9388, lat: 28.2282 },
  '大连': { city: '大连', province: '辽宁', lng: 121.6147, lat: 38.9140 },
  '重庆': { city: '重庆', province: '重庆', lng: 106.5516, lat: 29.5630 },
  '青岛': { city: '青岛', province: '山东', lng: 120.3826, lat: 36.0671 },
  '宁波': { city: '宁波', province: '浙江', lng: 121.5440, lat: 29.8683 },
  '无锡': { city: '无锡', province: '江苏', lng: 120.3119, lat: 31.4912 },
  '合肥': { city: '合肥', province: '安徽', lng: 117.2272, lat: 31.8206 },
  '合肥市': { city: '合肥', province: '安徽', lng: 117.2272, lat: 31.8206 },
  '济南': { city: '济南', province: '山东', lng: 117.1205, lat: 36.6510 },
  '福州': { city: '福州', province: '福建', lng: 119.2965, lat: 26.0745 },
  '珠海': { city: '珠海', province: '广东', lng: 113.5767, lat: 22.2707 },
  '佛山': { city: '佛山', province: '广东', lng: 113.1216, lat: 23.0218 },
  '东莞': { city: '东莞', province: '广东', lng: 113.7518, lat: 23.0207 },
  '惠州': { city: '惠州', province: '广东', lng: 114.4153, lat: 23.1115 },
  '嘉兴': { city: '嘉兴', province: '浙江', lng: 120.7555, lat: 30.7461 },
  '昆明': { city: '昆明', province: '云南', lng: 102.8329, lat: 24.8801 },
  '云南昆明': { city: '昆明', province: '云南', lng: 102.8329, lat: 24.8801 },
  '太原': { city: '太原', province: '山西', lng: 112.5489, lat: 37.8706 },
  '兰州': { city: '兰州', province: '甘肃', lng: 103.8343, lat: 36.0611 },
  '马鞍山': { city: '马鞍山', province: '安徽', lng: 118.5080, lat: 31.6894 },
  '马鞍山市': { city: '马鞍山', province: '安徽', lng: 118.5080, lat: 31.6894 },
  '临沂': { city: '临沂', province: '山东', lng: 118.3265, lat: 35.0653 },
  '山东临沂': { city: '临沂', province: '山东', lng: 118.3265, lat: 35.0653 },
  '淄博': { city: '淄博', province: '山东', lng: 118.0548, lat: 36.8131 },
  '山东淄博': { city: '淄博', province: '山东', lng: 118.0548, lat: 36.8131 },
  '潍坊': { city: '潍坊', province: '山东', lng: 119.1070, lat: 36.7094 },
  '泰安': { city: '泰安', province: '山东', lng: 117.0894, lat: 36.1885 },
  '秦皇岛': { city: '秦皇岛', province: '河北', lng: 119.6005, lat: 39.9354 },
  '河北秦皇岛': { city: '秦皇岛', province: '河北', lng: 119.6005, lat: 39.9354 },
  '香港': { city: '香港', province: '香港', lng: 114.1694, lat: 22.3193 },
  '桐庐': { city: '桐庐', province: '浙江', lng: 119.6915, lat: 29.7936 },
  '南宁': { city: '南宁', province: '广西', lng: 108.3669, lat: 22.8170 },
  '石家庄': { city: '石家庄', province: '河北', lng: 114.5149, lat: 38.0428 },
  '郑州': { city: '郑州', province: '河南', lng: 113.6253, lat: 34.7466 },
  '沈阳': { city: '沈阳', province: '辽宁', lng: 123.4290, lat: 41.7968 },
  '长春': { city: '长春', province: '吉林', lng: 125.3245, lat: 43.8868 },
  '哈尔滨': { city: '哈尔滨', province: '黑龙江', lng: 126.5340, lat: 45.8038 },
  '南昌': { city: '南昌', province: '江西', lng: 115.8581, lat: 28.6832 },
  '海口': { city: '海口', province: '海南', lng: 110.3312, lat: 20.0317 },
  '贵阳': { city: '贵阳', province: '贵州', lng: 106.7135, lat: 26.5783 },
  '西宁': { city: '西宁', province: '青海', lng: 101.7782, lat: 36.6232 },
};

/** 非城市关键词 (会被过滤掉) */
const NON_CITY_KEYWORDS = ['remote', 'Remote', 'REMOTE', '远程', '不限', '全国', '多地'];

/** 通过城市名查找坐标 (含模糊匹配) */
export function findCityCenter(cityName: string): CityCenter | null {
  if (!cityName) return null;
  const name = cityName.trim();

  // 过滤非城市关键词
  if (NON_CITY_KEYWORDS.includes(name)) return null;

  // 精确匹配
  if (CITY_CENTERS[name]) return CITY_CENTERS[name];

  // 去除常见后缀
  const stripped = name.replace(/(市|区|县|镇|地区|经济技术开发区|高新区)$/g, '');
  if (CITY_CENTERS[stripped]) return CITY_CENTERS[stripped];

  // 包含匹配 (e.g. "Linkedin - 北京" → "北京", "National 上海" → "上海")
  for (const key of Object.keys(CITY_CENTERS)) {
    if (name.includes(key) || key.includes(name)) {
      return CITY_CENTERS[key];
    }
  }

  // 省份名直接匹配 (e.g. "广东" → 广州, "山东" → 济南, "福建" → 福州, "广西" → 南宁)
  const provinceCapitals: Record<string, string> = {
    '广东': '广州',
    '山东': '济南',
    '福建': '福州',
    '广西': '南宁',
    '江苏': '南京',
    '浙江': '杭州',
    '安徽': '合肥',
    '湖南': '长沙',
    '湖北': '武汉',
    '四川': '成都',
    '河北': '石家庄',
    '河南': '郑州',
    '辽宁': '沈阳',
    '吉林': '长春',
    '黑龙江': '哈尔滨',
    '江西': '南昌',
    '山西': '太原',
    '陕西': '西安',
    '海南': '海口',
    '贵州': '贵阳',
    '云南': '昆明',
    '甘肃': '兰州',
    '青海': '西宁',
  };
  if (provinceCapitals[name]) {
    return CITY_CENTERS[provinceCapitals[name]] || null;
  }

  return null;
}

/** 获取所有城市列表 (去重) */
export function getAllCityNames(): string[] {
  const cities = new Set<string>();
  Object.values(CITY_CENTERS).forEach(c => cities.add(c.city));
  return Array.from(cities).sort();
}
