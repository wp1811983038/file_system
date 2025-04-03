/**
 * 坐标系转换工具
 * GCJ-02（火星坐标系）与BD-09（百度坐标系）互转
 */
const CoordTransform = {
    x_PI: 3.14159265358979324 * 3000.0 / 180.0,
    PI: 3.1415926535897932384626,
    a: 6378245.0,
    ee: 0.00669342162296594323,
    
    /**
     * 火星坐标系 (GCJ-02) 转百度坐标系 (BD-09)
     * 腾讯地图 -> 百度地图
     */
    gcj02ToBd09(lng, lat) {
      const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * this.x_PI);
      const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * this.x_PI);
      const bd_lng = z * Math.cos(theta) + 0.0065;
      const bd_lat = z * Math.sin(theta) + 0.006;
      return {
        lng: bd_lng,
        lat: bd_lat
      };
    },
    
    /**
     * 百度坐标系 (BD-09) 转火星坐标系 (GCJ-02)
     * 百度地图 -> 腾讯地图、高德地图
     */
    bd09ToGcj02(bd_lng, bd_lat) {
      const x = bd_lng - 0.0065;
      const y = bd_lat - 0.006;
      const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * this.x_PI);
      const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * this.x_PI);
      const gg_lng = z * Math.cos(theta);
      const gg_lat = z * Math.sin(theta);
      return {
        lng: gg_lng,
        lat: gg_lat
      };
    }
  };
  
  module.exports = CoordTransform;