/**
 * BOSS 直聘城市编码（city 参数必传，否则搜索结果为空）。
 * 同时给 TaskCard 等位置提供「编码 → 中文名」反查。
 */
export const CITY_OPTIONS: { v: string; label: string }[] = [
  { v: '100010000', label: '全国' },
  { v: '101010100', label: '北京' },
  { v: '101020100', label: '上海' },
  { v: '101280100', label: '广州' },
  { v: '101280600', label: '深圳' },
  { v: '101210100', label: '杭州' },
  { v: '101030100', label: '天津' },
  { v: '101200100', label: '武汉' },
  { v: '101270100', label: '成都' },
  { v: '101110100', label: '西安' },
  { v: '101190400', label: '苏州' },
  { v: '101190100', label: '南京' },
  { v: '101230100', label: '福州' },
  { v: '101230200', label: '厦门' },
  { v: '101280200', label: '东莞' },
  { v: '101220100', label: '合肥' },
  { v: '101180100', label: '郑州' },
  { v: '101040100', label: '重庆' },
  { v: '101240100', label: '南昌' },
  { v: '101300100', label: '南宁' },
  { v: '101050100', label: '哈尔滨' },
  { v: '101060100', label: '长春' },
  { v: '101070100', label: '沈阳' },
  { v: '101070200', label: '大连' },
  { v: '101120100', label: '济南' },
  { v: '101120200', label: '青岛' },
  { v: '101080100', label: '呼和浩特' },
  { v: '101090100', label: '石家庄' },
  { v: '101130100', label: '乌鲁木齐' },
  { v: '101160100', label: '兰州' },
  { v: '101170100', label: '银川' },
  { v: '101250100', label: '长沙' },
  { v: '101260100', label: '贵阳' },
  { v: '101290100', label: '昆明' },
  { v: '101310100', label: '海口' },
];

const CITY_MAP: Record<string, string> = Object.fromEntries(
  CITY_OPTIONS.map((c) => [c.v, c.label])
);

/** 编码 → 中文名；编码非法或为空时回退为「全国」（与后端 _normalize_city 默认行为一致）。 */
export function cityLabel(code?: string | null): string {
  if (!code) return '全国';
  return CITY_MAP[code] || code;
}
